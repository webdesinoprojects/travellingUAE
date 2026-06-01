import "server-only";

import { cache } from "react";

import type {
  AdminActivity,
  AdminBooking,
  AdminChartPoint,
  AdminDashboardDTO,
  AdminDestinationStat,
  AdminFinanceItem,
  AdminMetric,
  AdminPackageCard,
  AdminPieSegment,
  AdminQueueItem,
  AdminResourceConfig,
  AdminStatus,
  AdminTripHealth,
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
import {
  listAdminResourceRows,
  decodeCursor,
  encodeCursor,
  type ListParams,
} from "@/server/admin/resources";

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


type DbBookingRow = {
  id: string;
  customer_name: string;
  travelers_count: number | string;
  travel_date: string | null;
  status: AdminStatus;
};

type DbDashboardSnapshot = {
  tripCounts?: {
    total?: number | string;
    published?: number | string;
    draft?: number | string;
    archived?: number | string;
  };
  destinationCounts?: {
    total?: number | string;
  };
  bookingCounts?: {
    total?: number | string;
    new_count?: number | string;
    contacted?: number | string;
    confirmed?: number | string;
    completed?: number | string;
    cancelled?: number | string;
  };
  contentCounts?: {
    draft_pages?: number | string;
    draft_translations?: number | string;
    draft_sections?: number | string;
  };
  analytics?: Partial<Record<"week" | "month" | "year", DbAnalyticsPoint[]>>;
  destinations?: DbDestinationAggregate[];
  activity?: DbActivityRow[];
};

type DbAnalyticsPoint = {
  label?: string;
  enquiries?: number | string;
  converted?: number | string;
};

type DbDestinationAggregate = {
  name?: string;
  country?: string;
  packages?: number | string;
  bookings?: number | string;
};

type DbActivityRow = {
  action?: string;
  entity?: string;
  createdAt?: string;
};

type DashboardSummary = {
  tripCounts: AdminTripHealth;
  destinationCount: number;
  bookingCounts: {
    total: number;
    new: number;
    contacted: number;
    confirmed: number;
    completed: number;
    cancelled: number;
  };
  contentCounts: {
    pages: number;
    translations: number;
    sections: number;
  };
  analytics: AdminDashboardDTO["analytics"];
  destinations: AdminDestinationStat[];
  activity: AdminActivity[];
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
      dashboardSnapshotResult,
      tripCardsResult,
      bookingsResult,
    ] = await Promise.all([
      supabase.rpc("admin_dashboard_snapshot"),
      supabase
        .from("published_trip_cards")
        .select(
          "id,title,destination_name,price_amount,currency,duration_label,duration_days,card_image_url,card_image_alt",
        )
        .limit(3),
      supabase
        .from("bookings")
        .select("id,customer_name,travelers_count,travel_date,status")
        .order("created_at", { ascending: false })
        .limit(4),
    ]);

    [
      dashboardSnapshotResult.error,
      tripCardsResult.error,
      bookingsResult.error,
    ]
      .filter(Boolean)
      .forEach((error) => {
        throw error;
      });

    const summary = mapDashboardSnapshot(
      dashboardSnapshotResult.data as DbDashboardSnapshot | null,
    );
    const packageCards = ((tripCardsResult.data ?? []) as DbTripCard[]).map(
      mapPackageCard,
    );
    const bookings = ((bookingsResult.data ?? []) as DbBookingRow[]).map(
      mapBookingRow,
    );

    return {
      ...fallback,
      dataSource: "database",
      metrics: buildMetrics(summary),
      finance: buildFinance(fallback.finance, summary),
      analytics: summary.analytics,
      pieSegments: buildPieSegments(summary),
      activePipelinePercent: buildActivePipelinePercent(summary),
      tripHealth: summary.tripCounts,
      packageCards,
      destinationStats: summary.destinations,
      bookings,
      activityFeed: summary.activity,
      contentQueue: buildContentQueue(summary),
    };
  } catch (error) {
    logServerError("admin.dashboard", error);
    return fallback;
  }
});

const OPERATIONAL_RESOURCES = new Set<AdminResourceKey>([
  "bookings",
  "destinations",
  "categories",
  "trips",
  "media",
]);

function emptyOperationalConfig(fallback: AdminResourceConfig): AdminResourceConfig {
  return {
    ...fallback,
    rows: [],
    pageInfo: { nextCursor: null, hasMore: false },
  };
}

export const getAdminResourceDTO = cache(
  async (
    resource: AdminResourceKey,
    params: ListParams = {},
  ): Promise<AdminResourceConfig> => {
    const fallback = getFallbackAdminResourceConfig(resource);

    if (!hasSupabaseAdminEnv()) {
      if (OPERATIONAL_RESOURCES.has(resource)) {
        return emptyOperationalConfig(fallback);
      }
      return fallback;
    }

    try {
      if (resource === "destinations") {
        return await getDestinationsResource(fallback, params);
      }

      if (resource === "categories") {
        return await getCategoriesResource(fallback, params);
      }

      if (resource === "trips") {
        return await getTripsResource(fallback, params);
      }

      if (resource === "media") {
        return await getMediaResource(fallback, params);
      }

      if (resource === "audit-log") {
        return await getAuditLogResource(fallback);
      }

      if (resource !== "settings") {
        const result = await listAdminResourceRows(resource, params);

        if (result) {
          return {
            ...fallback,
            rows: result.rows,
            pageInfo: {
              nextCursor: result.nextCursor,
              hasMore: result.hasMore,
            },
          };
        }
      }

      return fallback;
    } catch (error) {
      logServerError(`admin.resource.${resource}`, error);
      if (OPERATIONAL_RESOURCES.has(resource)) {
        return emptyOperationalConfig(fallback);
      }
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

function buildMetrics(summary: DashboardSummary): AdminMetric[] {
  return [
    {
      label: "Live packages",
      value: String(summary.tripCounts.published),
      change: `${summary.tripCounts.draft} drafts`,
      helper: "Published inventory available to public pages",
      tone: "navy",
    },
    {
      label: "Destinations",
      value: String(summary.destinationCount),
      change: "managed",
      helper: "Country and city records in Supabase",
      tone: "blue",
    },
    {
      label: "New enquiries",
      value: String(summary.bookingCounts.new),
      change: `${summary.bookingCounts.contacted} contacted`,
      helper: "Requests requiring travel-desk follow-up",
      tone: "sky",
    },
    {
      label: "Review queue",
      value: String(
        summary.tripCounts.draft +
          summary.contentCounts.pages +
          summary.contentCounts.translations +
          summary.contentCounts.sections,
      ),
      change: "drafts",
      helper: "Packages and CMS content awaiting publication",
      tone: "sand",
    },
  ];
}

function buildFinance(
  template: AdminFinanceItem[],
  summary: DashboardSummary,
): AdminFinanceItem[] {
  const active =
    summary.bookingCounts.new + summary.bookingCounts.contacted;
  const completed =
    summary.bookingCounts.confirmed + summary.bookingCounts.completed;
  const values = [
    {
      label: "Total enquiries",
      value: String(summary.bookingCounts.total),
    },
    { label: "Active cases", value: String(active) },
    { label: "Converted", value: String(completed) },
  ];

  return template.slice(0, values.length).map((item, index) => ({
    ...item,
    ...values[index],
  }));
}

function buildPieSegments(summary: DashboardSummary): AdminPieSegment[] {
  const total = Math.max(summary.bookingCounts.total, 1);
  const statuses = [
    {
      label: "Confirmed",
      count: summary.bookingCounts.confirmed,
      color: "#071739",
    },
    {
      label: "Contacted",
      count: summary.bookingCounts.contacted,
      color: "#123f76",
    },
    { label: "New", count: summary.bookingCounts.new, color: "#c2e8ff" },
    {
      label: "Completed",
      count: summary.bookingCounts.completed,
      color: "#a68768",
    },
    {
      label: "Cancelled",
      count: summary.bookingCounts.cancelled,
      color: "#e3c39d",
    },
  ];

  return statuses.map(({ label, count, color }) => ({
    label,
    value: summary.bookingCounts.total === 0 ? 0 : Math.round((count / total) * 100),
    color,
  }));
}

function buildActivePipelinePercent(summary: DashboardSummary) {
  if (summary.bookingCounts.total === 0) {
    return 0;
  }

  const active =
    summary.bookingCounts.new +
    summary.bookingCounts.contacted +
    summary.bookingCounts.confirmed;

  return Math.round((active / summary.bookingCounts.total) * 100);
}

function buildContentQueue(summary: DashboardSummary): AdminQueueItem[] {
  return [
    {
      title: "Trip drafts",
      owner: "Packages",
      status: summary.tripCounts.draft > 0 ? "draft" : "published",
      due: `${summary.tripCounts.draft} pending`,
    },
    {
      title: "Page drafts",
      owner: "CMS",
      status: summary.contentCounts.pages > 0 ? "draft" : "published",
      due: `${summary.contentCounts.pages} pending`,
    },
    {
      title: "Translation drafts",
      owner: "Locales",
      status: summary.contentCounts.translations > 0 ? "draft" : "published",
      due: `${summary.contentCounts.translations} pending`,
    },
    {
      title: "Homepage section drafts",
      owner: "Marketing",
      status: summary.contentCounts.sections > 0 ? "draft" : "published",
      due: `${summary.contentCounts.sections} pending`,
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

function mapBookingRow(row: DbBookingRow): AdminBooking {
  return {
    id: row.id,
    guest: row.customer_name,
    packageName: "Travel enquiry",
    destination: "Private enquiry",
    travelDate: row.travel_date ?? "Date pending",
    travelers: Number(row.travelers_count),
    value: "Quote pending",
    status: row.status,
  };
}

function mapDashboardSnapshot(
  snapshot: DbDashboardSnapshot | null,
): DashboardSummary {
  if (!snapshot) {
    throw new Error("Admin dashboard summary was not returned.");
  }

  const tripCounts = snapshot.tripCounts ?? {};
  const bookingCounts = snapshot.bookingCounts ?? {};
  const contentCounts = snapshot.contentCounts ?? {};
  const destinations = (snapshot.destinations ?? []).map((row) => ({
    name: requiredText(row.name, "destination name"),
    country: requiredText(row.country, "destination country"),
    packages: safeCount(row.packages),
    bookings: safeCount(row.bookings),
    completion: 0,
  }));
  const largestBookingCount = Math.max(
    1,
    ...destinations.map((row) => row.bookings),
  );
  const largestPackageCount = Math.max(
    1,
    ...destinations.map((row) => row.packages),
  );

  return {
    tripCounts: {
      total: safeCount(tripCounts.total),
      published: safeCount(tripCounts.published),
      draft: safeCount(tripCounts.draft),
      archived: safeCount(tripCounts.archived),
    },
    destinationCount: safeCount(snapshot.destinationCounts?.total),
    bookingCounts: {
      total: safeCount(bookingCounts.total),
      new: safeCount(bookingCounts.new_count),
      contacted: safeCount(bookingCounts.contacted),
      confirmed: safeCount(bookingCounts.confirmed),
      completed: safeCount(bookingCounts.completed),
      cancelled: safeCount(bookingCounts.cancelled),
    },
    contentCounts: {
      pages: safeCount(contentCounts.draft_pages),
      translations: safeCount(contentCounts.draft_translations),
      sections: safeCount(contentCounts.draft_sections),
    },
    analytics: {
      week: mapAnalytics(snapshot.analytics?.week),
      month: mapAnalytics(snapshot.analytics?.month),
      year: mapAnalytics(snapshot.analytics?.year),
    },
    destinations: destinations.map((row) => ({
      ...row,
      completion: Math.round(
        ((row.bookings > 0 ? row.bookings : row.packages) /
          (row.bookings > 0 ? largestBookingCount : largestPackageCount)) *
          100,
      ),
    })),
    activity: (snapshot.activity ?? []).map(mapActivityRow),
  };
}

function mapAnalytics(rows: DbAnalyticsPoint[] | undefined): AdminChartPoint[] {
  return (rows ?? []).map((row) => ({
    label: requiredText(row.label, "analytics label"),
    enquiries: safeCount(row.enquiries),
    converted: safeCount(row.converted),
  }));
}

function mapActivityRow(row: DbActivityRow, index: number): AdminActivity {
  const action = requiredText(row.action, "activity action");
  const entity = friendlyEntity(row.entity);
  const tones: AdminActivity["tone"][] = ["blue", "sand", "sky"];

  return {
    title: friendlyAction(action),
    description: `${entity} record change logged through the protected admin service.`,
    time: formatActivityTime(row.createdAt),
    tone: tones[index % tones.length],
  };
}

function friendlyAction(action: string) {
  if (action.includes(".create")) {
    return "Record created";
  }

  if (action.includes(".update")) {
    return "Record updated";
  }

  if (action.includes(".delete") || action.includes(".archive")) {
    return "Record archived";
  }

  return "Administrative action recorded";
}

function friendlyEntity(entity: string | undefined) {
  const labels: Record<string, string> = {
    bookings: "Booking",
    pages: "Page",
    translations: "Translation",
    trips: "Trip",
    trip_gallery: "Gallery",
    trip_inclusions: "Inclusion",
    trip_itinerary_days: "Itinerary",
    itinerary_segments: "Itinerary segment",
    activity_options: "Activity option",
  };

  return labels[entity ?? ""] ?? "Content";
}

function formatActivityTime(value: string | undefined) {
  if (!value) {
    return "Logged";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Logged";
  }

  return `${date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  })} UTC`;
}

function safeCount(value: number | string | undefined) {
  const numeric = Number(value ?? 0);

  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error("Admin dashboard returned an invalid aggregate count.");
  }

  return Math.trunc(numeric);
}

function requiredText(value: string | undefined, field: string) {
  if (!value || !value.trim()) {
    throw new Error(`Admin dashboard returned an invalid ${field}.`);
  }

  return value;
}

type DbDestinationRow = {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
  status: string;
  updated_at: string | null;
  trips?: { count: number }[];
};

type DbCategoryRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  updated_at: string | null;
  trip_categories: { count: number }[];
};

const DESTINATION_COLUMNS = [
  { key: "name", label: "Destination" },
  { key: "country", label: "Country" },
  { key: "packages", label: "Packages" },
  { key: "status", label: "Status" },
];

async function getDestinationsResource(
  fallback: AdminResourceConfig,
  params: ListParams,
): Promise<AdminResourceConfig> {
  const supabase = getSupabaseAdminClient();
  const pageSize = Math.min(Math.max(Number(params.limit ?? 25) || 25, 1), 100);
  let query = supabase
    .from("destinations")
    .select("id,name,country,city,status,updated_at,trips(count)")
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(pageSize + 1);

  const q = params.q?.trim();

  if (q) {
    const escaped = q.replace(/[%_]/g, "\\$&");
    query = query.or(
      `name.ilike.%${escaped}%,country.ilike.%${escaped}%,city.ilike.%${escaped}%`,
    );
  }

  if (params.status && ["draft", "published", "archived"].includes(params.status)) {
    query = query.eq("status", params.status);
  }

  const decoded = params.cursor ? decodeCursor(params.cursor) : null;

  if (decoded) {
    query = query.or(
      `updated_at.lt.${decoded.ts},and(updated_at.eq.${decoded.ts},id.lt.${decoded.id})`,
    );
  }

  const result = await query;

  if (result.error) {
    throw result.error;
  }

  const allRows = (result.data ?? []) as unknown as DbDestinationRow[];
  const hasMore = allRows.length > pageSize;
  const pageRows = hasMore ? allRows.slice(0, pageSize) : allRows;

  const rows = pageRows.map((row) => ({
    id: row.id,
    name: row.name,
    country: row.country ?? row.name,
    packages: Number(row.trips?.[0]?.count ?? 0),
    status: row.status,
  }));

  const lastRow = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && lastRow
      ? encodeCursor({ updated_at: lastRow.updated_at ?? "", id: lastRow.id }, "updated_at")
      : null;

  return {
    ...fallback,
    columns: DESTINATION_COLUMNS,
    rows,
    pageInfo: { nextCursor, hasMore },
  };
}

async function getCategoriesResource(
  fallback: AdminResourceConfig,
  params: ListParams,
): Promise<AdminResourceConfig> {
  const supabase = getSupabaseAdminClient();
  const pageSize = Math.min(Math.max(Number(params.limit ?? 25) || 25, 1), 100);
  let query = supabase
    .from("categories")
    .select("id,name,slug,status,updated_at,trip_categories(count)")
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(pageSize + 1);

  const q = params.q?.trim();

  if (q) {
    const escaped = q.replace(/[%_]/g, "\\$&");
    query = query.ilike("name", `%${escaped}%`);
  }

  if (params.status && ["draft", "published", "archived"].includes(params.status)) {
    query = query.eq("status", params.status);
  }

  const decoded = params.cursor ? decodeCursor(params.cursor) : null;

  if (decoded) {
    query = query.or(
      `updated_at.lt.${decoded.ts},and(updated_at.eq.${decoded.ts},id.lt.${decoded.id})`,
    );
  }

  const result = await query;

  if (result.error) {
    throw result.error;
  }

  const allRows = (result.data ?? []) as unknown as DbCategoryRow[];
  const hasMore = allRows.length > pageSize;
  const pageRows = hasMore ? allRows.slice(0, pageSize) : allRows;

  const rows = pageRows.map((row) => ({
    id: row.id,
    name: row.name,
    items: Number(row.trip_categories?.[0]?.count ?? 0),
    status: row.status,
  }));

  const lastRow = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && lastRow
      ? encodeCursor({ updated_at: lastRow.updated_at ?? "", id: lastRow.id }, "updated_at")
      : null;

  return {
    ...fallback,
    title: "Categories",
    description: "Create and manage trip categories. Trip assignment counts reflect live joins.",
    columns: [
      { key: "name", label: "Name" },
      { key: "items", label: "Linked trips" },
      { key: "status", label: "Status" },
    ],
    rows,
    pageInfo: { nextCursor, hasMore },
  };
}

type DbAdminTripRow = {
  id: string;
  title: string;
  duration_days: number;
  duration_label: string | null;
  price_amount: number | string;
  currency: string | null;
  status: string;
  updated_at: string | null;
  destinations?: { name: string | null } | null;
};

const TRIP_COLUMNS = [
  { key: "title", label: "Trip" },
  { key: "destination", label: "Destination" },
  { key: "duration", label: "Duration" },
  { key: "price", label: "Price" },
  { key: "status", label: "Status" },
];

async function getTripsResource(
  fallback: AdminResourceConfig,
  params: ListParams,
): Promise<AdminResourceConfig> {
  const supabase = getSupabaseAdminClient();
  const pageSize = Math.min(Math.max(Number(params.limit ?? 25) || 25, 1), 100);
  let query = supabase
    .from("trips")
    .select(
      "id,title,duration_days,duration_label,price_amount,currency,status,updated_at,destinations(name)",
    )
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(pageSize + 1);

  const q = params.q?.trim();

  if (q) {
    const escaped = q.replace(/[%_]/g, "\\$&");
    query = query.or(
      `title.ilike.%${escaped}%,city.ilike.%${escaped}%`,
    );
  }

  if (params.status && ["draft", "published", "archived"].includes(params.status)) {
    query = query.eq("status", params.status);
  }

  const decoded = params.cursor ? decodeCursor(params.cursor) : null;

  if (decoded) {
    query = query.or(
      `updated_at.lt.${decoded.ts},and(updated_at.eq.${decoded.ts},id.lt.${decoded.id})`,
    );
  }

  const result = await query;

  if (result.error) {
    throw result.error;
  }

  const allRows = (result.data ?? []) as unknown as DbAdminTripRow[];
  const hasMore = allRows.length > pageSize;
  const pageRows = hasMore ? allRows.slice(0, pageSize) : allRows;

  const rows = pageRows.map((row) => ({
    id: row.id,
    title: row.title,
    destination: row.destinations?.name ?? "—",
    duration: row.duration_label ?? `${row.duration_days} days`,
    price: formatMoney(row.price_amount, row.currency ?? "SAR"),
    status: row.status,
  }));

  const lastRow = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && lastRow
      ? encodeCursor(
          { updated_at: lastRow.updated_at ?? "", id: lastRow.id },
          "updated_at",
        )
      : null;

  return {
    ...fallback,
    columns: TRIP_COLUMNS,
    rows,
    pageInfo: { nextCursor, hasMore },
  };
}

type DbMediaRow = {
  id: string;
  provider: string;
  public_id: string | null;
  url: string;
  secure_url: string | null;
  alt_text: string | null;
  width: number | null;
  height: number | null;
  bytes: number | string | null;
  format: string | null;
  folder: string | null;
  status: string;
  updated_at: string | null;
  metadata: Record<string, unknown> | null;
};

const MEDIA_COLUMNS = [
  { key: "name", label: "Asset" },
  { key: "folder", label: "Folder" },
  { key: "provider", label: "Provider" },
  { key: "status", label: "Status" },
];

async function getMediaResource(
  fallback: AdminResourceConfig,
  params: ListParams,
): Promise<AdminResourceConfig> {
  const supabase = getSupabaseAdminClient();
  const pageSize = Math.min(Math.max(Number(params.limit ?? 25) || 25, 1), 100);
  let query = supabase
    .from("media_assets")
    .select(
      "id,provider,public_id,url,secure_url,alt_text,width,height,bytes,format,folder,status,updated_at,metadata",
    )
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(pageSize + 1);

  const q = params.q?.trim();

  if (q) {
    const escaped = q.replace(/[%_]/g, "\\$&");
    query = query.or(
      `alt_text.ilike.%${escaped}%,public_id.ilike.%${escaped}%,folder.ilike.%${escaped}%`,
    );
  }

  if (
    params.status &&
    ["draft", "published", "archived"].includes(params.status)
  ) {
    query = query.eq("status", params.status);
  }

  const folder = params.folder?.trim();

  if (folder) {
    query = query.eq("folder", folder);
  }

  const decoded = params.cursor ? decodeCursor(params.cursor) : null;

  if (decoded) {
    query = query.or(
      `updated_at.lt.${decoded.ts},and(updated_at.eq.${decoded.ts},id.lt.${decoded.id})`,
    );
  }

  const result = await query;

  if (result.error) {
    throw result.error;
  }

  const allRows = (result.data ?? []) as unknown as DbMediaRow[];
  const hasMore = allRows.length > pageSize;
  const pageRows = hasMore ? allRows.slice(0, pageSize) : allRows;

  const rows = pageRows.map((row) => ({
    id: row.id,
    name:
      row.public_id ||
      (row.metadata?.name as string | undefined) ||
      row.url.split("/").pop() ||
      "Asset",
    altText: row.alt_text ?? "",
    folder: row.folder ?? "",
    provider: row.provider,
    width: row.width ?? 0,
    height: row.height ?? 0,
    bytes: row.bytes == null ? 0 : Number(row.bytes),
    format: row.format ?? "",
    url: row.secure_url ?? row.url,
    thumbnailUrl:
      (row.metadata?.thumbnailUrl as string | undefined) ??
      row.secure_url ??
      row.url,
    status: row.status,
  }));

  const lastRow = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && lastRow
      ? encodeCursor(
          { updated_at: lastRow.updated_at ?? "", id: lastRow.id },
          "updated_at",
        )
      : null;

  return {
    ...fallback,
    columns: MEDIA_COLUMNS,
    rows,
    pageInfo: { nextCursor, hasMore },
  };
}

async function getAuditLogResource(
  fallback: AdminResourceConfig,
): Promise<AdminResourceConfig> {
  const supabase = getSupabaseAdminClient();
  const result = await supabase
    .from("audit_log")
    .select("id,action,entity_table,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (result.error) {
    throw result.error;
  }

  const rows = (result.data ?? []).map((row) => ({
    id: row.id,
    action: row.action,
    actor: "Authenticated admin",
    entity: row.entity_table,
    time: row.created_at,
  }));

  return { ...fallback, rows };
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
