import "server-only";

import { createHash, randomBytes } from "node:crypto";

import {
  readDateString,
  readJsonObject,
  readNumber,
  readString,
} from "@/server/http/validation";
import {
  getSupabaseAdminClient,
  getSupabasePublicServerClient,
} from "@/server/supabase/client";
import type {
  ActivityOptionDTO,
  FlightOptionDTO,
  HotelOptionDTO,
  ItineraryOptionType,
  ItinerarySegmentDTO,
  SegmentOptionDTO,
  SegmentOptionsDTO,
  SelectionResultDTO,
  TransferOptionDTO,
  TripItineraryDTO,
} from "@/types/itinerary";

const SESSION_COOKIE = "flytime_option_session";
const SESSION_TTL_SECONDS = 45 * 60;

type SelectionCookieStore = {
  get(name: string): { value: string } | undefined;
};

type TripContext = {
  tripId: string;
  tripSlug: string;
  tripTitle: string;
  destinationSlug: string;
  destinationName: string;
  currency: string;
  startDate?: string;
};

type SegmentRow = {
  id: string;
  trip_id: string;
  segment_type: ItinerarySegmentDTO["type"];
  direction: ItinerarySegmentDTO["direction"];
  title: string;
  subtitle: string | null;
  description: string | null;
  day_offset: number;
  start_time: string | null;
  end_time: string | null;
  origin_label: string | null;
  origin_iata: string | null;
  destination_label: string | null;
  destination_iata: string | null;
  location_label: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  map_zoom: number;
  is_required: boolean;
  is_changeable: boolean;
};

type FlightRow = {
  id: string;
  title: string | null;
  airline_name: string;
  airline_code: string | null;
  airline_logo_url: string | null;
  flight_number: string | null;
  origin_iata: string | null;
  origin_label: string;
  destination_iata: string | null;
  destination_label: string;
  departure_at: string | null;
  arrival_at: string | null;
  duration_minutes: number | null;
  stops_count: number;
  layover_airports: string[] | null;
  cabin: string | null;
  fare_class: string | null;
  baggage_label: string | null;
  price_delta_amount: number | string;
  currency: string;
  is_default: boolean;
};

type HotelRow = {
  id: string;
  hotel_name: string;
  address: string | null;
  star_rating: number | string | null;
  room_name: string | null;
  board_basis: string | null;
  check_in_day_offset: number;
  check_out_day_offset: number;
  nights: number;
  latitude: number | string | null;
  longitude: number | string | null;
  image_url: string | null;
  guest_rating: number | string | null;
  amenities: string[] | null;
  price_delta_amount: number | string;
  currency: string;
  is_default: boolean;
};

type TransferRow = {
  id: string;
  title: string;
  pickup_label: string;
  dropoff_label: string;
  vehicle_type: string;
  vehicle_image_url: string | null;
  luggage_count: number | null;
  pax_min: number;
  pax_max: number;
  duration_minutes: number | null;
  price_delta_amount: number | string;
  currency: string;
  is_default: boolean;
};

type ActivityRow = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  day_offset: number;
  duration_minutes: number | null;
  pickup_included: boolean;
  location_label: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  image_url: string | null;
  price_delta_amount: number | string;
  currency: string;
  is_default: boolean;
};

export async function getTripItineraryDTO(
  destinationSlug: string,
  tripSlug: string,
): Promise<TripItineraryDTO | null> {
  const context = await getTripContext(destinationSlug, tripSlug, false);

  if (!context) {
    return null;
  }

  const segments = await getPublishedSegments(context.tripId);
  const selectedOptions = await getDefaultOptionsForSegments(segments);
  const segmentDtos = segments.map((segment) => ({
    ...mapSegment(segment),
    selectedOption: selectedOptions.get(segment.id),
  }));

  return {
    trip: {
      id: context.tripId,
      slug: context.tripSlug,
      title: context.tripTitle,
      currency: context.currency,
      startDate: context.startDate,
    },
    destination: {
      slug: context.destinationSlug,
      name: context.destinationName,
    },
    segments: segmentDtos,
    summaryTimeline: segmentDtos.map((segment) => ({
      segmentId: segment.id,
      type: segment.type,
      title: segment.title,
      dateLabel: segment.dateLabel,
      selectedLabel: getOptionLabel(segment.selectedOption),
    })),
  };
}

export async function getSegmentOptionsDTO({
  destinationSlug,
  tripSlug,
  segmentId,
  optionType,
  searchParams,
}: {
  destinationSlug: string;
  tripSlug: string;
  segmentId: string;
  optionType: ItineraryOptionType;
  searchParams: URLSearchParams;
}): Promise<SegmentOptionsDTO | null> {
  const context = await getTripContext(destinationSlug, tripSlug, false);

  if (!context) {
    return null;
  }

  const segment = await getPublishedSegment(context.tripId, segmentId);

  if (!segment || !isSegmentOptionCompatible(segment.segment_type, optionType)) {
    return null;
  }

  const options = await getOptionsByType({
    tripId: context.tripId,
    segmentId,
    optionType,
    searchParams,
  });

  return {
    segment: mapSegment(segment),
    options,
    total: options.length,
    filters: Object.fromEntries(searchParams.entries()),
  };
}

export async function selectSegmentOption({
  destinationSlug,
  tripSlug,
  request,
  cookieStore,
}: {
  destinationSlug: string;
  tripSlug: string;
  request: Request;
  cookieStore: SelectionCookieStore;
}): Promise<{
  result: SelectionResultDTO;
  sessionToken: string;
  maxAge: number;
} | null> {
  const body = await readJsonObject(request);
  const segmentId = readString(body, "segmentId", {
    required: true,
    max: 80,
  })!;
  const optionType = readString(body, "optionType", {
    required: true,
    max: 20,
  }) as ItineraryOptionType;
  const optionId = readString(body, "optionId", {
    required: true,
    max: 80,
  })!;
  const travelDate = readDateString(body, "travelDate");
  const travelersCount = Math.round(
    readNumber(body, "travelersCount", { min: 1, max: 50, fallback: 1 }) ?? 1,
  );

  if (!isKnownOptionType(optionType)) {
    return null;
  }

  const context = await getTripContext(destinationSlug, tripSlug, true);

  if (!context) {
    return null;
  }

  const segment = await getAdminSegment(context.tripId, segmentId);

  if (!segment || !isSegmentOptionCompatible(segment.segment_type, optionType)) {
    return null;
  }

  const option = await getAdminOption(optionType, context.tripId, segmentId, optionId);

  if (!option) {
    return null;
  }

  const existingToken = cookieStore.get(SESSION_COOKIE)?.value;
  const sessionToken = existingToken || randomBytes(32).toString("base64url");
  const sessionHash = hashSelectionSessionToken(sessionToken);
  const supabase = getSupabaseAdminClient();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  const sessionResult = await supabase
    .from("trip_option_selection_sessions")
    .upsert(
      {
        trip_id: context.tripId,
        session_token_hash: sessionHash,
        status: "draft",
        travelers_count: travelersCount,
        travel_date: travelDate,
        currency: option.priceDelta.currency,
        expires_at: expiresAt,
      },
      { onConflict: "session_token_hash" },
    )
    .select("id")
    .single();

  if (sessionResult.error || !sessionResult.data) {
    if (sessionResult.error) {
      throw sessionResult.error;
    }

    return null;
  }

  const sessionId = (sessionResult.data as unknown as { id: string }).id;
  const selectionPayload = buildSelectionPayload({
    sessionId,
    segmentId,
    optionType,
    optionId,
    option,
  });
  const selectionResult = await supabase
    .from("trip_option_selections")
    .upsert(selectionPayload, { onConflict: "session_id,segment_id" });

  if (selectionResult.error) {
    throw selectionResult.error;
  }

  const totalDelta = await recalculateSessionTotal(sessionId, option.priceDelta.currency);

  return {
    result: {
      selected: option,
      totalDelta,
      expiresAt,
    },
    sessionToken,
    maxAge: SESSION_TTL_SECONDS,
  };
}

async function getTripContext(
  destinationSlug: string,
  tripSlug: string,
  admin: boolean,
): Promise<TripContext | null> {
  const supabase = admin ? getSupabaseAdminClient() : getSupabasePublicServerClient();
  const destinationResult = await supabase
    .from("destinations")
    .select("id,slug,name")
    .eq("slug", destinationSlug)
    .eq("status", "published")
    .maybeSingle();

  if (destinationResult.error) {
    throw destinationResult.error;
  }

  if (!destinationResult.data) {
    return null;
  }

  const destination = destinationResult.data as unknown as {
    id: string;
    slug: string;
    name: string;
  };
  const tripResult = await supabase
    .from("trips")
    .select("id,slug,title,currency,start_date")
    .eq("destination_id", destination.id)
    .eq("slug", tripSlug)
    .eq("status", "published")
    .maybeSingle();

  if (tripResult.error) {
    throw tripResult.error;
  }

  if (!tripResult.data) {
    return null;
  }

  const trip = tripResult.data as unknown as {
    id: string;
    slug: string;
    title: string;
    currency: string;
    start_date: string | null;
  };

  return {
    tripId: trip.id,
    tripSlug: trip.slug,
    tripTitle: trip.title,
    destinationSlug: destination.slug,
    destinationName: destination.name,
    currency: trip.currency,
    startDate: trip.start_date ?? undefined,
  };
}

async function getPublishedSegments(tripId: string) {
  const supabase = getSupabasePublicServerClient();
  const result = await supabase
    .from("trip_itinerary_segments")
    .select(safeSegmentColumns)
    .eq("trip_id", tripId)
    .eq("status", "published")
    .order("sort_order", { ascending: true });

  if (result.error) {
    throw result.error;
  }

  return (result.data ?? []) as unknown as SegmentRow[];
}

async function getPublishedSegment(tripId: string, segmentId: string) {
  const supabase = getSupabasePublicServerClient();
  const result = await supabase
    .from("trip_itinerary_segments")
    .select(safeSegmentColumns)
    .eq("trip_id", tripId)
    .eq("id", segmentId)
    .eq("status", "published")
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  return (result.data as unknown as SegmentRow | null) ?? null;
}

async function getAdminSegment(tripId: string, segmentId: string) {
  const supabase = getSupabaseAdminClient();
  const result = await supabase
    .from("trip_itinerary_segments")
    .select(safeSegmentColumns)
    .eq("trip_id", tripId)
    .eq("id", segmentId)
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  return (result.data as unknown as SegmentRow | null) ?? null;
}

async function getDefaultOptionsForSegments(segments: SegmentRow[]) {
  const result = new Map<string, SegmentOptionDTO>();
  const idsByType = new Map<ItineraryOptionType, string[]>();

  segments.forEach((segment) => {
    if (isKnownOptionType(segment.segment_type)) {
      const current = idsByType.get(segment.segment_type) ?? [];
      current.push(segment.id);
      idsByType.set(segment.segment_type, current);
    }
  });

  await Promise.all(
    Array.from(idsByType.entries()).map(async ([optionType, segmentIds]) => {
      const options = await getDefaultOptions(optionType, segmentIds);
      options.forEach((item) => result.set(item.segmentId, item.option));
    }),
  );

  return result;
}

async function getDefaultOptions(
  optionType: ItineraryOptionType,
  segmentIds: string[],
) {
  const supabase = getSupabasePublicServerClient();
  const table = getOptionTable(optionType);
  const result = await supabase
    .from(table)
    .select(`${getOptionColumns(optionType)},segment_id`)
    .in("segment_id", segmentIds)
    .eq("status", "available")
    .eq("is_default", true);

  if (result.error) {
    throw result.error;
  }

  return ((result.data ?? []) as unknown as Array<Record<string, unknown>>).map(
    (row) => ({
      segmentId: String(row.segment_id),
      option: mapOption(optionType, row),
    }),
  );
}

async function getOptionsByType({
  tripId,
  segmentId,
  optionType,
  searchParams,
}: {
  tripId: string;
  segmentId: string;
  optionType: ItineraryOptionType;
  searchParams: URLSearchParams;
}) {
  const supabase = getSupabasePublicServerClient();
  const table = getOptionTable(optionType);
  let query = supabase
    .from(table)
    .select(getOptionColumns(optionType))
    .eq("trip_id", tripId)
    .eq("segment_id", segmentId)
    .eq("status", "available");

  const sort = searchParams.get("sort") ?? "price";

  if (optionType === "flight") {
    const stops = searchParams.get("stops");
    const airline = searchParams.get("airline");
    const layover = searchParams.get("layover");

    if (stops && Number.isFinite(Number(stops))) {
      query = query.eq("stops_count", Number(stops));
    }

    if (airline) {
      query = query.eq("airline_code", airline);
    }

    if (layover) {
      query = query.contains("layover_airports", [layover]);
    }

    query = query.order(
      sort === "duration" ? "duration_minutes" : "price_delta_amount",
      { ascending: true },
    );
  } else if (optionType === "hotel") {
    const q = searchParams.get("q");
    const stars = searchParams.get("stars");

    if (q) {
      query = query.ilike("hotel_name", `%${q}%`);
    }

    if (stars && Number.isFinite(Number(stars))) {
      query = query.gte("star_rating", Number(stars));
    }

    query = query.order(
      sort === "rating" ? "guest_rating" : "price_delta_amount",
      { ascending: sort !== "rating" },
    );
  } else if (optionType === "transfer") {
    const vehicle = searchParams.get("vehicle");
    const pax = searchParams.get("pax");

    if (vehicle) {
      query = query.eq("vehicle_type", vehicle);
    }

    if (pax && Number.isFinite(Number(pax))) {
      query = query.lte("pax_min", Number(pax)).gte("pax_max", Number(pax));
    }

    query = query.order("price_delta_amount", { ascending: true });
  } else {
    const category = searchParams.get("category");
    const day = searchParams.get("day");
    const pickup = searchParams.get("pickup");

    if (category) {
      query = query.eq("category", category);
    }

    if (day && Number.isFinite(Number(day))) {
      query = query.eq("day_offset", Number(day));
    }

    if (pickup === "true" || pickup === "false") {
      query = query.eq("pickup_included", pickup === "true");
    }

    query = query.order(
      sort === "duration" ? "duration_minutes" : "price_delta_amount",
      { ascending: true },
    );
  }

  const result = await query.limit(60);

  if (result.error) {
    throw result.error;
  }

  return ((result.data ?? []) as unknown as Array<Record<string, unknown>>).map(
    (row) => mapOption(optionType, row),
  );
}

async function getAdminOption(
  optionType: ItineraryOptionType,
  tripId: string,
  segmentId: string,
  optionId: string,
) {
  const supabase = getSupabaseAdminClient();
  const result = await supabase
    .from(getOptionTable(optionType))
    .select(getOptionColumns(optionType))
    .eq("trip_id", tripId)
    .eq("segment_id", segmentId)
    .eq("id", optionId)
    .eq("status", "available")
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  if (!result.data) {
    return null;
  }

  return mapOption(optionType, result.data as unknown as Record<string, unknown>);
}

function mapSegment(row: SegmentRow): ItinerarySegmentDTO {
  return {
    id: row.id,
    type: row.segment_type,
    direction: row.direction,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    description: row.description ?? undefined,
    dayOffset: row.day_offset,
    dateLabel: row.day_offset === 0 ? undefined : `Day ${row.day_offset + 1}`,
    startTime: row.start_time ?? undefined,
    endTime: row.end_time ?? undefined,
    origin:
      row.origin_label || row.origin_iata
        ? {
            label: row.origin_label ?? undefined,
            code: row.origin_iata ?? undefined,
          }
        : undefined,
    destination:
      row.destination_label || row.destination_iata
        ? {
            label: row.destination_label ?? undefined,
            code: row.destination_iata ?? undefined,
          }
        : undefined,
    location:
      row.location_label || row.latitude || row.longitude
        ? {
            label: row.location_label ?? undefined,
            latitude: toOptionalNumber(row.latitude),
            longitude: toOptionalNumber(row.longitude),
          }
        : undefined,
    mapZoom: row.map_zoom,
    isRequired: row.is_required,
    isChangeable: row.is_changeable,
  };
}

function mapOption(
  optionType: ItineraryOptionType,
  row: Record<string, unknown>,
): SegmentOptionDTO {
  if (optionType === "flight") {
    const flight = row as unknown as FlightRow;
    return {
      id: flight.id,
      type: "flight",
      title: flight.title ?? flight.airline_name,
      airlineName: flight.airline_name,
      airlineCode: flight.airline_code ?? undefined,
      airlineLogoUrl: flight.airline_logo_url ?? undefined,
      flightNumber: flight.flight_number ?? undefined,
      origin: {
        label: flight.origin_label,
        code: flight.origin_iata ?? undefined,
      },
      destination: {
        label: flight.destination_label,
        code: flight.destination_iata ?? undefined,
      },
      departureAt: flight.departure_at ?? undefined,
      arrivalAt: flight.arrival_at ?? undefined,
      durationMinutes: flight.duration_minutes ?? undefined,
      stopsCount: flight.stops_count,
      layoverAirports: flight.layover_airports ?? [],
      cabin: flight.cabin ?? undefined,
      fareClass: flight.fare_class ?? undefined,
      baggageLabel: flight.baggage_label ?? undefined,
      priceDelta: moneyDelta(flight.price_delta_amount, flight.currency),
      isDefault: flight.is_default,
    } satisfies FlightOptionDTO;
  }

  if (optionType === "hotel") {
    const hotel = row as unknown as HotelRow;
    return {
      id: hotel.id,
      type: "hotel",
      hotelName: hotel.hotel_name,
      address: hotel.address ?? undefined,
      starRating: toOptionalNumber(hotel.star_rating),
      roomName: hotel.room_name ?? undefined,
      boardBasis: hotel.board_basis ?? undefined,
      checkInDayOffset: hotel.check_in_day_offset,
      checkOutDayOffset: hotel.check_out_day_offset,
      nights: hotel.nights,
      imageUrl: hotel.image_url ?? undefined,
      guestRating: toOptionalNumber(hotel.guest_rating),
      amenities: hotel.amenities ?? [],
      location:
        hotel.latitude || hotel.longitude
          ? {
              latitude: toOptionalNumber(hotel.latitude),
              longitude: toOptionalNumber(hotel.longitude),
            }
          : undefined,
      priceDelta: moneyDelta(hotel.price_delta_amount, hotel.currency),
      isDefault: hotel.is_default,
    } satisfies HotelOptionDTO;
  }

  if (optionType === "transfer") {
    const transfer = row as unknown as TransferRow;
    return {
      id: transfer.id,
      type: "transfer",
      title: transfer.title,
      pickupLabel: transfer.pickup_label,
      dropoffLabel: transfer.dropoff_label,
      vehicleType: transfer.vehicle_type,
      vehicleImageUrl: transfer.vehicle_image_url ?? undefined,
      luggageCount: transfer.luggage_count ?? undefined,
      paxMin: transfer.pax_min,
      paxMax: transfer.pax_max,
      durationMinutes: transfer.duration_minutes ?? undefined,
      priceDelta: moneyDelta(transfer.price_delta_amount, transfer.currency),
      isDefault: transfer.is_default,
    } satisfies TransferOptionDTO;
  }

  const activity = row as unknown as ActivityRow;
  return {
    id: activity.id,
    type: "activity",
    title: activity.title,
    description: activity.description ?? undefined,
    category: activity.category ?? undefined,
    dayOffset: activity.day_offset,
    durationMinutes: activity.duration_minutes ?? undefined,
    pickupIncluded: activity.pickup_included,
    imageUrl: activity.image_url ?? undefined,
    location:
      activity.location_label || activity.latitude || activity.longitude
        ? {
            label: activity.location_label ?? undefined,
            latitude: toOptionalNumber(activity.latitude),
            longitude: toOptionalNumber(activity.longitude),
          }
        : undefined,
    priceDelta: moneyDelta(activity.price_delta_amount, activity.currency),
    isDefault: activity.is_default,
  } satisfies ActivityOptionDTO;
}

function buildSelectionPayload({
  sessionId,
  segmentId,
  optionType,
  optionId,
  option,
}: {
  sessionId: string;
  segmentId: string;
  optionType: ItineraryOptionType;
  optionId: string;
  option: SegmentOptionDTO;
}) {
  return {
    session_id: sessionId,
    segment_id: segmentId,
    option_type: optionType,
    flight_option_id: optionType === "flight" ? optionId : null,
    hotel_option_id: optionType === "hotel" ? optionId : null,
    transfer_option_id: optionType === "transfer" ? optionId : null,
    activity_option_id: optionType === "activity" ? optionId : null,
    price_delta_amount: option.priceDelta.amount,
    currency: option.priceDelta.currency,
  };
}

async function recalculateSessionTotal(sessionId: string, currency: string) {
  const supabase = getSupabaseAdminClient();
  const result = await supabase
    .from("trip_option_selections")
    .select("price_delta_amount")
    .eq("session_id", sessionId);

  if (result.error) {
    throw result.error;
  }

  const amount = ((result.data ?? []) as Array<{ price_delta_amount: number | string }>).reduce(
    (sum, row) => sum + Number(row.price_delta_amount ?? 0),
    0,
  );
  const updateResult = await supabase
    .from("trip_option_selection_sessions")
    .update({ total_delta_amount: amount, currency })
    .eq("id", sessionId);

  if (updateResult.error) {
    throw updateResult.error;
  }

  return moneyDelta(amount, currency);
}

function isSegmentOptionCompatible(
  segmentType: ItinerarySegmentDTO["type"],
  optionType: ItineraryOptionType,
) {
  return segmentType === optionType;
}

function isKnownOptionType(value: string): value is ItineraryOptionType {
  return (
    value === "flight" ||
    value === "hotel" ||
    value === "transfer" ||
    value === "activity"
  );
}

function getOptionTable(optionType: ItineraryOptionType) {
  return {
    flight: "trip_flight_options",
    hotel: "trip_hotel_options",
    transfer: "trip_transfer_options",
    activity: "trip_activity_options",
  }[optionType];
}

function getOptionColumns(optionType: ItineraryOptionType) {
  if (optionType === "flight") {
    return [
      "id",
      "title",
      "airline_name",
      "airline_code",
      "airline_logo_url",
      "flight_number",
      "origin_iata",
      "origin_label",
      "destination_iata",
      "destination_label",
      "departure_at",
      "arrival_at",
      "duration_minutes",
      "stops_count",
      "layover_airports",
      "cabin",
      "fare_class",
      "baggage_label",
      "price_delta_amount",
      "currency",
      "is_default",
    ].join(",");
  }

  if (optionType === "hotel") {
    return [
      "id",
      "hotel_name",
      "address",
      "star_rating",
      "room_name",
      "board_basis",
      "check_in_day_offset",
      "check_out_day_offset",
      "nights",
      "latitude",
      "longitude",
      "image_url",
      "guest_rating",
      "amenities",
      "price_delta_amount",
      "currency",
      "is_default",
    ].join(",");
  }

  if (optionType === "transfer") {
    return [
      "id",
      "title",
      "pickup_label",
      "dropoff_label",
      "vehicle_type",
      "vehicle_image_url",
      "luggage_count",
      "pax_min",
      "pax_max",
      "duration_minutes",
      "price_delta_amount",
      "currency",
      "is_default",
    ].join(",");
  }

  return [
    "id",
    "title",
    "description",
    "category",
    "day_offset",
    "duration_minutes",
    "pickup_included",
    "location_label",
    "latitude",
    "longitude",
    "image_url",
    "price_delta_amount",
    "currency",
    "is_default",
  ].join(",");
}

const safeSegmentColumns = [
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
].join(",");

function moneyDelta(value: number | string, currency: string) {
  const amount = Number(value ?? 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  return {
    currency,
    amount: safeAmount,
    label: `${safeAmount >= 0 ? "+" : "-"} ${currency}${Math.abs(
      safeAmount,
    ).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
  };
}

function getOptionLabel(option: SegmentOptionDTO | undefined) {
  if (!option) {
    return undefined;
  }

  if (option.type === "flight") {
    return option.airlineName;
  }

  if (option.type === "hotel") {
    return option.hotelName;
  }

  if (option.type === "transfer") {
    return option.title;
  }

  return option.title;
}

function toOptionalNumber(value: number | string | null) {
  if (value == null) {
    return undefined;
  }

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : undefined;
}

export function hashSelectionSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export { SESSION_COOKIE };
