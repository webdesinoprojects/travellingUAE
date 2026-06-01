import "server-only";

import { formatTripDisplayDate } from "@/lib/date";
import {
  getSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/server/supabase/client";
import type {
  TripDestination,
  TripFeature,
  TripGalleryImage,
  TripItinerary,
  TripMapLocation,
  TripPackage,
} from "@/types/travel";

type AdminTripPreview = {
  destination: TripDestination;
  pkg: TripPackage;
  status: string;
};

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=1200&q=82";

type TripPreviewRow = {
  id: string;
  slug: string;
  title: string;
  city: string | null;
  summary: string | null;
  overview: string | null;
  badge: string | null;
  duration_days: number;
  duration_label: string | null;
  nights: number | null;
  has_flights: boolean;
  hotel_star: number | null;
  price_amount: number | string;
  currency: string | null;
  start_date: string | null;
  travelers_label: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  map_zoom: number | null;
  status: string;
};

type OrderedTextRow = { body: string; sort_order: number };
type FeatureRow = { label: string; icon: string | null; sort_order: number };
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

export async function getAdminTripPreview(
  tripId: string,
): Promise<AdminTripPreview | null> {
  if (!hasSupabaseAdminEnv()) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const tripResult = await supabase
    .from("trips")
    .select(
      "id,destination_id,slug,title,city,summary,overview,badge,duration_days,duration_label,nights,has_flights,hotel_star,price_amount,currency,start_date,travelers_label,latitude,longitude,map_zoom,status",
    )
    .eq("id", tripId)
    .maybeSingle();

  if (tripResult.error || !tripResult.data) {
    return null;
  }

  const trip = tripResult.data as unknown as TripPreviewRow & {
    destination_id: string;
  };

  const destinationResult = await supabase
    .from("destinations")
    .select("id,slug,name,country,city,result_title,currency,status")
    .eq("id", trip.destination_id)
    .maybeSingle();

  if (destinationResult.error || !destinationResult.data) {
    return null;
  }

  const destinationRow = destinationResult.data as {
    id: string;
    slug: string;
    name: string;
    country: string | null;
    city: string | null;
    result_title: string | null;
    currency: string | null;
    status: string;
  };

  const [features, bullets, highlights, inclusions, exclusions, terms, gallery, itinerary] =
    await Promise.all([
      selectTripRows<FeatureRow>("trip_features", "label,icon,sort_order", trip.id),
      selectTripRows<OrderedTextRow>("trip_bullets", "body,sort_order", trip.id),
      selectTripRows<OrderedTextRow>("trip_highlights", "body,sort_order", trip.id),
      selectTripRows<OrderedTextRow>("trip_inclusions", "body,sort_order", trip.id),
      selectTripRows<OrderedTextRow>("trip_exclusions", "body,sort_order", trip.id),
      selectTripRows<OrderedTextRow>("trip_terms", "body,sort_order", trip.id),
      selectTripRows<GalleryRow>("trip_gallery", "src,alt_text,sort_order", trip.id),
      selectTripRows<ItineraryRow>(
        "trip_itinerary_items",
        "title,body,location_label,latitude,longitude,zoom,sort_order",
        trip.id,
      ),
    ]);

  const currency = destinationRow.currency ?? trip.currency ?? "SAR";
  const pkg = mapTripPackage(trip, currency, features, bullets, highlights, inclusions, exclusions, terms, gallery, itinerary);

  const destination: TripDestination = {
    slug: destinationRow.slug,
    name: destinationRow.name,
    resultTitle:
      destinationRow.result_title ?? `Trips in ${destinationRow.name}`,
    resultCount: `Showing 1 - 1 of 1 Packages`,
    packageDate: formatTripDisplayDate(new Date()),
    currency,
    searchLabel: "Handpicked Holidays",
    poster: {
      title: destinationRow.name,
      price: pkg.price,
      season: "Seasonal",
      image: pkg.gallery[0]?.src ?? DEFAULT_IMAGE,
      alt: pkg.gallery[0]?.alt ?? `${destinationRow.name} preview`,
    },
    categories: [],
    hotelStars: [],
    packages: [pkg],
  };

  return { destination, pkg, status: trip.status };
}

async function selectTripRows<T>(
  table: string,
  columns: string,
  tripId: string,
) {
  const supabase = getSupabaseAdminClient();
  const result = await supabase
    .from(table)
    .select(columns)
    .eq("trip_id", tripId)
    .order("sort_order", { ascending: true });

  if (result.error) {
    throw result.error;
  }

  return (result.data ?? []) as T[];
}

function mapTripPackage(
  trip: TripPreviewRow,
  currency: string,
  features: FeatureRow[],
  bullets: OrderedTextRow[],
  highlights: OrderedTextRow[],
  inclusions: OrderedTextRow[],
  exclusions: OrderedTextRow[],
  terms: OrderedTextRow[],
  gallery: GalleryRow[],
  itinerary: ItineraryRow[],
): TripPackage {
  const durationDays = Number(trip.duration_days);
  const priceAmount = Number(trip.price_amount);
  const galleryImages = mapGalleryRows(gallery, trip.title);
  const mapLocation = mapTripLocation(trip);
  const itineraryRows = mapItineraryRows(itinerary);

  return {
    slug: trip.slug,
    title: trip.title,
    city: trip.city ?? "",
    image: galleryImages[0]?.src ?? DEFAULT_IMAGE,
    alt: galleryImages[0]?.alt ?? `${trip.title} preview`,
    tags: [],
    categories: [],
    badge: trip.badge ?? "Preview",
    durationLabel: trip.duration_label ?? `${durationDays} Days`,
    durationDays,
    hasFlights: Boolean(trip.has_flights),
    hotelStar: Number(trip.hotel_star ?? 4),
    priceAmount,
    features:
      features.length > 0
        ? features.map((feature) => ({
            label: feature.label,
            icon: normalizeFeatureIcon(feature.icon),
          }))
        : defaultFeatures(Boolean(trip.has_flights)),
    bullets: bullets.map((row) => row.body),
    price: formatMoney(priceAmount, currency),
    travelers: trip.travelers_label ?? "2 adults",
    startDate: trip.start_date
      ? formatTripDisplayDate(new Date(trip.start_date))
      : formatTripDisplayDate(new Date()),
    duration: `${Math.max(Number(trip.nights ?? durationDays) - 1, 1)} nights`,
    overview:
      trip.overview ??
      trip.summary ??
      "Preview overview. Add an overview before publishing.",
    highlights: highlights.map((row) => row.body),
    inclusions: inclusions.map((row) => row.body),
    exclusions: exclusions.map((row) => row.body),
    gallery: galleryImages,
    mapLocation,
    itinerary: itineraryRows,
    terms: terms.map((row) => row.body),
  };
}

function mapGalleryRows(
  gallery: GalleryRow[],
  title: string,
): TripGalleryImage[] {
  const rows = gallery
    .filter((item) => item.src)
    .map((item) => ({
      src: item.src as string,
      alt: item.alt_text ?? title,
    }));

  if (rows.length > 0) {
    return rows;
  }

  return [{ src: DEFAULT_IMAGE, alt: `${title} preview` }];
}

function mapTripLocation(trip: TripPreviewRow): TripMapLocation | undefined {
  const latitude = Number(trip.latitude);
  const longitude = Number(trip.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return undefined;
  }

  return {
    label: trip.city ?? trip.title,
    latitude,
    longitude,
    zoom: Number(trip.map_zoom ?? 12),
  };
}

function mapItineraryRows(rows: ItineraryRow[]): TripItinerary | undefined {
  if (rows.length === 0) {
    return undefined;
  }

  return {
    title: rows[0]?.title ?? "Itinerary",
    paragraphs: rows.map((row) => row.body),
    days: rows.map((row) => ({
      title: row.title,
      description: row.body,
    })),
  };
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

function formatMoney(value: number | string, currency: string) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return `${currency} 0`;
  }

  return `${currency}${numeric.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
}
