import "server-only";

import { createHash, randomBytes } from "node:crypto";

import {
  readDateString,
  readJsonObject,
  readNumber,
  readString,
} from "@/server/http/validation";
import { logServerError } from "@/server/http/response";
import {
  getSupabaseAdminClient,
  getSupabasePublicServerClient,
} from "@/server/supabase/client";
import { isRateHawkConfigured } from "@/server/providers/ratehawk/config";
import { RateHawkError } from "@/server/providers/ratehawk/client";
import {
  buildLiveHotelQuotes,
  buildRequestHash,
  type LiveHotelSearchInput,
} from "@/server/providers/ratehawk/hotel-options";
import {
  searchHotelPage,
  prebookHotelRate,
  mapMealToBoardBasis,
  type GuestRoom,
  type HotelPrebookResult,
} from "@/server/providers/ratehawk/hotels";
import { getLocalHotelContent } from "@/server/hotels/content";
import type {
  ActivityOptionDTO,
  CheckoutGuestRoom,
  CheckoutLineItem,
  CheckoutPricing,
  CheckoutSummaryDTO,
  FlightOptionDTO,
  HotelOptionDTO,
  ItineraryOptionType,
  ItinerarySegmentDTO,
  PrebookResultDTO,
  SegmentOptionDTO,
  SegmentOptionsDTO,
  SelectionResultDTO,
  TransferOptionDTO,
  TripItineraryDTO,
} from "@/types/itinerary";

const SESSION_COOKIE = "flytime_option_session";
const SESSION_TTL_SECONDS = 45 * 60;

// RateHawk live hotel options (HP-2).
const RATEHAWK_PROVIDER_SLUG = "ratehawk-hotel";
// SERP quotes are browsing hints only. Keep reuse short and always run
// hotelpage + prebook before selection; hotelpage/prebook responses are never
// cached.
const LIVE_OPTION_TTL_MS = 5 * 60 * 1000;
const DEFAULT_LIVE_RESIDENCY = "ae";
const DEFAULT_LIVE_NIGHTS = 2;
const LIVE_OPTION_LIMIT = 12;

type HotelSourceMode = "manual" | "live" | "hybrid";

type HotelSourceConfig = {
  mode: HotelSourceMode;
  regionId: number | null;
  nights: number | null;
  residency: string | null;
};

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
  priceAmount: number;
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
  metadata: Record<string, unknown> | null;
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
    context,
    segment,
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
  // Only present (and required) when selecting a live hotel option.
  const prebookSnapshotId = readString(body, "prebookId", {
    required: false,
    max: 80,
  });

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

  const adminOption = await getAdminOption(
    optionType,
    context.tripId,
    segmentId,
    optionId,
  );

  if (!adminOption) {
    return null;
  }

  const { option, quoteSnapshotId } = adminOption;

  const existingToken = cookieStore.get(SESSION_COOKIE)?.value;
  const sessionToken = existingToken || randomBytes(32).toString("base64url");
  const sessionHash = hashSelectionSessionToken(sessionToken);
  const supabase = getSupabaseAdminClient();

  // Live hotel options require a valid prebook snapshot that is:
  //  - status = "selected"
  //  - not expired
  //  - metadata.quote_snapshot_id matches this option's original quote snapshot
  // This binds the accepted prebook to the selection so HP-4 booking has an
  // authoritative prebook_hash and cannot use an arbitrary snapshot.
  if (quoteSnapshotId !== null) {
    if (!prebookSnapshotId) {
      return null;
    }

    const nowIso = new Date().toISOString();
    const prebookCheck = await supabase
      .from("provider_quote_snapshots")
      .select("id,metadata,status,expires_at")
      .eq("id", prebookSnapshotId)
      .maybeSingle();

    if (prebookCheck.error) {
      throw prebookCheck.error;
    }

    if (!prebookCheck.data) {
      return null;
    }

    type PrebookRow = {
      id: string;
      metadata: Record<string, unknown>;
      status: string;
      expires_at: string | null;
    };

    const pb = prebookCheck.data as unknown as PrebookRow;

    if (pb.status !== "selected") {
      return null;
    }

    if (pb.expires_at && pb.expires_at <= nowIso) {
      return null;
    }

    if (pb.metadata?.quote_snapshot_id !== quoteSnapshotId) {
      return null;
    }
  }

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
    quoteSnapshotId,
    prebookSnapshotId: prebookSnapshotId ?? null,
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
    .select("id,slug,title,currency,start_date,price_amount")
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
    price_amount: number | string | null;
  };

  return {
    tripId: trip.id,
    tripSlug: trip.slug,
    tripTitle: trip.title,
    destinationSlug: destination.slug,
    destinationName: destination.name,
    currency: trip.currency,
    startDate: trip.start_date ?? undefined,
    priceAmount: Number.isFinite(Number(trip.price_amount)) ? Number(trip.price_amount) : 0,
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
  context,
  segment,
  optionType,
  searchParams,
}: {
  context: TripContext;
  segment: SegmentRow;
  optionType: ItineraryOptionType;
  searchParams: URLSearchParams;
}): Promise<SegmentOptionDTO[]> {
  const tripId = context.tripId;
  const segmentId = segment.id;

  // Hotels can be served from manual DB rows, live RateHawk rates, or a hybrid
  // of both. Resolve the mode up-front so a live-only segment skips the manual
  // query entirely.
  const hotelConfig =
    optionType === "hotel" ? readHotelSourceConfig(segment) : null;
  const includeManual = !hotelConfig || hotelConfig.mode !== "live";

  const manualOptions = includeManual
    ? await runManualOptionQuery({ tripId, segmentId, optionType, searchParams })
    : [];

  if (!hotelConfig || hotelConfig.mode === "manual") {
    return manualOptions;
  }

  const liveOptions = await getLiveHotelOptions(
    context,
    segment,
    hotelConfig,
    searchParams,
  );

  if (hotelConfig.mode === "live") {
    return liveOptions;
  }

  return sortHotelOptions([...manualOptions, ...liveOptions], searchParams);
}

async function runManualOptionQuery({
  tripId,
  segmentId,
  optionType,
  searchParams,
}: {
  tripId: string;
  segmentId: string;
  optionType: ItineraryOptionType;
  searchParams: URLSearchParams;
}): Promise<SegmentOptionDTO[]> {
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

    // Manual options only: live RateHawk rows carry a provider_id and are
    // served separately by getLiveHotelOptions.
    query = query.is("provider_id", null);

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

let cachedRateHawkProviderId: string | null = null;

function readHotelSourceConfig(segment: SegmentRow): HotelSourceConfig {
  const metadata = isPlainRecord(segment.metadata) ? segment.metadata : {};
  const rawMode =
    typeof metadata.hotel_source === "string"
      ? metadata.hotel_source.toLowerCase()
      : "manual";
  const mode: HotelSourceMode =
    rawMode === "live" || rawMode === "hybrid" ? rawMode : "manual";

  const ratehawk = isPlainRecord(metadata.ratehawk) ? metadata.ratehawk : {};
  const residencyRaw = ratehawk.residency;

  return {
    mode,
    regionId: toPositiveInt(ratehawk.region_id),
    nights: toPositiveInt(ratehawk.nights),
    residency:
      typeof residencyRaw === "string" && /^[a-z]{2}$/i.test(residencyRaw)
        ? residencyRaw.toLowerCase()
        : null,
  };
}

function deriveStayDates(context: TripContext, config: HotelSourceConfig) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let checkin = new Date(today.getTime() + 30 * 86_400_000);

  if (context.startDate) {
    const start = new Date(`${context.startDate}T00:00:00Z`);

    if (!Number.isNaN(start.getTime()) && start.getTime() >= today.getTime()) {
      checkin = start;
    }
  }

  const nights = Math.min(Math.max(config.nights ?? DEFAULT_LIVE_NIGHTS, 1), 30);
  const checkout = new Date(checkin.getTime() + nights * 86_400_000);

  return {
    checkin: checkin.toISOString().slice(0, 10),
    checkout: checkout.toISOString().slice(0, 10),
    nights,
  };
}

function parseLiveGuests(searchParams: URLSearchParams) {
  const encodedRooms = searchParams.getAll("room").slice(0, 4);
  const rooms = encodedRooms
    .map((encoded) => {
      const [adultsPart, childrenPart = ""] = encoded.split(":", 2);
      const adults = Number.parseInt(adultsPart, 10);
      const children = childrenPart
        .split(",")
        .filter(Boolean)
        .map((part) => Number.parseInt(part, 10));

      if (
        !Number.isInteger(adults) ||
        adults < 1 ||
        adults > 6 ||
        children.length > 4 ||
        children.some((age) => !Number.isInteger(age) || age < 0 || age > 17)
      ) {
        return null;
      }

      return { adults, children };
    })
    .filter((room): room is { adults: number; children: number[] } => room !== null);

  if (rooms.length === encodedRooms.length && rooms.length > 0) {
    return rooms;
  }

  const adultsRaw = Number.parseInt(searchParams.get("adults") ?? "2", 10);
  const adults =
    Number.isInteger(adultsRaw) && adultsRaw >= 1 && adultsRaw <= 6
      ? adultsRaw
      : 2;
  const children = (searchParams.get("children") ?? "")
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((age) => Number.isInteger(age) && age >= 0 && age <= 17)
    .slice(0, 4);

  return [{ adults, children }];
}

function parseLiveResidency(
  searchParams: URLSearchParams,
  configuredResidency: string | null,
) {
  const requested = searchParams.get("residency")?.trim().toLowerCase();

  if (requested && /^[a-z]{2}$/.test(requested)) {
    return requested;
  }

  return configuredResidency ?? DEFAULT_LIVE_RESIDENCY;
}

async function getOrCreateRateHawkProviderId(): Promise<string | null> {
  if (cachedRateHawkProviderId) {
    return cachedRateHawkProviderId;
  }

  const supabase = getSupabaseAdminClient();
  const existing = await supabase
    .from("external_providers")
    .select("id")
    .eq("slug", RATEHAWK_PROVIDER_SLUG)
    .maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  if (existing.data) {
    cachedRateHawkProviderId = (existing.data as { id: string }).id;
    return cachedRateHawkProviderId;
  }

  const inserted = await supabase
    .from("external_providers")
    .insert({
      slug: RATEHAWK_PROVIDER_SLUG,
      name: "RateHawk",
      service_type: "hotel",
      is_active: true,
      metadata: {},
    })
    .select("id")
    .maybeSingle();

  if (inserted.error) {
    throw inserted.error;
  }

  cachedRateHawkProviderId = inserted.data
    ? (inserted.data as { id: string }).id
    : null;

  return cachedRateHawkProviderId;
}

/**
 * Live RateHawk hotel options for a segment. Returns sanitized HotelOptionDTOs
 * persisted as selectable trip_hotel_options rows (with quote snapshots) so the
 * existing selection/booking flow works unchanged. Never throws to the caller:
 * a provider failure degrades to manual/empty so the page keeps working.
 */
async function getLiveHotelOptions(
  context: TripContext,
  segment: SegmentRow,
  config: HotelSourceConfig,
  searchParams: URLSearchParams,
): Promise<SegmentOptionDTO[]> {
  if (!config.regionId || !isRateHawkConfigured()) {
    return [];
  }

  try {
    const { checkin, checkout, nights } = deriveStayDates(context, config);
    const searchInput: LiveHotelSearchInput = {
      regionId: config.regionId,
      checkin,
      checkout,
      residency: parseLiveResidency(searchParams, config.residency),
      guests: parseLiveGuests(searchParams),
      currency: context.currency,
      language: "en",
      limit: LIVE_OPTION_LIMIT,
    };

    const requestHash = buildRequestHash(searchInput);
    const providerId = await getOrCreateRateHawkProviderId();

    if (!providerId) {
      return [];
    }

    const admin = getSupabaseAdminClient();
    const nowIso = new Date().toISOString();

    // Reuse persisted, unexpired rows for the exact same search.
    const reuse = await admin
      .from("trip_hotel_options")
      .select(getOptionColumns("hotel"))
      .eq("segment_id", segment.id)
      .eq("provider_id", providerId)
      .eq("status", "available")
      .eq("metadata->>request_hash", requestHash)
      .gt("expires_at", nowIso)
      .order("price_delta_amount", { ascending: true })
      .limit(LIVE_OPTION_LIMIT);

    if (reuse.error) {
      throw reuse.error;
    }

    const reuseRows = (reuse.data ?? []) as unknown as Array<
      Record<string, unknown>
    >;

    if (reuseRows.length > 0) {
      return reuseRows.map(mapLiveHotelRow);
    }

    const quotes = await buildLiveHotelQuotes(searchInput, (hotelIds) =>
      getLocalHotelContent(providerId, hotelIds, searchInput.language ?? "en"),
    );

    if (quotes.length === 0) {
      return [];
    }

    // Expire previous live rows for this segment so stale quotes are neither
    // displayed nor selectable.
    const expirePrevious = await admin
      .from("trip_hotel_options")
      .update({ status: "expired" })
      .eq("segment_id", segment.id)
      .eq("provider_id", providerId)
      .eq("status", "available");

    if (expirePrevious.error) {
      throw expirePrevious.error;
    }

    const expiresAt = new Date(Date.now() + LIVE_OPTION_TTL_MS).toISOString();

    const snapshots = await admin
      .from("provider_quote_snapshots")
      .insert(
        quotes.map((quote) => ({
          provider_id: providerId,
          service_type: "hotel",
          request_hash: requestHash,
          provider_reference: quote.hotelId,
          currency: quote.currency,
          price_amount: quote.priceAmount,
          price_delta_amount: quote.priceAmount,
          expires_at: expiresAt,
          status: "available",
          safe_payload: {
            hid: quote.hid,
            room_name: quote.roomName,
            board_basis: quote.boardBasis ?? null,
            // Stored for HP-3: used in search/hp/ recheck before prebook.
            checkin: searchInput.checkin,
            checkout: searchInput.checkout,
            residency: searchInput.residency,
            guests: searchInput.guests,
            currency: searchInput.currency,
          },
          // Server-only hashes for HP-3 prebook; never exposed in any DTO.
          metadata: {
            search_hash: quote.searchHash,
            match_hash: quote.matchHash,
          },
        })),
      )
      .select("id,provider_reference");

    if (snapshots.error) {
      throw snapshots.error;
    }

    const snapshotByReference = new Map<string, string>();

    for (const row of (snapshots.data ?? []) as Array<{
      id: string;
      provider_reference: string;
    }>) {
      snapshotByReference.set(row.provider_reference, row.id);
    }

    const inserted = await admin
      .from("trip_hotel_options")
      .insert(
        quotes.map((quote) => ({
          trip_id: context.tripId,
          segment_id: segment.id,
          provider_id: providerId,
          quote_snapshot_id: snapshotByReference.get(quote.hotelId) ?? null,
          hotel_name: quote.name,
          address: quote.address,
          star_rating: clampStarRating(quote.starRating),
          room_name: quote.roomName,
          board_basis: quote.boardBasis ?? null,
          check_in_day_offset: 0,
          check_out_day_offset: nights,
          nights,
          latitude: quote.latitude,
          longitude: quote.longitude,
          image_url: quote.imageUrl,
          price_delta_amount: quote.priceAmount,
          currency: quote.currency,
          is_default: false,
          status: "available",
          expires_at: expiresAt,
          metadata: {
            request_hash: requestHash,
            source: "ratehawk",
            hid: quote.hid,
          },
        })),
      )
      .select(getOptionColumns("hotel"));

    if (inserted.error) {
      throw inserted.error;
    }

    return ((inserted.data ?? []) as unknown as Array<
      Record<string, unknown>
    >).map(mapLiveHotelRow);
  } catch (error) {
    logServerError("itinerary.hotel.live", error);
    return [];
  }
}

function mapLiveHotelRow(row: Record<string, unknown>): SegmentOptionDTO {
  const dto = mapOption("hotel", row) as HotelOptionDTO;
  return { ...dto, isLive: true };
}

function sortHotelOptions(
  options: SegmentOptionDTO[],
  searchParams: URLSearchParams,
): SegmentOptionDTO[] {
  const sort = searchParams.get("sort") ?? "price";
  const sorted = [...options];

  if (sort === "rating") {
    sorted.sort((a, b) => hotelRatingValue(b) - hotelRatingValue(a));
  } else {
    sorted.sort((a, b) => a.priceDelta.amount - b.priceDelta.amount);
  }

  return sorted;
}

function hotelRatingValue(option: SegmentOptionDTO): number {
  if (option.type !== "hotel") {
    return 0;
  }

  return option.guestRating ?? option.starRating ?? 0;
}

function clampStarRating(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(5, value));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toPositiveInt(value: unknown): number | null {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

async function getAdminOption(
  optionType: ItineraryOptionType,
  tripId: string,
  segmentId: string,
  optionId: string,
): Promise<{ option: SegmentOptionDTO; quoteSnapshotId: string | null } | null> {
  const supabase = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const result = await supabase
    .from(getOptionTable(optionType))
    .select(getOptionColumns(optionType))
    .eq("trip_id", tripId)
    .eq("segment_id", segmentId)
    .eq("id", optionId)
    .eq("status", "available")
    // Expired provider quotes must never be selectable.
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  if (!result.data) {
    return null;
  }

  const row = result.data as unknown as Record<string, unknown>;
  const quoteSnapshotId =
    typeof row.quote_snapshot_id === "string" ? row.quote_snapshot_id : null;

  return { option: mapOption(optionType, row), quoteSnapshotId };
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
  quoteSnapshotId,
  prebookSnapshotId,
}: {
  sessionId: string;
  segmentId: string;
  optionType: ItineraryOptionType;
  optionId: string;
  option: SegmentOptionDTO;
  quoteSnapshotId: string | null;
  prebookSnapshotId: string | null;
}) {
  // quoteSnapshotId is only set for live (provider) options; manual rows are null.
  const isLiveHotel = option.type === "hotel" && quoteSnapshotId != null;

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
    metadata: isLiveHotel
      ? {
          provider: "ratehawk",
          quote_snapshot_id: quoteSnapshotId,
          prebook_snapshot_id: prebookSnapshotId,
        }
      : {},
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
      "quote_snapshot_id",
      "provider_id",
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
  "metadata",
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

// ---- HP-3: prebook a live hotel option -------------------------------------

/**
 * Prebook a RateHawk hotel option before the user proceeds to checkout.
 *
 * Flow:
 *  1. Validate trip / segment / option (must be available and not expired).
 *  2. For manual options: return confirmed immediately (no ETG call).
 *  3. Read match_hash from the quote snapshot metadata.
 *  4. If the snapshot's safe_payload contains valid search params, call
 *     search/hp/ to get the selected rate's book_hash.
 *  5. Call hotel/prebook/ with the hotelpage book_hash.
 *  6. Persist the result in a new provider_quote_snapshots row. The provider
 *     booking token is stored server-only as metadata.prebook_hash; only safe
 *     summary fields go into safe_payload.
 *  7. Return a safe DTO: status, price delta, cancellation summary.
 *
 * Never throws to the caller on provider failures - returns {status:"unavailable"}.
 */
export async function prebookLiveHotelOption({
  destinationSlug,
  tripSlug,
  segmentId,
  optionId,
}: {
  destinationSlug: string;
  tripSlug: string;
  segmentId: string;
  optionId: string;
}): Promise<PrebookResultDTO | null> {
  const context = await getTripContext(destinationSlug, tripSlug, true);

  if (!context) {
    return null;
  }

  const segment = await getAdminSegment(context.tripId, segmentId);

  if (!segment || segment.segment_type !== "hotel") {
    return null;
  }

  const adminOption = await getAdminOption(
    "hotel",
    context.tripId,
    segmentId,
    optionId,
  );

  if (!adminOption) {
    return null;
  }

  const { option, quoteSnapshotId } = adminOption;

  // Manual options: no provider call - return confirmed at the listed price.
  if (!quoteSnapshotId) {
    return {
      status: "confirmed",
      optionId,
      prebookId: null,
      priceChanged: false,
      oldPrice: option.priceDelta,
      newPrice: option.priceDelta,
      cancellationSummary: null,
      expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString(),
    };
  }

  const admin = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  const snapshotResult = await admin
    .from("provider_quote_snapshots")
    .select(
      "id,provider_reference,metadata,safe_payload,price_amount,currency,expires_at,status",
    )
    .eq("id", quoteSnapshotId)
    .maybeSingle();

  if (snapshotResult.error) {
    throw snapshotResult.error;
  }

  if (!snapshotResult.data) {
    return null;
  }

  type SnapshotRow = {
    id: string;
    provider_reference: string | null;
    metadata: Record<string, unknown>;
    safe_payload: Record<string, unknown>;
    price_amount: number | string | null;
    currency: string;
    expires_at: string | null;
    status: string;
  };

  const snap = snapshotResult.data as unknown as SnapshotRow;

  if (
    snap.status !== "available" ||
    (snap.expires_at && snap.expires_at <= nowIso)
  ) {
    return buildUnavailableResult(optionId, option.priceDelta, nowIso);
  }

  const storedMatchHash =
    typeof snap.metadata?.match_hash === "string"
      ? snap.metadata.match_hash
      : null;

  if (!storedMatchHash) {
    return buildUnavailableResult(optionId, option.priceDelta, nowIso);
  }

  let bookHash: string | null = null;
  let matchedSearchHash: string | null = null;
  let matchedMatchHash: string | null = storedMatchHash;

  const safePayload = isPlainRecord(snap.safe_payload) ? snap.safe_payload : {};
  const rawHid = safePayload.hid;
  const safeHid =
    typeof rawHid === "string" || typeof rawHid === "number"
      ? toOptionalNumber(rawHid)
      : null;
  const hotelId =
    safeHid != null
      ? String(Math.trunc(safeHid))
      : typeof snap.provider_reference === "string"
        ? snap.provider_reference
        : null;
  const checkin =
    typeof safePayload.checkin === "string" ? safePayload.checkin : null;
  const checkout =
    typeof safePayload.checkout === "string" ? safePayload.checkout : null;
  const residency =
    typeof safePayload.residency === "string" ? safePayload.residency : null;
  const currency =
    typeof safePayload.currency === "string"
      ? safePayload.currency
      : context.currency;
  const guests = parseGuestRooms(safePayload.guests);

  if (hotelId && checkin && checkout && residency && guests) {
    try {
      const hpRates = await searchHotelPage({
        hotelId,
        matchHash: storedMatchHash,
        checkin,
        checkout,
        residency,
        guests,
        currency,
        language: "en",
      });

      const freshRate = hpRates.find((r) => r.matchHash === storedMatchHash);

      if (!freshRate || !freshRate.bookHash) {
        // Rate is no longer listed for this hotel.
        return buildUnavailableResult(optionId, option.priceDelta, nowIso);
      }

      bookHash = freshRate.bookHash;
      matchedSearchHash = freshRate.searchHash;
      matchedMatchHash = freshRate.matchHash;
    } catch (error) {
      // hp search failed; without a safe hotelpage book_hash we cannot prebook.
      logServerError("itinerary.hotel.prebook.hp_refresh", error);
    }
  }

  if (!bookHash) {
    return buildUnavailableResult(optionId, option.priceDelta, nowIso);
  }

  let prebookResult: HotelPrebookResult;

  try {
    prebookResult = await prebookHotelRate(bookHash, "en");
  } catch (error) {
    if (
      error instanceof RateHawkError &&
      (error.code === "provider_error" || error.code === "http_error")
    ) {
      return buildUnavailableResult(optionId, option.priceDelta, nowIso);
    }

    throw error;
  }

  const oldAmount = Number(snap.price_amount ?? 0);
  const newAmount = prebookResult.priceAmount;
  const priceChanged = Math.abs(newAmount - oldAmount) >= 0.01;
  const prebookCurrency = prebookResult.currency ?? snap.currency;
  const cancellationSummary = buildCancellationSummary(
    prebookResult.cancellationFreeBefore,
    prebookResult.cancellationPolicies.length,
  );
  const stayNights =
    checkin && checkout
      ? Math.round(
          (new Date(checkout).getTime() - new Date(checkin).getTime()) /
            86_400_000,
        )
      : null;

  const prebookExpiresAt = new Date(
    Date.now() + LIVE_OPTION_TTL_MS,
  ).toISOString();

  const providerId = await getOrCreateRateHawkProviderId();

  const prebookInsert = await admin
    .from("provider_quote_snapshots")
    .insert({
      provider_id: providerId,
      service_type: "hotel",
      request_hash: `prebook:${quoteSnapshotId}`,
      provider_reference: String(safePayload.hid ?? snap.provider_reference ?? ""),
      currency: prebookCurrency,
      price_amount: newAmount,
      price_delta_amount: newAmount,
      expires_at: prebookExpiresAt,
      status: "selected",
      safe_payload: {
        prebook_for_snapshot_id: quoteSnapshotId,
        room_name: prebookResult.roomName,
        board_basis: prebookResult.meal
          ? (mapMealToBoardBasis(prebookResult.meal) ?? null)
          : null,
        nights: stayNights,
        cancellation_summary: cancellationSummary,
        cancellation_free_before: prebookResult.cancellationFreeBefore,
        policies_count: prebookResult.cancellationPolicies.length,
        price_at_prebook: newAmount,
        price_at_serp: oldAmount,
      },
      // prebook_hash is server-only - used in HP-4 booking; never returned to browser.
      metadata: {
        prebook_hash: prebookResult.prebookHash,
        quote_snapshot_id: quoteSnapshotId,
        hotelpage_book_hash_used: bookHash,
        search_hash_used: matchedSearchHash,
        match_hash_used: matchedMatchHash,
      },
    })
    .select("id")
    .single();

  if (prebookInsert.error) {
    throw prebookInsert.error;
  }

  const prebookId = (prebookInsert.data as unknown as { id: string }).id;

  return {
    status: priceChanged ? "price_changed" : "confirmed",
    optionId,
    prebookId,
    priceChanged,
    oldPrice: moneyDelta(oldAmount, snap.currency),
    newPrice: moneyDelta(newAmount, prebookCurrency),
    cancellationSummary,
    expiresAt: prebookExpiresAt,
  };
}

function buildUnavailableResult(
  optionId: string,
  existingPrice: ReturnType<typeof moneyDelta>,
  nowIso: string,
): PrebookResultDTO {
  return {
    status: "unavailable",
    optionId,
    prebookId: null,
    priceChanged: false,
    oldPrice: existingPrice,
    newPrice: existingPrice,
    cancellationSummary: null,
    expiresAt: nowIso,
  };
}

function parseGuestRooms(raw: unknown): GuestRoom[] | null {
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }

  const rooms: GuestRoom[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return null;
    }

    const rec = entry as Record<string, unknown>;
    const adults =
      typeof rec.adults === "number" && Number.isInteger(rec.adults)
        ? rec.adults
        : null;

    if (!adults || adults < 1) {
      return null;
    }

    const children = Array.isArray(rec.children)
      ? (rec.children as unknown[])
          .map((c) => (typeof c === "number" && Number.isInteger(c) ? c : null))
          .filter((n): n is number => n !== null)
      : [];

    rooms.push({ adults, children });
  }

  return rooms.length > 0 ? rooms : null;
}

function buildCheckoutGuestRooms(rooms: GuestRoom[] | null): CheckoutGuestRoom[] | undefined {
  if (!rooms || rooms.length === 0) {
    return undefined;
  }

  return rooms.map((room, roomIndex) => {
    const guests: CheckoutGuestRoom["guests"] = [];

    for (let i = 0; i < room.adults; i += 1) {
      guests.push({ kind: "adult" });
    }

    for (const age of room.children) {
      guests.push({ kind: "child", age });
    }

    return { roomIndex, guests };
  });
}

function buildCancellationSummary(
  freeBefore: string | null,
  policiesCount: number,
): string | null {
  if (freeBefore) {
    try {
      const date = new Date(freeBefore);

      if (!Number.isNaN(date.getTime())) {
        return `Free cancellation until ${date.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        })}`;
      }
    } catch {
      // fall through
    }
  }

  if (policiesCount === 0) {
    return "Non-refundable";
  }

  return "Cancellation fees apply";
}

export async function getCheckoutSummary({
  destinationSlug,
  tripSlug,
  sessionToken,
}: {
  destinationSlug: string;
  tripSlug: string;
  sessionToken: string | undefined;
}): Promise<CheckoutSummaryDTO | null> {
  if (!sessionToken) {
    return null;
  }

  const tripCtx = await getTripContext(destinationSlug, tripSlug, true);

  if (!tripCtx) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const sessionHash = hashSelectionSessionToken(sessionToken);

  const sessionResult = await supabase
    .from("trip_option_selection_sessions")
    .select("id,travelers_count,travel_date,total_delta_amount,currency,expires_at")
    .eq("session_token_hash", sessionHash)
    .eq("trip_id", tripCtx.tripId)
    .eq("status", "draft")
    .gt("expires_at", nowIso)
    .maybeSingle();

  if (sessionResult.error) {
    throw sessionResult.error;
  }

  if (!sessionResult.data) {
    return null;
  }

  type SessionRow = {
    id: string;
    travelers_count: number;
    travel_date: string | null;
    total_delta_amount: number | string | null;
    currency: string;
    expires_at: string;
  };

  const sess = sessionResult.data as unknown as SessionRow;

  const selectionsResult = await supabase
    .from("trip_option_selections")
    .select(
      "segment_id,option_type,flight_option_id,hotel_option_id,transfer_option_id,activity_option_id,price_delta_amount,currency,metadata",
    )
    .eq("session_id", sess.id)
    .eq("status", "selected");

  if (selectionsResult.error) {
    throw selectionsResult.error;
  }

  type SelectionRow = {
    segment_id: string;
    option_type: string;
    flight_option_id: string | null;
    hotel_option_id: string | null;
    transfer_option_id: string | null;
    activity_option_id: string | null;
    price_delta_amount: number | string;
    currency: string;
    metadata: Record<string, unknown> | null;
  };

  const selectionRows = (selectionsResult.data ?? []) as unknown as SelectionRow[];

  if (selectionRows.length === 0) {
    return null;
  }

  // Batch-load segment titles.
  const segmentIds = [...new Set(selectionRows.map((r) => r.segment_id))];
  const segmentsResult = await supabase
    .from("trip_itinerary_segments")
    .select("id,title")
    .eq("trip_id", tripCtx.tripId)
    .in("id", segmentIds);

  if (segmentsResult.error) {
    throw segmentsResult.error;
  }

  const segmentTitleMap = new Map<string, string>(
    (
      (segmentsResult.data ?? []) as unknown as Array<{
        id: string;
        title: string;
      }>
    ).map((s) => [s.id, s.title]),
  );

  // Batch-load option display info grouped by type.
  const hotelIds = selectionRows
    .filter((r) => r.hotel_option_id)
    .map((r) => r.hotel_option_id!);
  const flightIds = selectionRows
    .filter((r) => r.flight_option_id)
    .map((r) => r.flight_option_id!);
  const transferIds = selectionRows
    .filter((r) => r.transfer_option_id)
    .map((r) => r.transfer_option_id!);
  const activityIds = selectionRows
    .filter((r) => r.activity_option_id)
    .map((r) => r.activity_option_id!);

  const [hotelRes, flightRes, transferRes, activityRes] = await Promise.all([
    hotelIds.length > 0
      ? supabase
          .from("trip_hotel_options")
          .select("id,hotel_name,room_name,board_basis")
          .in("id", hotelIds)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    flightIds.length > 0
      ? supabase
          .from("trip_flight_options")
          .select("id,airline_name,origin_iata,destination_iata")
          .in("id", flightIds)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    transferIds.length > 0
      ? supabase
          .from("trip_transfer_options")
          .select("id,title")
          .in("id", transferIds)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    activityIds.length > 0
      ? supabase
          .from("trip_activity_options")
          .select("id,title")
          .in("id", activityIds)
      : Promise.resolve({ data: [] as unknown[], error: null }),
  ]);

  if (hotelRes.error) throw hotelRes.error;
  if (flightRes.error) throw flightRes.error;
  if (transferRes.error) throw transferRes.error;
  if (activityRes.error) throw activityRes.error;

  type HotelOptRow = {
    id: string;
    hotel_name: string;
    room_name: string | null;
    board_basis: string | null;
  };
  type FlightOptRow = {
    id: string;
    airline_name: string;
    origin_iata: string | null;
    destination_iata: string | null;
  };
  type TransferOptRow = { id: string; title: string };
  type ActivityOptRow = { id: string; title: string };

  const hotelOptMap = new Map<string, HotelOptRow>(
    ((hotelRes.data ?? []) as unknown as HotelOptRow[]).map((h) => [h.id, h]),
  );
  const flightOptMap = new Map<string, FlightOptRow>(
    ((flightRes.data ?? []) as unknown as FlightOptRow[]).map((f) => [f.id, f]),
  );
  const transferOptMap = new Map<string, TransferOptRow>(
    (
      (transferRes.data ?? []) as unknown as TransferOptRow[]
    ).map((t) => [t.id, t]),
  );
  const activityOptMap = new Map<string, ActivityOptRow>(
    (
      (activityRes.data ?? []) as unknown as ActivityOptRow[]
    ).map((a) => [a.id, a]),
  );

  // Validate prebook snapshots for live hotel selections.
  const prebookSnapshotIds = selectionRows
    .filter(
      (r) =>
        isPlainRecord(r.metadata) &&
        typeof r.metadata.prebook_snapshot_id === "string",
    )
    .map((r) => (r.metadata as Record<string, unknown>).prebook_snapshot_id as string);

  type PrebookSafeRow = {
    id: string;
    status: string;
    expires_at: string | null;
    safe_payload: Record<string, unknown> | null;
  };

  const prebookSafeMap = new Map<string, PrebookSafeRow>();

  if (prebookSnapshotIds.length > 0) {
    const prebookRes = await supabase
      .from("provider_quote_snapshots")
      .select("id,status,expires_at,safe_payload")
      .in("id", prebookSnapshotIds);

    if (prebookRes.error) {
      throw prebookRes.error;
    }

    for (const row of (prebookRes.data ?? []) as unknown as PrebookSafeRow[]) {
      prebookSafeMap.set(row.id, row);
    }
  }

  const quoteSnapshotIds = selectionRows
    .filter(
      (r) =>
        isPlainRecord(r.metadata) &&
        typeof r.metadata.quote_snapshot_id === "string",
    )
    .map((r) => (r.metadata as Record<string, unknown>).quote_snapshot_id as string);

  type QuoteSafeRow = {
    id: string;
    safe_payload: Record<string, unknown> | null;
  };

  const quoteSafeMap = new Map<string, QuoteSafeRow>();

  if (quoteSnapshotIds.length > 0) {
    const quoteRes = await supabase
      .from("provider_quote_snapshots")
      .select("id,safe_payload")
      .in("id", quoteSnapshotIds);

    if (quoteRes.error) {
      throw quoteRes.error;
    }

    for (const row of (quoteRes.data ?? []) as unknown as QuoteSafeRow[]) {
      quoteSafeMap.set(row.id, row);
    }
  }

  // Build line items.
  const selections: CheckoutLineItem[] = [];
  let hotelOccupancy: CheckoutGuestRoom[] | undefined;

  for (const row of selectionRows) {
    const segmentTitle = segmentTitleMap.get(row.segment_id) ?? "Option";
    const optionType = row.option_type as ItineraryOptionType;
    let optionLabel = "Selected option";
    let cancellationSummary: string | null | undefined;
    let boardBasis: string | null | undefined;
    let nights: number | null | undefined;

    if (optionType === "hotel" && row.hotel_option_id) {
      const h = hotelOptMap.get(row.hotel_option_id);

      if (h) {
        optionLabel = [h.hotel_name, h.room_name].filter(Boolean).join(" - ");
      }

      const meta = row.metadata;

      if (isPlainRecord(meta) && typeof meta.prebook_snapshot_id === "string") {
        const pb = prebookSafeMap.get(meta.prebook_snapshot_id);

        if (!pb || pb.status !== "selected" || (pb.expires_at && pb.expires_at <= nowIso)) {
          // Prebook expired or invalid - checkout is stale.
          return null;
        }

        const safeP = isPlainRecord(pb.safe_payload) ? pb.safe_payload : {};
        cancellationSummary =
          typeof safeP.cancellation_summary === "string"
            ? safeP.cancellation_summary
            : null;
        boardBasis =
          typeof safeP.board_basis === "string" ? safeP.board_basis : null;
        nights =
          typeof safeP.nights === "number" ? safeP.nights : null;
      }

      if (
        !hotelOccupancy &&
        isPlainRecord(meta) &&
        typeof meta.quote_snapshot_id === "string"
      ) {
        const quote = quoteSafeMap.get(meta.quote_snapshot_id);
        hotelOccupancy = buildCheckoutGuestRooms(
          parseGuestRooms(quote?.safe_payload?.guests),
        );
      }
    } else if (optionType === "flight" && row.flight_option_id) {
      const f = flightOptMap.get(row.flight_option_id);

      if (f) {
        const route =
          f.origin_iata && f.destination_iata
            ? `${f.origin_iata} to ${f.destination_iata}`
            : null;
        optionLabel = [f.airline_name, route].filter(Boolean).join(" ");
      }
    } else if (optionType === "transfer" && row.transfer_option_id) {
      const t = transferOptMap.get(row.transfer_option_id);
      if (t) optionLabel = t.title;
    } else if (optionType === "activity" && row.activity_option_id) {
      const a = activityOptMap.get(row.activity_option_id);
      if (a) optionLabel = a.title;
    }

    selections.push({
      segmentId: row.segment_id,
      segmentTitle,
      type: optionType,
      optionLabel,
      priceDelta: moneyDelta(row.price_delta_amount, row.currency),
      ...(cancellationSummary !== undefined ? { cancellationSummary } : {}),
      ...(boardBasis !== undefined ? { boardBasis } : {}),
      ...(nights !== undefined ? { nights } : {}),
    });
  }

  const totalDeltaAmount = Number(sess.total_delta_amount ?? 0);
  const basePricePerTraveler = tripCtx.priceAmount;
  const travelersCount = sess.travelers_count;
  const baseSubtotal = basePricePerTraveler * travelersCount;
  const selectedOptionsSubtotal = totalDeltaAmount;
  const totalPayable = baseSubtotal + selectedOptionsSubtotal;
  const pricingCurrency = sess.currency || tripCtx.currency;

  const pricing: CheckoutPricing = {
    basePricePerTraveler,
    travelersCount,
    baseSubtotal,
    selectedOptionsSubtotal,
    totalPayable,
    currency: pricingCurrency,
  };

  return {
    trip: {
      id: tripCtx.tripId,
      title: tripCtx.tripTitle,
      destinationSlug: tripCtx.destinationSlug,
      destinationName: tripCtx.destinationName,
      startDate: tripCtx.startDate,
      currency: tripCtx.currency,
    },
    selections,
    travelDate: sess.travel_date ?? undefined,
    travelersCount,
    totalDelta: moneyDelta(totalDeltaAmount, pricingCurrency),
    pricing,
    ...(hotelOccupancy ? { hotelOccupancy } : {}),
    expiresAt: sess.expires_at,
  };
}

export function hashSelectionSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export { SESSION_COOKIE };
