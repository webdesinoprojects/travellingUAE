import "server-only";

import { createHash } from "node:crypto";

import { rateHawkRequest, RateHawkError } from "./client";

/**
 * Hotel adapter for the RateHawk / ETG API v3.
 *
 * Only endpoints verified verbatim from the official ETG documentation and the
 * official EmergingTravel papi-sdk are implemented here:
 *
 * - GET  /api/b2b/v3/overview/              -> credentials & permission check
 * - POST /api/b2b/v3/search/multicomplete/  -> region/hotel autocomplete
 * - POST /api/b2b/v3/search/serp/region/    -> hotel search by region
 *
 * Hotelpage (POST /api/b2b/v3/search/hp/), prebook and booking are NOT
 * implemented in this slice. Their paths are recorded in the phase-5 notes so
 * the next slice does not have to re-derive them. See HP-2/HP-3 in
 * dev/claude-hotels-packages-plan.md.
 *
 * Everything returned from this module is a sanitized DTO. Raw provider
 * payloads, internal hashes that are not required downstream, auth headers and
 * credentials never leave the server.
 */

// ---- Verified endpoint paths ----------------------------------------------

export const RATEHAWK_ENDPOINTS = {
  overview: "/api/b2b/v3/overview/",
  multicomplete: "/api/b2b/v3/search/multicomplete/",
  serpRegion: "/api/b2b/v3/search/serp/region/",
  hotelInfo: "/api/b2b/v3/hotel/info/",
} as const;

// Timeouts aligned with submitted RateHawk commitments.
const SEARCH_TIMEOUT_MS = 30_000;
const SUGGEST_TIMEOUT_MS = 10_000;
const OVERVIEW_TIMEOUT_MS = 8_000;

// ---- Public DTOs -----------------------------------------------------------

export type RateHawkEndpointPermissionDTO = {
  /** Endpoint path the key may call, e.g. "search/serp/region". */
  endpoint: string;
  active: boolean;
  limited: boolean;
  /** Provider-side request budget for this endpoint, if limited. */
  requestsPerWindow: number | null;
  windowSeconds: number | null;
};

export type RateHawkOverviewDTO = {
  available: boolean;
  /** Endpoints the active key may call, with active flag and rate limits. */
  endpoints: RateHawkEndpointPermissionDTO[];
};

export type RegionSuggestionDTO = {
  id: number;
  name: string;
  type: string;
  countryCode: string | null;
};

export type HotelSuggestionDTO = {
  hid: number;
  name: string;
  regionId: number | null;
};

export type SuggestDTO = {
  regions: RegionSuggestionDTO[];
  hotels: HotelSuggestionDTO[];
};

export type HotelRateSummaryDTO = {
  hid: number;
  /** Number of bookable rates returned for this hotel. */
  ratesCount: number;
  /** Cheapest displayed amount across rates, as a number. */
  cheapestAmount: number | null;
  currency: string | null;
};

export type HotelSearchDTO = {
  totalHotels: number;
  returnedHotels: number;
  /** Cheapest displayed amount across the whole result set. */
  cheapestAmount: number | null;
  currency: string | null;
  /** Bounded sample of hotels for preview / UI. Never the full raw payload. */
  hotels: HotelRateSummaryDTO[];
  cached: boolean;
};

export type GuestRoom = {
  adults: number;
  children: number[];
};

export type HotelSearchParams = {
  regionId: number;
  checkin: string; // YYYY-MM-DD
  checkout: string; // YYYY-MM-DD
  residency: string; // ISO 3166-1 alpha-2 lowercase
  guests: GuestRoom[];
  currency?: string;
  language?: string;
  hotelsLimit?: number;
  signal?: AbortSignal;
};

// ---- Validation helpers ----------------------------------------------------

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_COUNTRY_RE = /^[a-z]{2}$/;
const ISO_CURRENCY_RE = /^[A-Z]{3}$/;
const LANGUAGE_RE = /^[a-z]{2}$/;

export class HotelSearchValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HotelSearchValidationError";
  }
}

function assertValidDate(label: string, value: string): Date {
  if (!ISO_DATE_RE.test(value)) {
    throw new HotelSearchValidationError(`${label} must be in YYYY-MM-DD format`);
  }

  const date = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    throw new HotelSearchValidationError(`${label} is not a valid date`);
  }

  return date;
}

function validateSearchParams(params: HotelSearchParams): void {
  if (!Number.isInteger(params.regionId) || params.regionId <= 0) {
    throw new HotelSearchValidationError("A valid region is required");
  }

  const checkin = assertValidDate("checkin", params.checkin);
  const checkout = assertValidDate("checkout", params.checkout);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  if (checkin.getTime() < today.getTime()) {
    throw new HotelSearchValidationError("checkin cannot be in the past");
  }

  const maxAhead = new Date(today);
  maxAhead.setUTCDate(maxAhead.getUTCDate() + 730);

  if (checkin.getTime() > maxAhead.getTime()) {
    throw new HotelSearchValidationError("checkin is too far in the future");
  }

  const nights = Math.round(
    (checkout.getTime() - checkin.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (nights <= 0) {
    throw new HotelSearchValidationError("checkout must be after checkin");
  }

  if (nights > 30) {
    throw new HotelSearchValidationError("stay length cannot exceed 30 nights");
  }

  if (!ISO_COUNTRY_RE.test(params.residency)) {
    throw new HotelSearchValidationError(
      "residency must be a 2-letter country code",
    );
  }

  if (!Array.isArray(params.guests) || params.guests.length === 0) {
    throw new HotelSearchValidationError("at least one room is required");
  }

  if (params.guests.length > 4) {
    throw new HotelSearchValidationError("a maximum of 4 rooms is supported");
  }

  for (const room of params.guests) {
    if (!Number.isInteger(room.adults) || room.adults < 1 || room.adults > 6) {
      throw new HotelSearchValidationError("each room needs 1-6 adults");
    }

    if (!Array.isArray(room.children) || room.children.length > 4) {
      throw new HotelSearchValidationError(
        "each room supports a maximum of 4 children",
      );
    }

    for (const age of room.children) {
      if (!Number.isInteger(age) || age < 0 || age > 17) {
        throw new HotelSearchValidationError("child ages must be 0-17");
      }
    }
  }

  if (params.currency && !ISO_CURRENCY_RE.test(params.currency)) {
    throw new HotelSearchValidationError("currency must be a 3-letter code");
  }

  if (params.language && !LANGUAGE_RE.test(params.language)) {
    throw new HotelSearchValidationError("language must be a 2-letter code");
  }
}

// ---- Safe parsing helpers --------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toCleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/**
 * ETG serp rate prices live at
 * rate.payment_options.payment_types[].show_amount / show_currency_code
 * (display currency = the currency we requested). Returns the lowest
 * payment-type amount for the rate.
 */
function extractRatePrice(
  rateRecord: Record<string, unknown> | null,
): { amount: number; currency: string | null } | null {
  const paymentOptions = asRecord(rateRecord?.payment_options);
  const paymentTypes = asArray(paymentOptions?.payment_types);

  let best: { amount: number; currency: string | null } | null = null;

  for (const pt of paymentTypes) {
    const ptRecord = asRecord(pt);
    const amount = toFiniteNumber(ptRecord?.show_amount);

    if (amount === null) {
      continue;
    }

    const currency = toCleanString(ptRecord?.show_currency_code);

    if (best === null || amount < best.amount) {
      best = { amount, currency };
    }
  }

  return best;
}

/**
 * Maps RateHawk meal slugs to the internal Fly Time board-basis labels agreed
 * in the implementation commitments. Unknown values keep a safe generic label
 * (never silently upgraded).
 */
export function mapMealToBoardBasis(meal: string | null): string | undefined {
  if (!meal) {
    return undefined;
  }

  const slug = meal.trim().toLowerCase().replace(/[\s-]+/g, "");

  switch (slug) {
    case "nomeal":
    case "roomonly":
      return "Room Only";
    case "breakfast":
    case "breakfastbuffet":
    case "continentalbreakfast":
    case "americanbreakfast":
    case "englishbreakfast":
      return "Breakfast Included";
    case "halfboard":
    case "halfboardbreakfastanddinner":
    case "halfboardbreakfastandlunch":
      return "Half Board";
    case "fullboard":
      return "Full Board";
    case "allinclusive":
      return "All Inclusive";
    default:
      return "No Meal";
  }
}

/**
 * Replaces the ETG `{size}` template token in a static image URL with a
 * concrete size. Returns null if the value is not a usable https URL.
 */
function buildStaticImageUrl(
  template: string | null,
  size = "640x400",
): string | null {
  if (!template) {
    return null;
  }

  const url = template.replace("{size}", size);

  return url.startsWith("https://") ? url : null;
}

// ---- In-memory search cache (5-minute browse cache per commitments) --------

const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const SEARCH_CACHE_MAX_ENTRIES = 500;

type CacheEntry = { value: HotelSearchDTO; expiresAt: number };

const searchCache = new Map<string, CacheEntry>();

function cacheKey(params: HotelSearchParams): string {
  const normalized = {
    regionId: params.regionId,
    checkin: params.checkin,
    checkout: params.checkout,
    residency: params.residency,
    currency: params.currency ?? "",
    language: params.language ?? "",
    guests: params.guests.map((room) => ({
      adults: room.adults,
      children: [...room.children].sort((a, b) => a - b),
    })),
  };

  return createHash("sha1").update(JSON.stringify(normalized)).digest("hex");
}

function readCache(key: string): HotelSearchDTO | null {
  const entry = searchCache.get(key);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt < Date.now()) {
    searchCache.delete(key);
    return null;
  }

  return { ...entry.value, cached: true };
}

function writeCache(key: string, value: HotelSearchDTO): void {
  if (searchCache.size >= SEARCH_CACHE_MAX_ENTRIES) {
    // Drop the oldest inserted entry to bound memory under load.
    const oldest = searchCache.keys().next().value;

    if (oldest !== undefined) {
      searchCache.delete(oldest);
    }
  }

  searchCache.set(key, { value, expiresAt: Date.now() + SEARCH_CACHE_TTL_MS });
}

// ---- Adapter operations ----------------------------------------------------

/**
 * GET /api/b2b/v3/overview/
 * Confirms the active key works and lists the endpoints it may call.
 */
export async function getRateHawkOverview(
  signal?: AbortSignal,
): Promise<RateHawkOverviewDTO> {
  const response = await rateHawkRequest<unknown>(RATEHAWK_ENDPOINTS.overview, {
    method: "GET",
    timeoutMs: OVERVIEW_TIMEOUT_MS,
    idempotent: true,
    signal,
  });

  // ETG overview returns `data` as an array of permission objects shaped:
  // { endpoint, is_active, is_limited, requests_number, seconds_number }.
  // Stay resilient if it is ever wrapped under `data.api`.
  const data = asRecord(response.data);
  const list =
    asArray(response.data).length > 0
      ? asArray(response.data)
      : asArray(data?.api);

  const endpoints = list
    .map((entry) => {
      const record = asRecord(entry);

      if (!record) {
        return null;
      }

      const endpoint =
        toCleanString(record.endpoint) ??
        toCleanString(record.id) ??
        toCleanString(record.name);

      if (!endpoint) {
        return null;
      }

      return {
        endpoint,
        active: record.is_active === true || record.active === true,
        limited: record.is_limited === true,
        requestsPerWindow: toFiniteNumber(record.requests_number),
        windowSeconds: toFiniteNumber(record.seconds_number),
      };
    })
    .filter(
      (entry): entry is RateHawkEndpointPermissionDTO => entry !== null,
    );

  return {
    available: true,
    endpoints,
  };
}

/**
 * POST /api/b2b/v3/search/multicomplete/
 * Region/hotel autocomplete used to resolve a region_id before searching.
 */
export async function suggestRegionsAndHotels(
  query: string,
  language = "en",
  signal?: AbortSignal,
): Promise<SuggestDTO> {
  const trimmed = query.trim();

  if (trimmed.length < 2) {
    throw new HotelSearchValidationError("query must be at least 2 characters");
  }

  if (trimmed.length > 100) {
    throw new HotelSearchValidationError("query is too long");
  }

  const lang = LANGUAGE_RE.test(language) ? language : "en";

  const response = await rateHawkRequest<unknown>(
    RATEHAWK_ENDPOINTS.multicomplete,
    {
      method: "POST",
      body: { query: trimmed, language: lang },
      timeoutMs: SUGGEST_TIMEOUT_MS,
      idempotent: true,
      signal,
    },
  );

  const data = asRecord(response.data);

  const regions = asArray(data?.regions)
    .map((entry) => {
      const record = asRecord(entry);
      const id = toFiniteNumber(record?.id);
      const name = toCleanString(record?.name);

      if (id === null || !name) {
        return null;
      }

      return {
        id,
        name,
        type: toCleanString(record?.type) ?? "unknown",
        countryCode: toCleanString(record?.country_code),
      };
    })
    .filter((entry): entry is RegionSuggestionDTO => entry !== null);

  const hotels = asArray(data?.hotels)
    .map((entry) => {
      const record = asRecord(entry);
      const hid = toFiniteNumber(record?.hid);
      const name = toCleanString(record?.name);

      if (hid === null || !name) {
        return null;
      }

      return {
        hid,
        name,
        regionId: toFiniteNumber(record?.region_id),
      };
    })
    .filter((entry): entry is HotelSuggestionDTO => entry !== null);

  return { regions, hotels };
}

/**
 * POST /api/b2b/v3/search/serp/region/
 * Hotel availability search by region. Returns a sanitized summary DTO.
 */
export async function searchHotelsByRegion(
  params: HotelSearchParams,
): Promise<HotelSearchDTO> {
  validateSearchParams(params);

  const key = cacheKey(params);
  const cached = readCache(key);

  if (cached) {
    return cached;
  }

  const response = await rateHawkRequest<unknown>(
    RATEHAWK_ENDPOINTS.serpRegion,
    {
      method: "POST",
      body: buildSerpBody(params),
      timeoutMs: SEARCH_TIMEOUT_MS,
      idempotent: true,
      signal: params.signal,
    },
  );

  const data = asRecord(response.data);
  const rawHotels = asArray(data?.hotels);

  let cheapestOverall: number | null = null;
  let overallCurrency: string | null = params.currency ?? null;

  const hotels: HotelRateSummaryDTO[] = rawHotels
    .map((entry) => {
      const record = asRecord(entry);
      const hid = toFiniteNumber(record?.hid);

      if (hid === null) {
        return null;
      }

      const rates = asArray(record?.rates);
      let cheapest: number | null = null;
      let currency: string | null = null;

      for (const rate of rates) {
        const price = extractRatePrice(asRecord(rate));

        if (price === null) {
          continue;
        }

        if (cheapest === null || price.amount < cheapest) {
          cheapest = price.amount;
          currency = price.currency ?? currency;
        }
      }

      if (
        cheapest !== null &&
        (cheapestOverall === null || cheapest < cheapestOverall)
      ) {
        cheapestOverall = cheapest;
        overallCurrency = currency ?? overallCurrency;
      }

      return {
        hid,
        ratesCount: rates.length,
        cheapestAmount: cheapest,
        currency,
      };
    })
    .filter((entry): entry is HotelRateSummaryDTO => entry !== null);

  const totalHotels =
    toFiniteNumber(data?.total_hotels) ?? hotels.length;

  const dto: HotelSearchDTO = {
    totalHotels,
    returnedHotels: hotels.length,
    cheapestAmount: cheapestOverall,
    currency: overallCurrency,
    hotels: hotels.slice(0, 40),
    cached: false,
  };

  writeCache(key, dto);

  return dto;
}

function buildSerpBody(params: HotelSearchParams): Record<string, unknown> {
  const body: Record<string, unknown> = {
    checkin: params.checkin,
    checkout: params.checkout,
    region_id: params.regionId,
    residency: params.residency,
    guests: params.guests.map((room) => ({
      adults: room.adults,
      children: room.children,
    })),
    hotels_limit: params.hotelsLimit ?? 50,
  };

  if (params.currency) {
    body.currency = params.currency;
  }

  if (params.language) {
    body.language = params.language;
  }

  return body;
}

/**
 * Per-hotel detailed rate from a region search, including the server-only
 * hashes needed later for hotelpage/prebook. NEVER expose searchHash/matchHash
 * to the browser.
 */
export type RegionRateDetail = {
  hid: number;
  /** ETG string hotel id, required for the hotel/info static call. */
  hotelId: string;
  priceAmount: number;
  currency: string | null;
  roomName: string | null;
  /** Raw provider meal slug (server-side); map with mapMealToBoardBasis. */
  meal: string | null;
  /** Server-only. Required for HP-3 hotelpage/prebook. Do not expose. */
  searchHash: string | null;
  /** Server-only. Do not expose. */
  matchHash: string | null;
};

/**
 * POST /api/b2b/v3/search/serp/region/
 * Returns the cheapest bookable rate per hotel with the server-only hashes.
 */
export async function searchRegionRatesDetailed(
  params: HotelSearchParams,
): Promise<RegionRateDetail[]> {
  validateSearchParams(params);

  const response = await rateHawkRequest<unknown>(
    RATEHAWK_ENDPOINTS.serpRegion,
    {
      method: "POST",
      body: buildSerpBody(params),
      timeoutMs: SEARCH_TIMEOUT_MS,
      idempotent: true,
      signal: params.signal,
    },
  );

  const data = asRecord(response.data);

  return asArray(data?.hotels)
    .map((entry): RegionRateDetail | null => {
      const record = asRecord(entry);
      const hid = toFiniteNumber(record?.hid);
      const hotelId = toCleanString(record?.id);

      if (hid === null || !hotelId) {
        return null;
      }

      let best: { amount: number; currency: string | null; rate: Record<string, unknown> | null } | null =
        null;

      for (const rate of asArray(record?.rates)) {
        const rateRecord = asRecord(rate);
        const price = extractRatePrice(rateRecord);

        if (price === null) {
          continue;
        }

        if (best === null || price.amount < best.amount) {
          best = { amount: price.amount, currency: price.currency, rate: rateRecord };
        }
      }

      if (best === null) {
        return null;
      }

      return {
        hid,
        hotelId,
        priceAmount: best.amount,
        currency: best.currency,
        roomName: toCleanString(best.rate?.room_name),
        meal: toCleanString(best.rate?.meal),
        searchHash: toCleanString(best.rate?.search_hash),
        matchHash: toCleanString(best.rate?.match_hash),
      };
    })
    .filter((entry): entry is RegionRateDetail => entry !== null);
}

export type HotelStaticInfo = {
  hotelId: string;
  name: string;
  starRating: number | null;
  imageUrl: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
};

/**
 * POST /api/b2b/v3/hotel/info/
 * Best-effort static content (name, star, image, address) for one hotel.
 * Returns null on any failure so it never blocks a live search.
 */
export async function getHotelStaticInfo(
  hotelId: string,
  language = "en",
  signal?: AbortSignal,
): Promise<HotelStaticInfo | null> {
  const id = hotelId.trim();

  if (!id || id.length > 120) {
    return null;
  }

  const lang = LANGUAGE_RE.test(language) ? language : "en";

  try {
    const response = await rateHawkRequest<unknown>(
      RATEHAWK_ENDPOINTS.hotelInfo,
      {
        method: "POST",
        body: { id, language: lang },
        timeoutMs: SUGGEST_TIMEOUT_MS,
        idempotent: true,
        signal,
      },
    );

    const data = asRecord(response.data);
    const name = toCleanString(data?.name);

    if (!data || !name) {
      return null;
    }

    const images = asArray(data.images);
    const firstImage = images.length > 0 ? toCleanString(images[0]) : null;

    return {
      hotelId: id,
      name,
      starRating: toFiniteNumber(data.star_rating),
      imageUrl: buildStaticImageUrl(firstImage),
      address: toCleanString(data.address),
      latitude: toFiniteNumber(data.latitude),
      longitude: toFiniteNumber(data.longitude),
    };
  } catch {
    return null;
  }
}

export { RateHawkError };
