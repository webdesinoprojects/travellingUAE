import "server-only";

import { writeAdminAuditLog } from "@/server/admin/audit";
import { requireTrustedPublicMediaUrl } from "@/server/cms/hero";
import {
  readJsonObject,
  readNumber,
  readString,
  type UnknownRecord,
} from "@/server/http/validation";
import {
  getSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/server/supabase/client";
import type { AdminActor } from "@/server/supabase/auth";
import type {
  AdminTripContentTrip,
  AdminTripContentWorkspace,
  AdminTripGalleryItem,
  AdminTripInclusion,
  AdminTripItineraryItem,
  AdminTripTextItem,
} from "@/types/admin-trip-content";

export type TripContentType =
  | "inclusions"
  | "highlights"
  | "exclusions"
  | "terms"
  | "gallery"
  | "itinerary";

type ContentDefinition = {
  table: string;
  select: string;
  build: (body: UnknownRecord, required: boolean) => Record<string, unknown>;
};

type AdminContentResult = {
  action: "created" | "updated" | "deleted";
  row: Record<string, string | number | null>;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CONTENT_DEFINITIONS: Record<TripContentType, ContentDefinition> = {
  inclusions: {
    table: "trip_inclusions",
    select: "id,trip_id,body,sort_order",
    build: buildTextPayload,
  },
  highlights: {
    table: "trip_highlights",
    select: "id,trip_id,body,sort_order",
    build: buildTextPayload,
  },
  exclusions: {
    table: "trip_exclusions",
    select: "id,trip_id,body,sort_order",
    build: buildTextPayload,
  },
  terms: {
    table: "trip_terms",
    select: "id,trip_id,body,sort_order",
    build: buildTextPayload,
  },
  gallery: {
    table: "trip_gallery",
    select: "id,trip_id,src,alt_text,sort_order",
    build: buildGalleryPayload,
  },
  itinerary: {
    table: "trip_itinerary_items",
    select:
      "id,trip_id,title,body,location_label,latitude,longitude,zoom,sort_order",
    build: buildItineraryPayload,
  },
};

export async function getAdminTripContentWorkspace(): Promise<AdminTripContentWorkspace> {
  if (!hasSupabaseAdminEnv()) {
    return {
      source: "unconfigured",
      trips: [],
      selectedTripId: null,
      inclusions: [],
      highlights: [],
      exclusions: [],
      terms: [],
      gallery: [],
      itinerary: [],
    };
  }

  const tripsResult = await getSupabaseAdminClient()
    .from("trips")
    .select("id,title,status")
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (tripsResult.error) {
    throw tripsResult.error;
  }

  const trips = (tripsResult.data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
  })) as AdminTripContentTrip[];
  const selectedTripId = trips[0]?.id ?? null;

  if (!selectedTripId) {
    return {
      source: "database",
      trips,
      selectedTripId: null,
      inclusions: [],
      highlights: [],
      exclusions: [],
      terms: [],
      gallery: [],
      itinerary: [],
    };
  }

  const [inclusions, highlights, exclusions, terms, gallery, itinerary] =
    await Promise.all([
      listTripContentItems(selectedTripId, "inclusions"),
      listTripContentItems(selectedTripId, "highlights"),
      listTripContentItems(selectedTripId, "exclusions"),
      listTripContentItems(selectedTripId, "terms"),
      listTripContentItems(selectedTripId, "gallery"),
      listTripContentItems(selectedTripId, "itinerary"),
    ]);

  return {
    source: "database",
    trips,
    selectedTripId,
    inclusions: inclusions.map(mapInclusion),
    highlights: highlights.map(mapTextItem),
    exclusions: exclusions.map(mapTextItem),
    terms: terms.map(mapTextItem),
    gallery: gallery.map(mapGallery),
    itinerary: itinerary.map(mapItinerary),
  };
}

export async function listTripContentItems(
  tripId: string,
  type: TripContentType,
) {
  const safeTripId = requireUuid(tripId);
  const definition = CONTENT_DEFINITIONS[type];
  await assertTripExists(safeTripId);

  const result = await getAdminClient()
    .from(definition.table)
    .select(definition.select)
    .eq("trip_id", safeTripId)
    .order("sort_order", { ascending: true })
    .limit(100);

  if (result.error) {
    throw result.error;
  }

  return (result.data ?? []).map((row) => safeRow(normalizeRow(row)));
}

export async function createTripContentItem(
  tripId: string,
  type: TripContentType,
  request: Request,
  actor: AdminActor,
): Promise<AdminContentResult> {
  const safeTripId = requireUuid(tripId);
  const definition = CONTENT_DEFINITIONS[type];
  const body = await readJsonObject(request);
  await assertTripExists(safeTripId);

  const result = await getAdminClient()
    .from(definition.table)
    .insert({ ...definition.build(body, true), trip_id: safeTripId })
    .select(definition.select)
    .single();

  if (result.error) {
    throw result.error;
  }

  const row = normalizeRow(result.data);

  await writeAdminAuditLog({
    actor,
    action: `trip.content.${type}.create`,
    table: definition.table,
    entityId: stringValue(row.id),
    before: null,
    after: safeAuditValue(row),
  });

  return { action: "created", row: safeRow(row) };
}

export async function updateTripContentItem(
  tripId: string,
  type: TripContentType,
  itemId: string,
  request: Request,
  actor: AdminActor,
): Promise<AdminContentResult> {
  const safeTripId = requireUuid(tripId);
  const safeItemId = requireUuid(itemId);
  const definition = CONTENT_DEFINITIONS[type];
  const body = await readJsonObject(request);
  const payload = definition.build(body, false);

  if (Object.keys(payload).length === 0) {
    throw new Error("No supported fields were provided");
  }

  const before = await getContentItem(definition, safeTripId, safeItemId);
  const result = await getAdminClient()
    .from(definition.table)
    .update(payload)
    .eq("trip_id", safeTripId)
    .eq("id", safeItemId)
    .select(definition.select)
    .single();

  if (result.error) {
    throw result.error;
  }

  const row = normalizeRow(result.data);

  await writeAdminAuditLog({
    actor,
    action: `trip.content.${type}.update`,
    table: definition.table,
    entityId: safeItemId,
    before: safeAuditValue(before),
    after: safeAuditValue(row),
  });

  return { action: "updated", row: safeRow(row) };
}

export async function deleteTripContentItem(
  tripId: string,
  type: TripContentType,
  itemId: string,
  actor: AdminActor,
): Promise<AdminContentResult> {
  const safeTripId = requireUuid(tripId);
  const safeItemId = requireUuid(itemId);
  const definition = CONTENT_DEFINITIONS[type];
  const before = await getContentItem(definition, safeTripId, safeItemId);
  const result = await getAdminClient()
    .from(definition.table)
    .delete()
    .eq("trip_id", safeTripId)
    .eq("id", safeItemId)
    .select(definition.select)
    .single();

  if (result.error) {
    throw result.error;
  }

  const row = normalizeRow(result.data);

  await writeAdminAuditLog({
    actor,
    action: `trip.content.${type}.delete`,
    table: definition.table,
    entityId: safeItemId,
    before: safeAuditValue(before),
    after: null,
  });

  return { action: "deleted", row: safeRow(row) };
}

export function parseTripContentType(value: string): TripContentType | undefined {
  if (
    value === "inclusions" ||
    value === "highlights" ||
    value === "exclusions" ||
    value === "terms" ||
    value === "gallery" ||
    value === "itinerary"
  ) {
    return value;
  }

  return undefined;
}

function getAdminClient() {
  if (!hasSupabaseAdminEnv()) {
    throw new Error("Admin database is not configured");
  }

  return getSupabaseAdminClient();
}

async function assertTripExists(tripId: string) {
  const result = await getAdminClient()
    .from("trips")
    .select("id")
    .eq("id", tripId)
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  if (!result.data) {
    throw new Error("Trip was not found");
  }
}

async function getContentItem(
  definition: ContentDefinition,
  tripId: string,
  itemId: string,
) {
  const result = await getAdminClient()
    .from(definition.table)
    .select(definition.select)
    .eq("trip_id", tripId)
    .eq("id", itemId)
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  if (!result.data) {
    throw new Error("Trip content item was not found");
  }

  return normalizeRow(result.data);
}

function buildTextPayload(body: UnknownRecord, required: boolean) {
  return pickDefined({
    body: readString(body, "body", { min: 2, max: 1000, required }),
    sort_order: readNumber(body, "sortOrder", { min: 0, max: 1000 }),
  });
}

function buildGalleryPayload(body: UnknownRecord, required: boolean) {
  const src = readString(body, "src", { min: 12, max: 1200, required });

  if (src) {
    requireTrustedPublicMediaUrl(src);
  }

  return pickDefined({
    src,
    alt_text: readString(body, "altText", { min: 4, max: 240, required }),
    sort_order: readNumber(body, "sortOrder", { min: 0, max: 1000 }),
  });
}

function buildItineraryPayload(body: UnknownRecord, required: boolean) {
  return pickDefined({
    title: readString(body, "title", { min: 2, max: 180, required }),
    body: readString(body, "body", { min: 2, max: 3000, required }),
    location_label: readNullableString(body, "locationLabel", 180),
    latitude: readNullableNumber(body, "latitude", -90, 90),
    longitude: readNullableNumber(body, "longitude", -180, 180),
    zoom: readNumber(body, "zoom", { min: 1, max: 18 }),
    sort_order: readNumber(body, "sortOrder", { min: 0, max: 1000 }),
  });
}

function requireUuid(value: string) {
  if (!UUID_RE.test(value)) {
    throw new Error("Invalid record id");
  }

  return value;
}

function normalizeRow(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid database response");
  }

  return value as Record<string, unknown>;
}

function safeAuditValue(row: Record<string, unknown>) {
  return safeRow(row);
}

function safeRow(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).filter(
      ([, value]) =>
        value == null ||
        typeof value === "string" ||
        typeof value === "number",
    ),
  ) as Record<string, string | number | null>;
}

function pickDefined(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  );
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : String(value ?? "");
}

function readNullableString(body: UnknownRecord, key: string, max: number) {
  if (!Object.prototype.hasOwnProperty.call(body, key)) {
    return undefined;
  }

  if (body[key] === "" || body[key] === null) {
    return null;
  }

  return readString(body, key, { max });
}

function readNullableNumber(
  body: UnknownRecord,
  key: string,
  min: number,
  max: number,
) {
  if (!Object.prototype.hasOwnProperty.call(body, key)) {
    return undefined;
  }

  if (body[key] === "" || body[key] === null) {
    return null;
  }

  return readNumber(body, key, { min, max });
}

function mapInclusion(row: Record<string, string | number | null>): AdminTripInclusion {
  return mapTextItem(row);
}

function mapTextItem(
  row: Record<string, string | number | null>,
): AdminTripTextItem {
  return {
    id: stringValue(row.id),
    body: stringValue(row.body),
    sortOrder: numberValue(row.sort_order),
  };
}

function mapGallery(row: Record<string, string | number | null>): AdminTripGalleryItem {
  return {
    id: stringValue(row.id),
    src: stringValue(row.src),
    altText: stringValue(row.alt_text),
    sortOrder: numberValue(row.sort_order),
  };
}

function mapItinerary(
  row: Record<string, string | number | null>,
): AdminTripItineraryItem {
  return {
    id: stringValue(row.id),
    title: stringValue(row.title),
    body: stringValue(row.body),
    locationLabel: stringValue(row.location_label),
    latitude: nullableNumberValue(row.latitude),
    longitude: nullableNumberValue(row.longitude),
    zoom: numberValue(row.zoom, 12),
    sortOrder: numberValue(row.sort_order),
  };
}

function nullableNumberValue(value: string | number | null) {
  if (value == null || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function numberValue(value: string | number | null, fallback = 0) {
  return nullableNumberValue(value) ?? fallback;
}
