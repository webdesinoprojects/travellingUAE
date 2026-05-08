import "server-only";

import { cache } from "react";

import {
  getTripDestination as getFallbackTripDestination,
  getTripDestinations as getFallbackTripDestinations,
  getTripPackage as getFallbackTripPackage,
} from "@/data/trips";
import { formatTripDisplayDate } from "@/lib/date";
import { logServerError } from "@/server/http/response";
import {
  getSupabasePublicServerClient,
  hasSupabasePublicEnv,
} from "@/server/supabase/client";
import type {
  TripCategory,
  TripDestination,
  TripFeature,
  TripGalleryImage,
  TripItinerary,
  TripMapLocation,
  TripPackage,
} from "@/types/travel";

type DbDestinationCard = {
  id: string;
  slug: string;
  name: string;
  country: string | null;
  city: string | null;
  result_title: string | null;
  currency: string | null;
  package_date: string | null;
  poster_title: string | null;
  poster_price: number | string | null;
  poster_season: string | null;
  poster_image_url: string | null;
  poster_image_alt: string | null;
  package_count: number | string | null;
};

type DbTripCard = {
  id: string;
  destination_id: string;
  destination_slug: string;
  destination_name: string;
  slug: string;
  title: string;
  city: string | null;
  summary: string | null;
  badge: string | null;
  duration_days: number;
  duration_label: string | null;
  has_flights: boolean;
  hotel_star: number | null;
  price_amount: number | string;
  currency: string | null;
  start_date: string | null;
  card_image_url: string | null;
  card_image_alt: string | null;
  categories: unknown;
  tags: unknown;
};

type OrderedTextRow = {
  body: string;
  sort_order: number;
};

type FeatureRow = {
  label: string;
  icon: string | null;
  sort_order: number;
};

type GalleryRow = {
  src: string | null;
  alt_text: string | null;
  sort_order: number;
};

type ItineraryRow = {
  title: string;
  body: string;
  location_label: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  zoom: number | null;
  sort_order: number;
};

const DEFAULT_CARD_IMAGE =
  "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=1200&q=82";

export const getPublicTripDestinations = cache(async () => {
  const fromSupabase = await fetchTripDestinationsFromSupabase();

  if (fromSupabase?.length) {
    return fromSupabase;
  }

  return getFallbackTripDestinations();
});

export const getPublicTripDestination = cache(async (slug: string) => {
  const destinations = await getPublicTripDestinations();
  const destination = destinations.find((item) => item.slug === slug);

  if (destination) {
    return destination;
  }

  return getFallbackTripDestination(slug);
});

export const getPublicTripPackage = cache(
  async (destinationSlug: string, packageSlug: string) => {
    const fromSupabase = await fetchTripPackageFromSupabase(
      destinationSlug,
      packageSlug,
    );

    if (fromSupabase) {
      return fromSupabase;
    }

    return getFallbackTripPackage(destinationSlug, packageSlug);
  },
);

async function fetchTripDestinationsFromSupabase() {
  if (!hasSupabasePublicEnv()) {
    return null;
  }

  try {
    const supabase = getSupabasePublicServerClient();
    const [destinationsResult, tripsResult] = await Promise.all([
      supabase
        .from("published_destination_cards")
        .select(
          [
            "id",
            "slug",
            "name",
            "country",
            "city",
            "result_title",
            "currency",
            "package_date",
            "poster_title",
            "poster_price",
            "poster_season",
            "poster_image_url",
            "poster_image_alt",
            "package_count",
          ].join(","),
        )
        .order("sort_order", { ascending: true }),
      supabase
        .from("published_trip_cards")
        .select("*")
        .order("sort_order", { ascending: true }),
    ]);

    if (destinationsResult.error) {
      throw destinationsResult.error;
    }

    if (tripsResult.error) {
      throw tripsResult.error;
    }

    const destinations = (destinationsResult.data ??
      []) as unknown as DbDestinationCard[];
    const trips = (tripsResult.data ?? []) as unknown as DbTripCard[];

    if (destinations.length === 0) {
      return null;
    }

    const tripsByDestination = new Map<string, DbTripCard[]>();

    trips.forEach((trip) => {
      const current = tripsByDestination.get(trip.destination_slug) ?? [];
      current.push(trip);
      tripsByDestination.set(trip.destination_slug, current);
    });

    return destinations.map((destination) =>
      mapDestinationCard(
        destination,
        tripsByDestination.get(destination.slug) ?? [],
      ),
    );
  } catch (error) {
    logServerError("public.trips.list", error);
    return null;
  }
}

async function fetchTripPackageFromSupabase(
  destinationSlug: string,
  packageSlug: string,
) {
  if (!hasSupabasePublicEnv()) {
    return null;
  }

  try {
    const supabase = getSupabasePublicServerClient();
    const destination = await getPublicTripDestination(destinationSlug);

    if (!destination) {
      return null;
    }

    const destinationRow = await supabase
      .from("destinations")
      .select("id,slug")
      .eq("slug", destinationSlug)
      .eq("status", "published")
      .maybeSingle();

    if (destinationRow.error || !destinationRow.data) {
      if (destinationRow.error) {
        throw destinationRow.error;
      }

      return null;
    }

    const tripResult = await supabase
      .from("trips")
      .select(
        [
          "id",
          "slug",
          "title",
          "city",
          "summary",
          "overview",
          "badge",
          "duration_days",
          "duration_label",
          "nights",
          "has_flights",
          "hotel_star",
          "price_amount",
          "currency",
          "start_date",
          "travelers_label",
          "latitude",
          "longitude",
          "map_zoom",
        ].join(","),
      )
      .eq(
        "destination_id",
        (destinationRow.data as unknown as { id: string }).id,
      )
      .eq("slug", packageSlug)
      .eq("status", "published")
      .maybeSingle();

    if (tripResult.error || !tripResult.data) {
      if (tripResult.error) {
        throw tripResult.error;
      }

      return null;
    }

    const tripId = (tripResult.data as unknown as { id: string }).id;
    const [
      featureResult,
      bulletResult,
      highlightResult,
      inclusionResult,
      exclusionResult,
      termResult,
      galleryResult,
      itineraryResult,
    ] = await Promise.all([
      selectTripRows<FeatureRow>("trip_features", tripId),
      selectTripRows<OrderedTextRow>("trip_bullets", tripId),
      selectTripRows<OrderedTextRow>("trip_highlights", tripId),
      selectTripRows<OrderedTextRow>("trip_inclusions", tripId),
      selectTripRows<OrderedTextRow>("trip_exclusions", tripId),
      selectTripRows<OrderedTextRow>("trip_terms", tripId),
      selectTripRows<GalleryRow>("trip_gallery", tripId),
      selectTripRows<ItineraryRow>("trip_itinerary_items", tripId),
    ]);

    const basePackage = destination.packages.find(
      (item) => item.slug === packageSlug,
    );

    return mapTripDetail({
      row: tripResult.data as unknown as Record<string, unknown>,
      basePackage,
      destination,
      features: featureResult,
      bullets: bulletResult,
      highlights: highlightResult,
      inclusions: inclusionResult,
      exclusions: exclusionResult,
      terms: termResult,
      gallery: galleryResult,
      itinerary: itineraryResult,
    });
  } catch (error) {
    logServerError("public.trips.detail", error);
    return null;
  }
}

async function selectTripRows<T>(table: string, tripId: string) {
  const supabase = getSupabasePublicServerClient();
  const result = await supabase
    .from(table)
    .select("*")
    .eq("trip_id", tripId)
    .order("sort_order", { ascending: true });

  if (result.error) {
    throw result.error;
  }

  return (result.data ?? []) as T[];
}

function mapDestinationCard(
  destination: DbDestinationCard,
  tripRows: DbTripCard[],
): TripDestination {
  const packages = tripRows.map(mapTripCard);
  const packageCount = Number(destination.package_count ?? packages.length);
  const date = destination.package_date
    ? formatTripDisplayDate(new Date(destination.package_date))
    : formatTripDisplayDate(new Date());
  const currency = destination.currency ?? "SAR";

  return {
    slug: destination.slug,
    name: destination.name,
    resultTitle: destination.result_title ?? `Trips in ${destination.name}`,
    resultCount: `Showing 1 - ${packages.length} of ${packageCount} Packages`,
    packageDate: date,
    currency,
    searchLabel: "Handpicked Holidays",
    poster: {
      title: destination.poster_title ?? destination.name,
      price: formatMoney(destination.poster_price ?? 0, currency),
      season: destination.poster_season ?? "Seasonal",
      image: destination.poster_image_url ?? DEFAULT_CARD_IMAGE,
      alt:
        destination.poster_image_alt ??
        `${destination.name} holiday destination`,
    },
    categories: getCategoryCounts(packages),
    hotelStars: getHotelStarCounts(packages),
    packages,
  };
}

function mapTripCard(row: DbTripCard): TripPackage {
  const currency = row.currency ?? "SAR";
  const durationDays = Number(row.duration_days);
  const categories = parseTaxonomyNames(row.categories);
  const tags = parseTaxonomyNames(row.tags);
  const city = row.city ?? row.destination_name;
  const durationLabel = row.duration_label ?? `${durationDays} Days`;
  const priceAmount = Number(row.price_amount);

  return {
    slug: row.slug,
    title: row.title,
    city,
    image: row.card_image_url ?? DEFAULT_CARD_IMAGE,
    alt: row.card_image_alt ?? `${row.title} package image`,
    tags,
    categories,
    badge: row.badge ?? "Recommended",
    durationLabel,
    durationDays,
    hasFlights: row.has_flights,
    hotelStar: row.hotel_star ?? 4,
    priceAmount,
    features: defaultFeatures(row.has_flights),
    bullets: row.summary ? [row.summary] : [],
    price: formatMoney(priceAmount, currency),
    travelers: "2 adults",
    startDate: row.start_date
      ? formatTripDisplayDate(new Date(row.start_date))
      : formatTripDisplayDate(new Date()),
    duration: `${Math.max(durationDays - 1, 1)} nights`,
    overview:
      row.summary ??
      "Package details are being finalized by the Fly Time travel desk.",
    highlights: [],
    inclusions: [],
    exclusions: [],
    gallery: [
      {
        src: row.card_image_url ?? DEFAULT_CARD_IMAGE,
        alt: row.card_image_alt ?? `${row.title} package image`,
      },
    ],
  };
}

function mapTripDetail({
  row,
  basePackage,
  destination,
  features,
  bullets,
  highlights,
  inclusions,
  exclusions,
  terms,
  gallery,
  itinerary,
}: {
  row: Record<string, unknown>;
  basePackage: TripPackage | undefined;
  destination: TripDestination;
  features: FeatureRow[];
  bullets: OrderedTextRow[];
  highlights: OrderedTextRow[];
  inclusions: OrderedTextRow[];
  exclusions: OrderedTextRow[];
  terms: OrderedTextRow[];
  gallery: GalleryRow[];
  itinerary: ItineraryRow[];
}): TripPackage {
  const durationDays = Number(row.duration_days ?? basePackage?.durationDays ?? 1);
  const currency = String(row.currency ?? destination.currency ?? "SAR");
  const priceAmount = Number(row.price_amount ?? basePackage?.priceAmount ?? 0);
  const city = String(row.city ?? basePackage?.city ?? destination.name);
  const packageGallery = mapGalleryRows(gallery, basePackage);
  const mapLocation = mapTripLocation(row, city);
  const itineraryRows = mapItineraryRows(itinerary);

  return {
    slug: String(row.slug ?? basePackage?.slug ?? ""),
    title: String(row.title ?? basePackage?.title ?? "Trip package"),
    city,
    image: basePackage?.image ?? packageGallery[0]?.src ?? DEFAULT_CARD_IMAGE,
    alt: basePackage?.alt ?? packageGallery[0]?.alt ?? "Trip package image",
    tags: basePackage?.tags ?? [],
    categories: basePackage?.categories ?? [],
    badge: String(row.badge ?? basePackage?.badge ?? "Recommended"),
    durationLabel: String(
      row.duration_label ?? basePackage?.durationLabel ?? `${durationDays} Days`,
    ),
    durationDays,
    hasFlights: Boolean(row.has_flights ?? basePackage?.hasFlights ?? true),
    hotelStar: Number(row.hotel_star ?? basePackage?.hotelStar ?? 4),
    priceAmount,
    features:
      features.length > 0
        ? features.map((feature) => ({
            label: feature.label,
            icon: normalizeFeatureIcon(feature.icon),
          }))
        : (basePackage?.features ?? defaultFeatures(true)),
    bullets: orderedText(bullets, basePackage?.bullets),
    price: formatMoney(priceAmount, currency),
    travelers: String(
      row.travelers_label ?? basePackage?.travelers ?? "2 adults",
    ),
    startDate:
      typeof row.start_date === "string"
        ? formatTripDisplayDate(new Date(row.start_date))
        : (basePackage?.startDate ?? formatTripDisplayDate(new Date())),
    duration: `${Math.max(
      Number(row.nights ?? basePackage?.durationDays ?? durationDays) || 1,
      1,
    )} nights`,
    overview: String(
      row.overview ??
        row.summary ??
        basePackage?.overview ??
        "Package details are being finalized by the Fly Time travel desk.",
    ),
    highlights: orderedText(highlights, basePackage?.highlights),
    inclusions: orderedText(inclusions, basePackage?.inclusions),
    exclusions: orderedText(exclusions, basePackage?.exclusions),
    gallery: packageGallery,
    mapLocation,
    itinerary: itineraryRows,
    terms: orderedText(terms, basePackage?.terms),
  };
}

function mapGalleryRows(
  gallery: GalleryRow[],
  basePackage: TripPackage | undefined,
): TripGalleryImage[] {
  const rows = gallery
    .filter((item) => item.src)
    .map((item) => ({
      src: item.src!,
      alt: item.alt_text ?? basePackage?.title ?? "Trip gallery image",
    }));

  if (rows.length > 0) {
    return rows;
  }

  return (
    basePackage?.gallery ?? [
      {
        src: DEFAULT_CARD_IMAGE,
        alt: "Trip gallery image",
      },
    ]
  );
}

function mapTripLocation(
  row: Record<string, unknown>,
  fallbackLabel: string,
): TripMapLocation | undefined {
  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return undefined;
  }

  return {
    label: fallbackLabel,
    latitude,
    longitude,
    zoom: Number(row.map_zoom ?? 12),
  };
}

function mapItineraryRows(rows: ItineraryRow[]): TripItinerary | undefined {
  if (rows.length === 0) {
    return undefined;
  }

  return {
    title: rows[0]?.title ?? "Itinerary",
    paragraphs: rows.map((row) => row.body),
  };
}

function orderedText(rows: OrderedTextRow[], fallback: string[] = []) {
  if (rows.length === 0) {
    return fallback;
  }

  return rows.map((row) => row.body);
}

function defaultFeatures(hasFlights: boolean): TripFeature[] {
  return [
    { label: hasFlights ? "Flights" : "No Flights", icon: "flight" },
    { label: "Transfers", icon: "transfer" },
    { label: "Hand-Picked Hotels", icon: "hotel" },
    { label: "Activities", icon: "activity" },
  ];
}

function normalizeFeatureIcon(icon: string | null): TripFeature["icon"] {
  if (
    icon === "flight" ||
    icon === "transfer" ||
    icon === "hotel" ||
    icon === "activity"
  ) {
    return icon;
  }

  return "activity";
}

function parseTaxonomyNames(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (item && typeof item === "object" && "name" in item) {
        return String(item.name);
      }

      return null;
    })
    .filter((item): item is string => Boolean(item));
}

function getCategoryCounts(packages: TripPackage[]): TripCategory[] {
  const counts = new Map<string, number>();

  packages.forEach((pkg) => {
    pkg.categories.forEach((category) => {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    });
  });

  return Array.from(counts.entries()).map(([label, count]) => ({
    label,
    count,
  }));
}

function getHotelStarCounts(packages: TripPackage[]): TripCategory[] {
  const labels = ["<3", "3", "4", "5"];

  return labels.map((label) => ({
    label,
    count: packages.filter((pkg) =>
      label === "<3" ? pkg.hotelStar < 3 : pkg.hotelStar === Number(label),
    ).length,
  }));
}

function formatMoney(value: number | string, currency: string) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return `${currency} 0`;
  }

  return `${currency}${numeric.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
}
