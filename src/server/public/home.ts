import "server-only";

import { cache } from "react";

import {
  bentoPackages as fallbackBentoPackages,
  exclusives as fallbackExclusives,
  services as fallbackServices,
  testimonials as fallbackTestimonials,
} from "@/data/travel";
import { logServerError } from "@/server/http/response";
import {
  getSupabasePublicServerClient,
  hasSupabasePublicEnv,
} from "@/server/supabase/client";
import {
  FALLBACK_HOME_HERO_MEDIA,
  mapHomeHeroPayload,
  requireTrustedPublicMediaUrl,
} from "@/server/cms/hero";
import type { PublicHomeContent, PublicHomeSectionCopy } from "@/types/home";
import type {
  BentoPackage,
  ProductCard,
  ServiceTile,
  Testimonial,
  TravelIconKey,
} from "@/types/travel";

type DbMedia = {
  url: string | null;
  secure_url: string | null;
  alt_text: string | null;
};

type DbCollection = {
  id: string;
  slug: string;
  title: string;
  eyebrow: string | null;
  description: string | null;
  type: "flytime_picks" | "route_board" | "custom";
  sort_order: number;
};

type DbCollectionItem = {
  collection_id: string;
  title: string;
  subtitle: string | null;
  price_label: string | null;
  duration_label: string | null;
  action_label: string | null;
  href: string | null;
  metadata: Record<string, unknown> | null;
  media: DbMedia | DbMedia[] | null;
};

type DbService = {
  title: string;
  summary: string | null;
  icon: string | null;
  media: DbMedia | DbMedia[] | null;
};

type DbTestimonial = {
  author: string;
  quote: string;
  media: DbMedia | DbMedia[] | null;
};

type DbSiteSection = {
  payload: Record<string, unknown> | null;
};

const iconKeys = new Set<TravelIconKey>([
  "flight",
  "hotel",
  "package",
  "hajj",
  "wellness",
  "cruise",
  "visa",
  "bus",
  "transfer",
  "car",
  "passport",
  "document",
  "insurance",
  "sim",
]);

const fallbackHomeContent: PublicHomeContent = {
  hero: FALLBACK_HOME_HERO_MEDIA,
  picksSection: {
    eyebrow: "Handpicked Deals",
    title: "Fly Time Picks",
    description:
      "Seasonal offers with clear pricing, simple actions, and fast paths into package details.",
  },
  routesSection: {
    eyebrow: "Holiday Lanes",
    title: "Routes People Ask For",
    description:
      "A visual board of short breaks, city stays, alpine escapes and Eid routes that can open directly into available packages.",
  },
  exclusives: fallbackExclusives,
  bentoPackages: fallbackBentoPackages,
  services: fallbackServices,
  testimonials: fallbackTestimonials,
};

const unavailableHomeContent: PublicHomeContent = {
  ...fallbackHomeContent,
  exclusives: [],
  bentoPackages: [],
  services: [],
  testimonials: [],
};

export const getPublicHomeContent = cache(async () => {
  const fromSupabase = await fetchHomeContentFromSupabase();

  if (fromSupabase) {
    return fromSupabase;
  }

  return fallbackHomeContent;
});

async function fetchHomeContentFromSupabase() {
  if (!hasSupabasePublicEnv()) {
    return null;
  }

  try {
    const supabase = getSupabasePublicServerClient();
    const [
      heroResult,
      collectionsResult,
      itemsResult,
      servicesResult,
      testimonialsResult,
    ] =
      await Promise.all([
        supabase
          .from("site_sections")
          .select("payload")
          .eq("key", "home.hero")
          .eq("status", "published")
          .maybeSingle(),
        supabase
          .from("collections")
          .select("id,slug,title,eyebrow,description,type,sort_order")
          .eq("status", "published")
          .order("sort_order", { ascending: true }),
        supabase
          .from("collection_items")
          .select(
            [
              "collection_id",
              "title",
              "subtitle",
              "price_label",
              "duration_label",
              "action_label",
              "href",
              "metadata",
              "media:media_assets(url,secure_url,alt_text)",
            ].join(","),
          )
          .eq("status", "published")
          .order("sort_order", { ascending: true }),
        supabase
          .from("services")
          .select("title,summary,icon,media:media_assets(url,secure_url,alt_text)")
          .eq("status", "published")
          .order("sort_order", { ascending: true }),
        supabase
          .from("testimonials")
          .select("author,quote,media:media_assets(url,secure_url,alt_text)")
          .eq("status", "published")
          .order("sort_order", { ascending: true }),
      ]);

    if (heroResult.error) {
      throw heroResult.error;
    }

    if (collectionsResult.error) {
      throw collectionsResult.error;
    }

    if (itemsResult.error) {
      throw itemsResult.error;
    }

    if (servicesResult.error) {
      throw servicesResult.error;
    }

    if (testimonialsResult.error) {
      throw testimonialsResult.error;
    }

    const collections = (collectionsResult.data ?? []) as DbCollection[];
    const items = (itemsResult.data ?? []) as unknown as DbCollectionItem[];
    const dbServices = (servicesResult.data ?? []) as unknown as DbService[];
    const dbTestimonials = (testimonialsResult.data ??
      []) as unknown as DbTestimonial[];
    const hero = (heroResult.data ?? null) as DbSiteSection | null;

    return {
      hero: mapHomeHeroPayload(hero?.payload),
      picksSection: mapSectionCopy(collections, "flytime_picks", fallbackHomeContent.picksSection),
      routesSection: mapSectionCopy(collections, "route_board", fallbackHomeContent.routesSection),
      exclusives: mapFlyTimePicks(collections, items),
      bentoPackages: mapRouteBoard(collections, items),
      services: mapServices(dbServices),
      testimonials: mapTestimonials(dbTestimonials),
    };
  } catch (error) {
    logServerError("public.home.content", error);
    return unavailableHomeContent;
  }
}

function mapFlyTimePicks(
  collections: DbCollection[],
  items: DbCollectionItem[],
): ProductCard[] {
  const rows = getCollectionItems(collections, items, "flytime_picks");

  return rows.flatMap((item) => {
    const media = getMedia(item.media);

    if (!media.url || !item.price_label || !item.action_label || !item.href) {
      return [];
    }

    return [
      {
        title: item.title,
        price: item.price_label,
        summary: item.subtitle ?? undefined,
        image: media.url,
        alt: media.alt ?? `${item.title} travel offer`,
        action: item.action_label,
        href: item.href,
      },
    ];
  });
}

function mapRouteBoard(
  collections: DbCollection[],
  items: DbCollectionItem[],
): BentoPackage[] {
  const rows = getCollectionItems(collections, items, "route_board");

  return rows.flatMap((item, index) => {
    const media = getMedia(item.media);
    const size = getBentoSize(item.metadata?.size, index);

    if (!media.url || !item.price_label || !item.duration_label || !item.href) {
      return [];
    }

    return [
      {
        title: item.title,
        price: item.price_label,
        duration: item.duration_label,
        image: media.url,
        alt: media.alt ?? `${item.title} route image`,
        size,
        href: item.href,
      },
    ];
  });
}

function mapServices(rows: DbService[]): ServiceTile[] {
  return rows.flatMap((row) => {
    const media = getMedia(row.media);

    if (!media.url) {
      return [];
    }

    return [
      {
        title: row.title,
        summary: row.summary ?? undefined,
        image: media.url,
        alt: media.alt ?? `${row.title} service image`,
        icon: normalizeIcon(row.icon),
      },
    ];
  });
}

function mapTestimonials(rows: DbTestimonial[]): Testimonial[] {
  return rows.map((row) => {
    const media = getMedia(row.media);

    return {
      quote: row.quote,
      author: row.author,
      image: media.url ?? undefined,
      alt: media.alt ?? `${row.author} traveler story`,
    };
  });
}

function getCollectionItems(
  collections: DbCollection[],
  items: DbCollectionItem[],
  type: DbCollection["type"],
) {
  const collectionIds = new Set(
    collections
      .filter((collection) => collection.type === type)
      .map((collection) => collection.id),
  );

  return items.filter((item) => collectionIds.has(item.collection_id));
}

function mapSectionCopy(
  collections: DbCollection[],
  type: DbCollection["type"],
  fallback: PublicHomeSectionCopy,
) {
  const section = collections.find((collection) => collection.type === type);

  if (!section) {
    return fallback;
  }

  return {
    eyebrow: section.eyebrow?.trim() || fallback.eyebrow,
    title: section.title.trim() || fallback.title,
    description: section.description?.trim() || fallback.description,
  };
}

function getMedia(value: DbMedia | DbMedia[] | null) {
  const media = Array.isArray(value) ? value[0] : value;
  const url = media?.secure_url ?? media?.url ?? null;

  if (url) {
    try {
      requireTrustedPublicMediaUrl(url);
    } catch {
      return { url: null, alt: null };
    }
  }

  return {
    url,
    alt: media?.alt_text ?? null,
  };
}

function normalizeIcon(icon: string | null): TravelIconKey {
  if (iconKeys.has(icon as TravelIconKey)) {
    return icon as TravelIconKey;
  }

  return "package";
}

function getBentoSize(
  value: unknown,
  index: number,
): BentoPackage["size"] {
  if (value === "featured" || value === "wide" || value === "small") {
    return value;
  }

  if (index === 0) {
    return "featured";
  }

  return index === 3 ? "wide" : "small";
}
