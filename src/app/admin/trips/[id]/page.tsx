import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { requireAdminPageAccess } from "@/server/admin/access";
import {
  getSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/server/supabase/client";
import { TripEditor } from "@/features/admin/components/TripEditor";
import { TripContentEditor } from "@/features/admin/components/TripContentEditor";
import { listAdminTripDestinations } from "@/server/admin/trip-editor";
import { listTripContentItems } from "@/server/admin/trip-content";
import type {
  AdminTripContentWorkspace,
  AdminTripGalleryItem,
  AdminTripInclusion,
  AdminTripItineraryItem,
  AdminTripTextItem,
} from "@/types/admin-trip-content";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type TripRow = {
  id: string;
  destination_id: string;
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
  sort_order: number;
};

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  await requireAdminPageAccess("editor");

  if (!UUID_RE.test(id)) {
    notFound();
  }

  if (!hasSupabaseAdminEnv()) {
    return (
      <div className="grid min-w-0 gap-5">
        <BackLink />
        <div className="rounded-lg border border-[#d7c5ad] bg-white/78 p-8 text-center dark:border-white/10 dark:bg-white/[0.06]">
          <p className="text-sm font-bold text-brand-brown">
            Database is not configured.
          </p>
        </div>
      </div>
    );
  }

  const supabase = getSupabaseAdminClient();
  const tripResult = await supabase
    .from("trips")
    .select(
      "id,destination_id,slug,title,city,summary,overview,badge,duration_days,duration_label,nights,has_flights,hotel_star,price_amount,currency,start_date,travelers_label,latitude,longitude,map_zoom,status,sort_order",
    )
    .eq("id", id)
    .single();

  if (tripResult.error || !tripResult.data) {
    notFound();
  }

  const row = tripResult.data as unknown as TripRow;

  const destinationResult = await supabase
    .from("destinations")
    .select("name,slug,status")
    .eq("id", row.destination_id)
    .maybeSingle();

  const destinationName =
    (destinationResult.data as { name?: string } | null)?.name ?? "";

  const [destinations, inclusions, highlights, exclusions, terms, gallery, itinerary] =
    await Promise.all([
      listAdminTripDestinations(),
      listTripContentItems(row.id, "inclusions"),
      listTripContentItems(row.id, "highlights"),
      listTripContentItems(row.id, "exclusions"),
      listTripContentItems(row.id, "terms"),
      listTripContentItems(row.id, "gallery"),
      listTripContentItems(row.id, "itinerary"),
    ]);

  const initial = {
    id: row.id,
    destinationId: row.destination_id,
    slug: row.slug,
    title: row.title,
    city: row.city ?? "",
    summary: row.summary ?? "",
    overview: row.overview ?? "",
    badge: row.badge ?? "",
    durationDays: row.duration_days,
    durationLabel: row.duration_label ?? "",
    nights: row.nights,
    hasFlights: row.has_flights,
    hotelStar: row.hotel_star,
    priceAmount: Number(row.price_amount),
    currency: row.currency ?? "SAR",
    startDate: row.start_date ?? "",
    travelersLabel: row.travelers_label ?? "",
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    mapZoom: row.map_zoom,
    sortOrder: row.sort_order,
    status: row.status,
  };

  const tripStatus = parseTripStatus(row.status);
  const workspace: AdminTripContentWorkspace = {
    source: "database",
    trips: [{ id: row.id, title: row.title, status: tripStatus }],
    selectedTripId: row.id,
    inclusions: inclusions.map(mapInclusion),
    highlights: highlights.map(mapTextItem),
    exclusions: exclusions.map(mapTextItem),
    terms: terms.map(mapTextItem),
    gallery: gallery.map(mapGallery),
    itinerary: itinerary.map(mapItinerary),
  };

  return (
    <div className="grid min-w-0 gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <BackLink />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-brown">
            Inventory{destinationName ? ` · ${destinationName}` : ""}
          </p>
          <h1 className="font-serif text-2xl font-black tracking-tight">
            {row.title}
          </h1>
        </div>
        <Link
          href={`/admin/trips/${row.id}/preview`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-soft bg-white px-4 text-sm font-black text-brand-navy hover:text-brand-blue dark:bg-white/10 dark:text-brand-sand"
        >
          <ExternalLink aria-hidden="true" className="size-4" />
          Preview as admin
        </Link>
      </div>

      <TripEditor initial={initial} destinations={destinations} />

      <section className="rounded-lg border border-[#d7c5ad] bg-white/78 p-4 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06] sm:p-5">
        <h2 className="mb-1 text-lg font-black">Detail content</h2>
        <p className="mb-4 text-sm font-semibold text-brand-brown">
          Manage highlights, inclusions, gallery and itinerary days for this
          trip. Edits to a published trip become public immediately because
          child content has no draft revisions yet.
        </p>
        <TripContentEditor initialWorkspace={workspace} hideTripSelector />
      </section>
    </div>
  );
}

function parseTripStatus(value: string): "draft" | "published" | "archived" {
  if (value === "published" || value === "archived") {
    return value;
  }
  return "draft";
}

function BackLink() {
  return (
    <Link
      href="/admin/trips"
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border-soft bg-white text-brand-navy dark:bg-white/10 dark:text-white"
      aria-label="Back to trips"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
    </Link>
  );
}

function mapInclusion(
  row: Record<string, string | number | null>,
): AdminTripInclusion {
  return mapTextItem(row);
}

function mapTextItem(
  row: Record<string, string | number | null>,
): AdminTripTextItem {
  return {
    id: String(row.id ?? ""),
    body: String(row.body ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapGallery(
  row: Record<string, string | number | null>,
): AdminTripGalleryItem {
  return {
    id: String(row.id ?? ""),
    src: String(row.src ?? ""),
    altText: String(row.alt_text ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapItinerary(
  row: Record<string, string | number | null>,
): AdminTripItineraryItem {
  const latitude =
    row.latitude == null || row.latitude === "" ? null : Number(row.latitude);
  const longitude =
    row.longitude == null || row.longitude === "" ? null : Number(row.longitude);

  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    locationLabel: row.location_label == null ? "" : String(row.location_label),
    latitude: Number.isFinite(latitude as number) ? (latitude as number) : null,
    longitude: Number.isFinite(longitude as number)
      ? (longitude as number)
      : null,
    zoom: Number(row.zoom ?? 12),
    sortOrder: Number(row.sort_order ?? 0),
  };
}
