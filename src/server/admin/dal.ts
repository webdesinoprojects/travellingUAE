import "server-only";

import { cache } from "react";

import type {
  AdminDashboardDTO,
  AdminDestinationStat,
  AdminMetric,
  AdminPackageCard,
  AdminResourceConfig,
  AdminStatus,
} from "@/features/admin/types";
import { logServerError } from "@/server/http/response";
import {
  getFallbackAdminDashboardDTO,
  getFallbackAdminResourceConfig,
  adminResourceKeys,
} from "@/server/admin/fallback";
import {
  getSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/server/supabase/client";

export type AdminResourceKey = (typeof adminResourceKeys)[number];

type DbTripCard = {
  id: string;
  title: string;
  destination_name: string;
  price_amount: number | string;
  currency: string | null;
  duration_label: string | null;
  duration_days: number;
  status?: AdminStatus;
  card_image_url: string | null;
  card_image_alt: string | null;
};

type DbDestinationCard = {
  id: string;
  name: string;
  country: string | null;
  package_count: number | string | null;
};

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=900&q=82";

export const getAdminDashboardDTO = cache(async (): Promise<AdminDashboardDTO> => {
  const fallback = getFallbackAdminDashboardDTO();

  if (!hasSupabaseAdminEnv()) {
    return fallback;
  }

  try {
    const supabase = getSupabaseAdminClient();
    const [
      tripsCount,
      destinationsCount,
      publishedTripsCount,
      draftTripsCount,
      tripCardsResult,
      destinationCardsResult,
    ] = await Promise.all([
      supabase.from("trips").select("id", { count: "exact", head: true }),
      supabase
        .from("destinations")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("trips")
        .select("id", { count: "exact", head: true })
        .eq("status", "published"),
      supabase
        .from("trips")
        .select("id", { count: "exact", head: true })
        .eq("status", "draft"),
      supabase
        .from("published_trip_cards")
        .select(
          "id,title,destination_name,price_amount,currency,duration_label,duration_days,card_image_url,card_image_alt",
        )
        .limit(3),
      supabase
        .from("published_destination_cards")
        .select("id,name,country,package_count")
        .limit(6),
    ]);

    [
      tripsCount.error,
      destinationsCount.error,
      publishedTripsCount.error,
      draftTripsCount.error,
      tripCardsResult.error,
      destinationCardsResult.error,
    ]
      .filter(Boolean)
      .forEach((error) => {
        throw error;
      });

    const totalTrips = tripsCount.count ?? fallback.packageCards.length;
    const totalDestinations =
      destinationsCount.count ?? fallback.destinationStats.length;
    const publishedTrips =
      publishedTripsCount.count ?? fallback.packageCards.length;
    const draftTrips = draftTripsCount.count ?? 0;
    const packageCards = ((tripCardsResult.data ?? []) as DbTripCard[]).map(
      mapPackageCard,
    );
    const destinationStats = (
      (destinationCardsResult.data ?? []) as DbDestinationCard[]
    ).map(mapDestinationStat);

    return {
      ...fallback,
      metrics: buildMetrics({
        totalTrips,
        totalDestinations,
        publishedTrips,
        draftTrips,
      }),
      packageCards:
        packageCards.length > 0 ? packageCards : fallback.packageCards,
      destinationStats:
        destinationStats.length > 0
          ? destinationStats
          : fallback.destinationStats,
    };
  } catch (error) {
    logServerError("admin.dashboard", error);
    return fallback;
  }
});

export const getAdminResourceDTO = cache(
  async (resource: AdminResourceKey): Promise<AdminResourceConfig> => {
    const fallback = getFallbackAdminResourceConfig(resource);

    if (!hasSupabaseAdminEnv()) {
      return fallback;
    }

    try {
      if (resource === "destinations") {
        return await getDestinationsResource(fallback);
      }

      if (resource === "trips") {
        return await getTripsResource(fallback);
      }

      if (resource === "pages") {
        return await getSimpleResourceRows(fallback, "pages", [
          "title",
          "slug",
          "status",
        ]);
      }

      if (resource === "navigation") {
        return await getSimpleResourceRows(fallback, "navigation_items", [
          "label",
          "location",
          "href",
          "status",
        ]);
      }

      return fallback;
    } catch (error) {
      logServerError(`admin.resource.${resource}`, error);
      return fallback;
    }
  },
);

export function isAdminResource(value: string): value is AdminResourceKey {
  return adminResourceKeys.includes(value as AdminResourceKey);
}

export function getAdminResourceKeys() {
  return adminResourceKeys;
}

function buildMetrics({
  totalTrips,
  totalDestinations,
  publishedTrips,
  draftTrips,
}: {
  totalTrips: number;
  totalDestinations: number;
  publishedTrips: number;
  draftTrips: number;
}): AdminMetric[] {
  return [
    {
      label: "Live packages",
      value: String(publishedTrips),
      change: `${draftTrips} drafts`,
      helper: "Published inventory available to public pages",
      tone: "navy",
    },
    {
      label: "Destinations",
      value: String(totalDestinations),
      change: "+CMS",
      helper: "Country and city records in Supabase",
      tone: "blue",
    },
    {
      label: "Total trips",
      value: String(totalTrips),
      change: "dynamic",
      helper: "Counts are read from the backend when configured",
      tone: "sky",
    },
    {
      label: "Review queue",
      value: String(draftTrips),
      change: "draft",
      helper: "Draft packages waiting for content review",
      tone: "sand",
    },
  ];
}

function mapPackageCard(row: DbTripCard): AdminPackageCard {
  const duration = row.duration_label ?? `${row.duration_days} days`;

  return {
    title: row.title,
    destination: row.destination_name,
    price: formatMoney(row.price_amount, row.currency ?? "SAR"),
    duration,
    status: "published",
    image: row.card_image_url ?? FALLBACK_IMAGE,
    alt: row.card_image_alt ?? `${row.title} package image`,
  };
}

function mapDestinationStat(row: DbDestinationCard): AdminDestinationStat {
  const packages = Number(row.package_count ?? 0);

  return {
    name: row.name,
    country: row.country ?? row.name,
    packages,
    bookings: 0,
    completion: Math.min(100, Math.max(18, packages * 8)),
  };
}

async function getDestinationsResource(
  fallback: AdminResourceConfig,
): Promise<AdminResourceConfig> {
  const supabase = getSupabaseAdminClient();
  const result = await supabase
    .from("published_destination_cards")
    .select("id,name,country,package_count")
    .order("name", { ascending: true });

  if (result.error) {
    throw result.error;
  }

  const rows = ((result.data ?? []) as DbDestinationCard[]).map((row) => ({
    id: row.id,
    name: row.name,
    country: row.country ?? row.name,
    packages: Number(row.package_count ?? 0),
    bookings: 0,
    status: "published",
  }));

  return rows.length > 0 ? { ...fallback, rows } : fallback;
}

async function getTripsResource(
  fallback: AdminResourceConfig,
): Promise<AdminResourceConfig> {
  const supabase = getSupabaseAdminClient();
  const result = await supabase
    .from("published_trip_cards")
    .select(
      "id,title,destination_name,price_amount,currency,duration_label,duration_days",
    )
    .order("title", { ascending: true });

  if (result.error) {
    throw result.error;
  }

  const rows = ((result.data ?? []) as DbTripCard[]).map((row) => ({
    id: row.id,
    title: row.title,
    destination: row.destination_name,
    duration: row.duration_label ?? `${row.duration_days} days`,
    price: formatMoney(row.price_amount, row.currency ?? "SAR"),
    status: "published",
  }));

  return rows.length > 0 ? { ...fallback, rows } : fallback;
}

async function getSimpleResourceRows(
  fallback: AdminResourceConfig,
  table: string,
  columns: string[],
): Promise<AdminResourceConfig> {
  const supabase = getSupabaseAdminClient();
  const safeColumns = columns.includes("id") ? columns : ["id", ...columns];
  const result = await supabase.from(table).select(safeColumns.join(",")).limit(50);

  if (result.error) {
    throw result.error;
  }

  const rows = (result.data ?? []) as unknown as AdminResourceConfig["rows"];

  return rows.length > 0 ? { ...fallback, rows } : fallback;
}

function formatMoney(value: number | string, currency: string) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return `${currency} 0`;
  }

  return `${currency} ${numeric.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
}
