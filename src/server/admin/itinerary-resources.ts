import "server-only";

import type { AdminActor } from "@/server/supabase/auth";
import {
  isRecord,
  readJsonObject,
  readNumber,
  readString,
  type UnknownRecord,
} from "@/server/http/validation";
import {
  getSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/server/supabase/client";
import type { ItineraryOptionType, ItinerarySegmentType } from "@/types/itinerary";

type ItineraryDirection = "outbound" | "return" | "local";
type PublishStatus = "draft" | "published" | "archived";
type QuoteStatus = "available" | "selected" | "expired" | "unavailable";

type AdminItineraryResult = {
  action: "created" | "updated" | "deleted";
  row: Record<string, string | number | boolean | null>;
};

type OptionDefinition = {
  table: string;
  select: string;
  build: (body: UnknownRecord) => Record<string, unknown>;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SEGMENT_SELECT = [
  "id",
  "trip_id",
  "segment_type",
  "direction",
  "title",
  "subtitle",
  "description",
  "day_offset",
  "start_time",
  "end_time",
  "origin_label",
  "origin_iata",
  "destination_label",
  "destination_iata",
  "location_label",
  "latitude",
  "longitude",
  "map_zoom",
  "is_required",
  "is_changeable",
  "status",
  "sort_order",
].join(",");

const OPTION_DEFINITIONS: Record<ItineraryOptionType, OptionDefinition> = {
  flight: {
    table: "trip_flight_options",
    select: [
      "id",
      "trip_id",
      "segment_id",
      "title",
      "airline_name",
      "airline_code",
      "origin_iata",
      "origin_label",
      "destination_iata",
      "destination_label",
      "departure_at",
      "arrival_at",
      "duration_minutes",
      "stops_count",
      "cabin",
      "fare_class",
      "baggage_label",
      "price_delta_amount",
      "currency",
      "is_default",
      "status",
    ].join(","),
    build: buildFlightOptionPayload,
  },
  hotel: {
    table: "trip_hotel_options",
    select: [
      "id",
      "trip_id",
      "segment_id",
      "hotel_name",
      "address",
      "star_rating",
      "room_name",
      "board_basis",
      "nights",
      "price_delta_amount",
      "currency",
      "is_default",
      "status",
    ].join(","),
    build: buildHotelOptionPayload,
  },
  transfer: {
    table: "trip_transfer_options",
    select: [
      "id",
      "trip_id",
      "segment_id",
      "title",
      "pickup_label",
      "dropoff_label",
      "vehicle_type",
      "luggage_count",
      "pax_min",
      "pax_max",
      "duration_minutes",
      "price_delta_amount",
      "currency",
      "is_default",
      "status",
    ].join(","),
    build: buildTransferOptionPayload,
  },
  activity: {
    table: "trip_activity_options",
    select: [
      "id",
      "trip_id",
      "segment_id",
      "title",
      "category",
      "day_offset",
      "duration_minutes",
      "pickup_included",
      "location_label",
      "price_delta_amount",
      "currency",
      "is_default",
      "status",
    ].join(","),
    build: buildActivityOptionPayload,
  },
};

export async function createItinerarySegment(
  tripId: string,
  request: Request,
  actor: AdminActor,
): Promise<AdminItineraryResult> {
  const safeTripId = requireUuid(tripId);
  const body = await readJsonObject(request);
  await assertTripExists(safeTripId);

  const payload = {
    ...buildSegmentPayload(body),
    trip_id: safeTripId,
  };
  const result = await getAdminClient()
    .from("trip_itinerary_segments")
    .insert(payload)
    .select(SEGMENT_SELECT)
    .single();

  if (result.error) {
    throw result.error;
  }

  const row = normalizeRow(result.data);
  await writeAuditLog(actor, "itinerary.segment.create", "trip_itinerary_segments", row);

  return { action: "created", row: safeRow(row) };
}

export async function updateItinerarySegment(
  tripId: string,
  segmentId: string,
  request: Request,
  actor: AdminActor,
): Promise<AdminItineraryResult> {
  const safeTripId = requireUuid(tripId);
  const safeSegmentId = requireUuid(segmentId);
  const body = await readJsonObject(request);
  const payload = buildSegmentPayload(body);

  if (Object.keys(payload).length === 0) {
    throw new Error("No supported fields were provided");
  }

  await assertSegmentBelongsToTrip(safeTripId, safeSegmentId);

  const result = await getAdminClient()
    .from("trip_itinerary_segments")
    .update(payload)
    .eq("trip_id", safeTripId)
    .eq("id", safeSegmentId)
    .select(SEGMENT_SELECT)
    .single();

  if (result.error) {
    throw result.error;
  }

  const row = normalizeRow(result.data);
  await writeAuditLog(actor, "itinerary.segment.update", "trip_itinerary_segments", row);

  return { action: "updated", row: safeRow(row) };
}

export async function deleteItinerarySegment(
  tripId: string,
  segmentId: string,
  actor: AdminActor,
): Promise<AdminItineraryResult> {
  const safeTripId = requireUuid(tripId);
  const safeSegmentId = requireUuid(segmentId);

  await assertSegmentBelongsToTrip(safeTripId, safeSegmentId);

  const result = await getAdminClient()
    .from("trip_itinerary_segments")
    .update({ status: "archived" })
    .eq("trip_id", safeTripId)
    .eq("id", safeSegmentId)
    .select(SEGMENT_SELECT)
    .single();

  if (result.error) {
    throw result.error;
  }

  const row = normalizeRow(result.data);
  await writeAuditLog(actor, "itinerary.segment.delete", "trip_itinerary_segments", row);

  return { action: "deleted", row: safeRow(row) };
}

export async function createSegmentOption(
  tripId: string,
  segmentId: string,
  request: Request,
  actor: AdminActor,
): Promise<AdminItineraryResult> {
  const safeTripId = requireUuid(tripId);
  const safeSegmentId = requireUuid(segmentId);
  const body = await readJsonObject(request);
  const optionType = readOptionType(body);
  const definition = OPTION_DEFINITIONS[optionType];

  await assertOptionSegment(safeTripId, safeSegmentId, optionType);

  const payload = {
    ...definition.build(body),
    trip_id: safeTripId,
    segment_id: safeSegmentId,
  };
  const result = await getAdminClient()
    .from(definition.table)
    .insert(payload)
    .select(definition.select)
    .single();

  if (result.error) {
    throw result.error;
  }

  const row = normalizeRow(result.data);
  await writeAuditLog(actor, `itinerary.${optionType}.create`, definition.table, row);

  return { action: "created", row: safeRow(row) };
}

export async function updateSegmentOption({
  tripId,
  segmentId,
  optionId,
  optionType,
  request,
  actor,
}: {
  tripId: string;
  segmentId: string;
  optionId: string;
  optionType: string | null;
  request: Request;
  actor: AdminActor;
}): Promise<AdminItineraryResult> {
  const safeTripId = requireUuid(tripId);
  const safeSegmentId = requireUuid(segmentId);
  const safeOptionId = requireUuid(optionId);
  const body = await readJsonObject(request);
  const safeOptionType = parseOptionType(optionType) ?? readOptionType(body);
  const definition = OPTION_DEFINITIONS[safeOptionType];
  const payload = definition.build(body);

  if (Object.keys(payload).length === 0) {
    throw new Error("No supported fields were provided");
  }

  await assertOptionSegment(safeTripId, safeSegmentId, safeOptionType);

  const result = await getAdminClient()
    .from(definition.table)
    .update(payload)
    .eq("trip_id", safeTripId)
    .eq("segment_id", safeSegmentId)
    .eq("id", safeOptionId)
    .select(definition.select)
    .single();

  if (result.error) {
    throw result.error;
  }

  const row = normalizeRow(result.data);
  await writeAuditLog(
    actor,
    `itinerary.${safeOptionType}.update`,
    definition.table,
    row,
  );

  return { action: "updated", row: safeRow(row) };
}

export async function deleteSegmentOption({
  tripId,
  segmentId,
  optionId,
  optionType,
  actor,
}: {
  tripId: string;
  segmentId: string;
  optionId: string;
  optionType: string | null;
  actor: AdminActor;
}): Promise<AdminItineraryResult> {
  const safeTripId = requireUuid(tripId);
  const safeSegmentId = requireUuid(segmentId);
  const safeOptionId = requireUuid(optionId);
  const safeOptionType = parseOptionType(optionType);

  if (!safeOptionType) {
    throw new Error("Option type is required");
  }

  const definition = OPTION_DEFINITIONS[safeOptionType];
  await assertOptionSegment(safeTripId, safeSegmentId, safeOptionType);

  const result = await getAdminClient()
    .from(definition.table)
    .update({ status: "unavailable" })
    .eq("trip_id", safeTripId)
    .eq("segment_id", safeSegmentId)
    .eq("id", safeOptionId)
    .select(definition.select)
    .single();

  if (result.error) {
    throw result.error;
  }

  const row = normalizeRow(result.data);
  await writeAuditLog(
    actor,
    `itinerary.${safeOptionType}.delete`,
    definition.table,
    row,
  );

  return { action: "deleted", row: safeRow(row) };
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

async function assertSegmentBelongsToTrip(tripId: string, segmentId: string) {
  const result = await getAdminClient()
    .from("trip_itinerary_segments")
    .select("id,segment_type")
    .eq("trip_id", tripId)
    .eq("id", segmentId)
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  if (!result.data) {
    throw new Error("Segment was not found");
  }

  return result.data as { id: string; segment_type: ItinerarySegmentType };
}

async function assertOptionSegment(
  tripId: string,
  segmentId: string,
  optionType: ItineraryOptionType,
) {
  const segment = await assertSegmentBelongsToTrip(tripId, segmentId);

  if (segment.segment_type !== optionType) {
    throw new Error("Option type does not match segment");
  }
}

async function writeAuditLog(
  actor: AdminActor,
  action: string,
  table: string,
  row: Record<string, unknown>,
) {
  const id = stringValue(row.id);
  const result = await getAdminClient().from("audit_log").insert({
    actor_id: actor.id,
    action,
    entity_table: table,
    entity_id: UUID_RE.test(id) ? id : null,
    before_value: null,
    after_value: safeAuditValue(row),
  });

  if (result.error) {
    throw result.error;
  }
}

function buildSegmentPayload(body: UnknownRecord) {
  return pickDefined({
    segment_type: readEnum<ItinerarySegmentType>(body, "type", [
      "flight",
      "transfer",
      "hotel",
      "activity",
      "stay",
      "note",
    ]),
    direction: readEnum<ItineraryDirection>(body, "direction", [
      "outbound",
      "return",
      "local",
    ]),
    title: readString(body, "title", { min: 2, max: 160 }),
    subtitle: readString(body, "subtitle", { max: 180 }),
    description: readString(body, "description", { max: 3000 }),
    day_offset: readNumber(body, "dayOffset", { min: 0, max: 90 }),
    start_time: readTime(body, "startTime"),
    end_time: readTime(body, "endTime"),
    origin_label: readString(body, "originLabel", { max: 180 }),
    origin_iata: readString(body, "originIata", { max: 8 }),
    destination_label: readString(body, "destinationLabel", { max: 180 }),
    destination_iata: readString(body, "destinationIata", { max: 8 }),
    location_label: readString(body, "locationLabel", { max: 180 }),
    latitude: readNumber(body, "latitude", { min: -90, max: 90 }),
    longitude: readNumber(body, "longitude", { min: -180, max: 180 }),
    map_zoom: readNumber(body, "mapZoom", { min: 1, max: 18 }),
    is_required: readBoolean(body, "isRequired"),
    is_changeable: readBoolean(body, "isChangeable"),
    status: readEnum<PublishStatus>(body, "status", [
      "draft",
      "published",
      "archived",
    ]),
    sort_order: readNumber(body, "sortOrder", { min: 0 }),
    metadata: readJsonValue(body, "metadata"),
  });
}

function buildFlightOptionPayload(body: UnknownRecord) {
  return pickDefined({
    title: readString(body, "title", { max: 160 }),
    airline_name: readString(body, "airlineName", { min: 2, max: 160 }),
    airline_code: readString(body, "airlineCode", { max: 12 }),
    airline_logo_url: readString(body, "airlineLogoUrl", { max: 1200 }),
    flight_number: readString(body, "flightNumber", { max: 40 }),
    origin_iata: readString(body, "originIata", { max: 8 }),
    origin_label: readString(body, "originLabel", { min: 2, max: 180 }),
    destination_iata: readString(body, "destinationIata", { max: 8 }),
    destination_label: readString(body, "destinationLabel", { min: 2, max: 180 }),
    departure_at: readString(body, "departureAt", { max: 40 }),
    arrival_at: readString(body, "arrivalAt", { max: 40 }),
    duration_minutes: readNumber(body, "durationMinutes", { min: 1 }),
    stops_count: readNumber(body, "stopsCount", { min: 0 }),
    layover_airports: readStringArray(body, "layoverAirports", 8),
    cabin: readString(body, "cabin", { max: 80 }),
    fare_class: readString(body, "fareClass", { max: 40 }),
    baggage_label: readString(body, "baggageLabel", { max: 120 }),
    price_delta_amount: readNumber(body, "priceDeltaAmount", { min: -1000000 }),
    currency: readString(body, "currency", { max: 12 }),
    is_default: readBoolean(body, "isDefault"),
    status: readEnum<QuoteStatus>(body, "status", [
      "available",
      "selected",
      "expired",
      "unavailable",
    ]),
    expires_at: readString(body, "expiresAt", { max: 40 }),
    metadata: readJsonValue(body, "metadata"),
  });
}

function buildHotelOptionPayload(body: UnknownRecord) {
  return pickDefined({
    hotel_name: readString(body, "hotelName", { min: 2, max: 180 }),
    address: readString(body, "address", { max: 280 }),
    star_rating: readNumber(body, "starRating", { min: 0, max: 5 }),
    room_name: readString(body, "roomName", { max: 180 }),
    board_basis: readString(body, "boardBasis", { max: 120 }),
    check_in_day_offset: readNumber(body, "checkInDayOffset", { min: 0, max: 90 }),
    check_out_day_offset: readNumber(body, "checkOutDayOffset", {
      min: 1,
      max: 90,
    }),
    nights: readNumber(body, "nights", { min: 1, max: 90 }),
    latitude: readNumber(body, "latitude", { min: -90, max: 90 }),
    longitude: readNumber(body, "longitude", { min: -180, max: 180 }),
    image_url: readString(body, "imageUrl", { max: 1200 }),
    guest_rating: readNumber(body, "guestRating", { min: 0, max: 10 }),
    amenities: readStringArray(body, "amenities", 40),
    price_delta_amount: readNumber(body, "priceDeltaAmount", { min: -1000000 }),
    currency: readString(body, "currency", { max: 12 }),
    is_default: readBoolean(body, "isDefault"),
    status: readEnum<QuoteStatus>(body, "status", [
      "available",
      "selected",
      "expired",
      "unavailable",
    ]),
    expires_at: readString(body, "expiresAt", { max: 40 }),
    metadata: readJsonValue(body, "metadata"),
  });
}

function buildTransferOptionPayload(body: UnknownRecord) {
  return pickDefined({
    title: readString(body, "title", { min: 2, max: 180 }),
    pickup_label: readString(body, "pickupLabel", { min: 2, max: 180 }),
    dropoff_label: readString(body, "dropoffLabel", { min: 2, max: 180 }),
    vehicle_type: readString(body, "vehicleType", { min: 2, max: 80 }),
    vehicle_image_url: readString(body, "vehicleImageUrl", { max: 1200 }),
    luggage_count: readNumber(body, "luggageCount", { min: 0, max: 20 }),
    pax_min: readNumber(body, "paxMin", { min: 1, max: 99 }),
    pax_max: readNumber(body, "paxMax", { min: 1, max: 99 }),
    duration_minutes: readNumber(body, "durationMinutes", { min: 1 }),
    price_delta_amount: readNumber(body, "priceDeltaAmount", { min: -1000000 }),
    currency: readString(body, "currency", { max: 12 }),
    is_default: readBoolean(body, "isDefault"),
    status: readEnum<QuoteStatus>(body, "status", [
      "available",
      "selected",
      "expired",
      "unavailable",
    ]),
    expires_at: readString(body, "expiresAt", { max: 40 }),
    metadata: readJsonValue(body, "metadata"),
  });
}

function buildActivityOptionPayload(body: UnknownRecord) {
  return pickDefined({
    title: readString(body, "title", { min: 2, max: 180 }),
    description: readString(body, "description", { max: 3000 }),
    category: readString(body, "category", { max: 120 }),
    day_offset: readNumber(body, "dayOffset", { min: 0, max: 90 }),
    duration_minutes: readNumber(body, "durationMinutes", { min: 1 }),
    pickup_included: readBoolean(body, "pickupIncluded"),
    location_label: readString(body, "locationLabel", { max: 180 }),
    latitude: readNumber(body, "latitude", { min: -90, max: 90 }),
    longitude: readNumber(body, "longitude", { min: -180, max: 180 }),
    image_url: readString(body, "imageUrl", { max: 1200 }),
    price_delta_amount: readNumber(body, "priceDeltaAmount", { min: -1000000 }),
    currency: readString(body, "currency", { max: 12 }),
    is_default: readBoolean(body, "isDefault"),
    status: readEnum<QuoteStatus>(body, "status", [
      "available",
      "selected",
      "expired",
      "unavailable",
    ]),
    expires_at: readString(body, "expiresAt", { max: 40 }),
    metadata: readJsonValue(body, "metadata"),
  });
}

function readOptionType(body: UnknownRecord) {
  const type = readEnum<ItineraryOptionType>(body, "optionType", [
    "flight",
    "hotel",
    "transfer",
    "activity",
  ]);

  if (!type) {
    throw new Error("Option type is required");
  }

  return type;
}

function parseOptionType(value: string | null): ItineraryOptionType | undefined {
  if (
    value === "flight" ||
    value === "hotel" ||
    value === "transfer" ||
    value === "activity"
  ) {
    return value;
  }

  return undefined;
}

function readEnum<T extends string>(
  body: UnknownRecord,
  key: string,
  values: readonly T[],
) {
  const value = readString(body, key, { max: 80 });

  if (!value) {
    return undefined;
  }

  if (!values.includes(value as T)) {
    throw new Error(`${key} is invalid`);
  }

  return value as T;
}

function readTime(body: UnknownRecord, key: string) {
  const value = readString(body, key, { max: 8 });

  if (!value) {
    return undefined;
  }

  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    throw new Error(`${key} is invalid`);
  }

  return value;
}

function readBoolean(body: UnknownRecord, key: string) {
  const value = body[key];

  if (value == null || value === "") {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new Error(`${key} must be boolean`);
  }

  return value;
}

function readStringArray(body: UnknownRecord, key: string, maxItems: number) {
  const value = body[key];

  if (value == null) {
    return undefined;
  }

  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error(`${key} is invalid`);
  }

  return value.map((item) => {
    if (typeof item !== "string" || item.length > 120) {
      throw new Error(`${key} is invalid`);
    }

    return item.trim();
  });
}

function readJsonValue(body: UnknownRecord, key: string) {
  const value = body[key];

  if (value == null) {
    return undefined;
  }

  if (!isRecord(value) && !Array.isArray(value)) {
    throw new Error(`${key} must be a JSON object or array`);
  }

  return value;
}

function requireUuid(value: string) {
  if (!UUID_RE.test(value)) {
    throw new Error("Invalid record id");
  }

  return value;
}

function normalizeRow(value: unknown) {
  if (!isRecord(value)) {
    throw new Error("Invalid database response");
  }

  return value;
}

function safeAuditValue(row: Record<string, unknown>) {
  const copy = { ...row };

  delete copy.metadata;

  return copy;
}

function safeRow(row: Record<string, unknown>) {
  const entries = Object.entries(row).filter(([, value]) => {
    return (
      value == null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    );
  });

  return Object.fromEntries(entries) as Record<string, string | number | boolean | null>;
}

function pickDefined(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  );
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}
