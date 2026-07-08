import "server-only";

import { cache } from "react";

import { requireTrustedPublicMediaUrl } from "@/server/cms/hero";
import { isRecord } from "@/server/http/validation";
import { logServerError } from "@/server/http/response";
import {
  getSupabasePublicServerClient,
  hasSupabasePublicEnv,
} from "@/server/supabase/client";
import type { HajjUmrahPageContent } from "@/types/hajj-umrah";

export const HAJJ_UMRAH_PAGE_SECTION_KEY = "hajj_umrah.page";

export const FALLBACK_HAJJ_UMRAH_CONTENT: HajjUmrahPageContent = {
  heroImageUrl:
    "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?auto=format&fit=crop&w=2400&q=86",
  heroImageAlt: "Pilgrims near the Kaaba in Makkah",
  heroImages: [
    {
      url: "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?auto=format&fit=crop&w=2400&q=86",
      alt: "Pilgrims near the Kaaba in Makkah",
    },
  ],
  heroTitle: "Hajj & Umrah",
  breadcrumbLabel: "Hajj & Umrah",
  pageHeading:
    "Hajj & Umrah Packages from Kerala - Travel with India's Trusted Experts",
  contentMarkdown:
    "Planning your sacred journey becomes effortless with Fly Time, the trusted travel desk for seamless Hajj & Umrah experiences.\n\nWhether you seek affordable Umrah packages or premium Umrah packages with flights, we provide fully customized solutions tailored to your needs. With reliable support and transparent pricing, Fly Time helps keep the journey smooth and spiritually fulfilling from start to finish.",
  introParagraphs: [
    "Planning your sacred journey becomes effortless with Fly Time, the trusted travel desk for seamless Hajj & Umrah experiences.",
    "Whether you seek affordable Umrah packages or premium Umrah packages with flights, we provide fully customized solutions tailored to your needs. With reliable support and transparent pricing, Fly Time helps keep the journey smooth and spiritually fulfilling from start to finish.",
  ],
  benefits: [
    "Complete visa assistance and documentation support",
    "Affordable and flexible Hajj tour packages",
    "Trusted guidance from experienced travel experts",
    "Customized packages with flights and hotel stays",
    "24/7 customer support throughout your journey",
  ],
  closingCtaText:
    "Start your holy journey today. Share the travel details and the Fly Time team will follow up with package guidance.",
  formTitle: "Book Your Pilgrimage",
  formIntro: "Share your details and the Fly Time team will follow up.",
  seoTitle: "Hajj & Umrah Packages | Fly Time",
  seoDescription:
    "Plan Hajj and Umrah pilgrimages with Fly Time, including visa support, flights, hotels, departure city, traveler details and enquiry support.",
};

type DbSiteSection = {
  payload: Record<string, unknown> | null;
};

export const getPublicHajjUmrahContent = cache(
  async (): Promise<HajjUmrahPageContent> => {
    if (!hasSupabasePublicEnv()) {
      return FALLBACK_HAJJ_UMRAH_CONTENT;
    }

    try {
      const result = await getSupabasePublicServerClient()
        .from("site_sections")
        .select("payload")
        .eq("key", HAJJ_UMRAH_PAGE_SECTION_KEY)
        .eq("status", "published")
        .maybeSingle();

      if (result.error) {
        throw result.error;
      }

      const row = (result.data ?? null) as DbSiteSection | null;

      return mapHajjUmrahPayload(row?.payload);
    } catch (error) {
      logServerError("public.hajj-umrah.content", error);
      return FALLBACK_HAJJ_UMRAH_CONTENT;
    }
  },
);

export function mapHajjUmrahPayload(
  payload: unknown,
): HajjUmrahPageContent {
  if (!isRecord(payload)) {
    return FALLBACK_HAJJ_UMRAH_CONTENT;
  }

  return {
    heroImageUrl: stringValue(payload.heroImageUrl, {
      fallback: FALLBACK_HAJJ_UMRAH_CONTENT.heroImageUrl,
      mediaUrl: true,
    }),
    heroImageAlt: stringValue(payload.heroImageAlt, {
      fallback: FALLBACK_HAJJ_UMRAH_CONTENT.heroImageAlt,
    }),
    heroImages: heroImages(payload.heroImages, payload),
    heroTitle: stringValue(payload.heroTitle, {
      fallback: FALLBACK_HAJJ_UMRAH_CONTENT.heroTitle,
    }),
    breadcrumbLabel: stringValue(payload.breadcrumbLabel, {
      fallback: FALLBACK_HAJJ_UMRAH_CONTENT.breadcrumbLabel,
    }),
    pageHeading: stringValue(payload.pageHeading, {
      fallback: FALLBACK_HAJJ_UMRAH_CONTENT.pageHeading,
    }),
    contentMarkdown: stringValue(payload.contentMarkdown, {
      fallback: FALLBACK_HAJJ_UMRAH_CONTENT.contentMarkdown,
    }),
    introParagraphs: stringArray(payload.introParagraphs, {
      fallback: FALLBACK_HAJJ_UMRAH_CONTENT.introParagraphs,
      maxItems: 8,
    }),
    benefits: stringArray(payload.benefits, {
      fallback: FALLBACK_HAJJ_UMRAH_CONTENT.benefits,
      maxItems: 20,
    }),
    closingCtaText: stringValue(payload.closingCtaText, {
      fallback: FALLBACK_HAJJ_UMRAH_CONTENT.closingCtaText,
    }),
    formTitle: stringValue(payload.formTitle, {
      fallback: FALLBACK_HAJJ_UMRAH_CONTENT.formTitle,
    }),
    formIntro: stringValue(payload.formIntro, {
      fallback: FALLBACK_HAJJ_UMRAH_CONTENT.formIntro,
    }),
    seoTitle: stringValue(payload.seoTitle, {
      fallback: FALLBACK_HAJJ_UMRAH_CONTENT.seoTitle,
    }),
    seoDescription: stringValue(payload.seoDescription, {
      fallback: FALLBACK_HAJJ_UMRAH_CONTENT.seoDescription,
    }),
  };
}

function heroImages(value: unknown, payload: Record<string, unknown>) {
  if (Array.isArray(value)) {
    const images = value
      .filter(isHeroImageRecord)
      .map((item) => ({
        url: item.url.trim(),
        alt: item.alt.trim(),
      }))
      .filter((item) => isTrustedMediaUrl(item.url) && item.alt)
      .slice(0, 3);

    if (images.length > 0) {
      return images;
    }
  }

  return [
    {
      url: stringValue(payload.heroImageUrl, {
        fallback: FALLBACK_HAJJ_UMRAH_CONTENT.heroImageUrl,
        mediaUrl: true,
      }),
      alt: stringValue(payload.heroImageAlt, {
        fallback: FALLBACK_HAJJ_UMRAH_CONTENT.heroImageAlt,
      }),
    },
  ];
}

function isHeroImageRecord(
  value: unknown,
): value is { url: string; alt: string } {
  return (
    isRecord(value) &&
    typeof value.url === "string" &&
    typeof value.alt === "string"
  );
}

function stringValue(
  value: unknown,
  { fallback, mediaUrl = false }: { fallback: string; mediaUrl?: boolean },
) {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  const trimmed = value.trim();

  if (mediaUrl && !isTrustedMediaUrl(trimmed)) {
    return fallback;
  }

  return trimmed;
}

function stringArray(
  value: unknown,
  {
    fallback,
    maxItems,
  }: {
    fallback: string[];
    maxItems: number;
  },
) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);

  return items.length > 0 ? items : fallback;
}

function isTrustedMediaUrl(value: string) {
  try {
    requireTrustedPublicMediaUrl(value);
    return true;
  } catch {
    return false;
  }
}
