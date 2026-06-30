import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { logServerError } from "@/server/http/response";
import {
  getLocalHotelContent,
  getLocalHotelDestinationSuggestions,
} from "@/server/hotels/content";
import { buildLiveHotelQuotes, buildRequestHash } from "@/server/providers/ratehawk/hotel-options";
import {
  mapMealToBoardBasis,
  searchHotelPage,
  suggestRegionsAndHotels,
  type GuestRoom,
} from "@/server/providers/ratehawk/hotels";
import { getSupabaseAdminClient } from "@/server/supabase/client";
import type {
  HotelDetailDTO,
  HotelDestinationSuggestion,
  HotelGuestRoom,
  HotelRateDTO,
  HotelSearchCardDTO,
  HotelSearchInput,
  HotelSearchResultDTO,
} from "@/types/hotels";

export const HOTEL_SEARCH_COOKIE = "flytime_hotel_search";
export const HOTEL_SEARCH_TTL_SECONDS = 30 * 60;

const QUOTE_TTL_MS = 5 * 60 * 1000;
const RATEHAWK_PROVIDER_SLUG = "ratehawk-hotel";
const MAX_RESULTS = 12;
const SUGGESTION_TTL_MS = 10 * 60 * 1000;
const MAX_SUGGESTION_CACHE_ENTRIES = 100;
const suggestionCache = new Map<
  string,
  { data: HotelDestinationSuggestion[]; expiresAt: number }
>();

type SearchSessionRow = {
  id: string;
  provider_id: string;
  destination_id: string | null;
  external_region_id: number;
  destination_label: string;
  checkin: string;
  checkout: string;
  residency: string;
  currency: string;
  language: string;
  guests: HotelGuestRoom[];
  status: string;
  expires_at: string;
};

type QuoteRow = {
  id: string;
  provider_reference: string;
  currency: string;
  price_amount: number | string | null;
  safe_payload: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  expires_at: string | null;
};

export type HotelSearchSessionForBooking = SearchSessionRow;
export type HotelQuoteSnapshotForBooking = QuoteRow;

export class HotelSearchError extends Error {
  readonly publicStatus: number;
  readonly publicMessage: string;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HotelSearchError";
    this.publicStatus = status;
    this.publicMessage = message;
  }
}

export async function getHotelDestinationSuggestions(
  query: string,
  language = "en",
  signal?: AbortSignal,
): Promise<HotelDestinationSuggestion[]> {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedLanguage = /^[a-z]{2}$/.test(language) ? language : "en";

  if (normalizedQuery.length < 3 || normalizedQuery.length > 80) {
    throw new HotelSearchError(400, "Enter at least 3 characters to search locations.");
  }

  const cacheKey = `${normalizedLanguage}:${normalizedQuery}`;
  const cached = suggestionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const providerId = await getRateHawkProviderId();
  const local = await getLocalHotelDestinationSuggestions(
    providerId,
    normalizedQuery,
    normalizedLanguage,
  );
  if (local.length > 0) {
    suggestionCache.set(cacheKey, {
      data: local,
      expiresAt: Date.now() + SUGGESTION_TTL_MS,
    });
    pruneSuggestionCache();
    return local;
  }

  if (
    (process.env.RATEHAWK_AUTOCOMPLETE_LIVE_FALLBACK_ENABLED ?? "")
      .trim()
      .toLowerCase() !== "true"
  ) {
    suggestionCache.set(cacheKey, {
      data: [],
      expiresAt: Date.now() + SUGGESTION_TTL_MS,
    });
    pruneSuggestionCache();
    return [];
  }

  const provider = await suggestRegionsAndHotels(
    normalizedQuery,
    normalizedLanguage,
    signal,
  );
  const data = provider.regions.slice(0, 10).map((region) => ({
    regionId: region.id,
    name: region.name,
    countryCode: region.countryCode,
    type: region.type,
  }));

  suggestionCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + SUGGESTION_TTL_MS,
  });
  pruneSuggestionCache();
  return data;
}

export async function createHotelSearch(input: HotelSearchInput) {
  const normalized = normalizeSearchInput(input);
  const admin = getSupabaseAdminClient();
  const context = await resolveProviderDestination(normalized);
  const token = randomBytes(32).toString("base64url");
  const sessionTokenHash = hashToken(token);
  const requestHash = buildRequestHash({
    regionId: context.regionId,
    checkin: normalized.checkIn,
    checkout: normalized.checkOut,
    residency: normalized.residency,
    guests: normalized.rooms,
    currency: normalized.currency,
    language: normalized.language,
  });
  const expiresAt = new Date(Date.now() + HOTEL_SEARCH_TTL_SECONDS * 1000).toISOString();

  const created = await admin
    .from("hotel_search_sessions")
    .insert({
      provider_id: context.providerId,
      destination_id: context.destinationId,
      external_region_id: context.regionId,
      destination_label: context.destinationName,
      session_token_hash: sessionTokenHash,
      request_hash: requestHash,
      checkin: normalized.checkIn,
      checkout: normalized.checkOut,
      residency: normalized.residency,
      currency: normalized.currency,
      language: normalized.language,
      guests: normalized.rooms,
      status: "searching",
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (created.error || !created.data) {
    throw created.error ?? new Error("Hotel search session was not created");
  }

  const searchId = (created.data as { id: string }).id;

  try {
    const searchInput = {
      regionId: context.regionId,
      checkin: normalized.checkIn,
      checkout: normalized.checkOut,
      residency: normalized.residency,
      guests: normalized.rooms,
      currency: normalized.currency,
      language: normalized.language,
      limit: MAX_RESULTS,
    };
    const quotes = await buildLiveHotelQuotes(searchInput, (hotelIds) =>
      getLocalHotelContent(context.providerId, hotelIds, normalized.language),
    );
    const quoteExpiresAt = new Date(Date.now() + QUOTE_TTL_MS).toISOString();

    if (quotes.length > 0) {
      const inserted = await admin
        .from("provider_quote_snapshots")
        .insert(
          quotes.map((quote) => ({
            provider_id: context.providerId,
            search_session_id: searchId,
            service_type: "hotel",
            request_hash: requestHash,
            provider_reference: quote.hotelId,
            currency: quote.currency,
            price_amount: quote.priceAmount,
            price_delta_amount: quote.priceAmount,
            expires_at: quoteExpiresAt,
            status: "available",
            safe_payload: {
              stage: "serp",
              hid: quote.hid,
              name: quote.name,
              address: quote.address,
              image_url: quote.imageUrl,
              star_rating: quote.starRating,
              room_name: quote.roomName,
              board_basis: quote.boardBasis ?? null,
              nights: nightsBetween(normalized.checkIn, normalized.checkOut),
            },
            metadata: {
              search_hash: quote.searchHash,
              match_hash: quote.matchHash,
            },
          })),
        );

      if (inserted.error) throw inserted.error;
    }

    const ready = await admin
      .from("hotel_search_sessions")
      .update({ status: "ready" })
      .eq("id", searchId);

    if (ready.error) throw ready.error;

    return { searchId, token };
  } catch (error) {
    await admin
      .from("hotel_search_sessions")
      .update({ status: "failed" })
      .eq("id", searchId);
    throw error;
  }
}

export async function getHotelSearchResults(
  searchId: string,
  token: string | undefined,
): Promise<HotelSearchResultDTO | null> {
  const context = await readOwnedSession(searchId, token);
  if (!context) return null;

  const quotes = await readSearchQuotes(context.id, "serp");

  return {
    searchId: context.id,
    destination: {
      slug: context.destination_id ?? String(context.external_region_id),
      name: context.destination_label,
    },
    checkIn: context.checkin,
    checkOut: context.checkout,
    rooms: context.guests,
    residency: context.residency,
    expiresAt: context.expires_at,
    hotels: quotes.map(mapSearchCard),
  };
}

export async function getHotelDetail(
  searchId: string,
  hotelId: string,
  token: string | undefined,
): Promise<HotelDetailDTO | null> {
  const context = await readOwnedSession(searchId, token);
  if (!context) return null;

  const searchQuote = (await readSearchQuotes(context.id, "serp")).find(
    (quote) => quote.provider_reference === hotelId,
  );

  if (!searchQuote) return null;

  // ETG prohibits caching/reusing Hotelpage responses. Always retrieve a
  // fresh Hotelpage. Rows persisted below are transient selection state only
  // and are never read back to render a later Hotelpage request.
  const detailQuotes = await createHotelPageQuotes(context, searchQuote);

  return {
    searchId: context.id,
    hotel: {
      ...mapSearchCard(searchQuote),
      quoteId: undefined,
    } as Omit<HotelSearchCardDTO, "quoteId">,
    checkIn: context.checkin,
    checkOut: context.checkout,
    rooms: context.guests,
    rates: detailQuotes.map(mapDetailRate),
    expiresAt: context.expires_at,
  };
}

export async function getOwnedHotelSearchSessionForBooking(
  searchId: string,
  token: string | undefined,
): Promise<HotelSearchSessionForBooking | null> {
  return readOwnedSession(searchId, token);
}

export async function getHotelQuoteSnapshotForBooking({
  searchId,
  hotelId,
  quoteId,
  stage,
}: {
  searchId: string;
  hotelId: string;
  quoteId: string;
  stage: "serp" | "hotelpage";
}): Promise<HotelQuoteSnapshotForBooking | null> {
  if (!isUuid(searchId) || !isUuid(quoteId) || !hotelId.trim()) return null;

  const result = await getSupabaseAdminClient()
    .from("provider_quote_snapshots")
    .select("id,provider_reference,currency,price_amount,safe_payload,metadata,expires_at")
    .eq("id", quoteId)
    .eq("search_session_id", searchId)
    .eq("provider_reference", hotelId)
    .eq("service_type", "hotel")
    .eq("status", "available")
    .eq("safe_payload->>stage", stage)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (result.error) throw result.error;
  return (result.data as unknown as QuoteRow | null) ?? null;
}

async function createHotelPageQuotes(
  context: SearchSessionRow,
  searchQuote: QuoteRow,
): Promise<QuoteRow[]> {
  const matchHash = readText(searchQuote.metadata?.match_hash);
  const rates = await searchHotelPage({
    hotelId: searchQuote.provider_reference,
    matchHash,
    checkin: context.checkin,
    checkout: context.checkout,
    residency: context.residency,
    guests: context.guests,
    currency: context.currency,
    language: context.language,
  });
  const expiresAt = new Date(Date.now() + QUOTE_TTL_MS).toISOString();

  if (rates.length === 0) return [];

  const admin = getSupabaseAdminClient();
  const expirePrevious = await admin
    .from("provider_quote_snapshots")
    .update({ status: "expired" })
    .eq("search_session_id", context.id)
    .eq("provider_reference", searchQuote.provider_reference)
    .eq("safe_payload->>stage", "hotelpage")
    .eq("status", "available");
  if (expirePrevious.error) throw expirePrevious.error;

  const inserted = await admin
    .from("provider_quote_snapshots")
    .insert(
      rates.slice(0, 20).map((rate, index) => ({
        provider_id: context.provider_id,
        search_session_id: context.id,
        service_type: "hotel",
        request_hash: `hotelpage:${context.id}:${searchQuote.provider_reference}:${index}`,
        provider_reference: searchQuote.provider_reference,
        currency: rate.currency ?? context.currency,
        price_amount: rate.priceAmount,
        price_delta_amount: rate.priceAmount,
        expires_at: expiresAt,
        status: "available",
        safe_payload: {
          stage: "hotelpage",
          room_name: rate.roomName,
          board_basis: mapMealToBoardBasis(rate.meal) ?? null,
        },
        metadata: {
          search_hash: rate.searchHash,
          match_hash: rate.matchHash,
          book_hash: rate.bookHash,
        },
      })),
    )
    .select("id,provider_reference,currency,price_amount,safe_payload,metadata,expires_at");

  if (inserted.error) throw inserted.error;
  return (inserted.data ?? []) as unknown as QuoteRow[];
}

async function readOwnedSession(searchId: string, token: string | undefined) {
  if (!isUuid(searchId) || !token || token.length > 128) return null;

  const result = await getSupabaseAdminClient()
    .from("hotel_search_sessions")
    .select(
      "id,provider_id,destination_id,external_region_id,destination_label,checkin,checkout,residency,currency,language,guests,status,expires_at",
    )
    .eq("id", searchId)
    .eq("session_token_hash", hashToken(token))
    .eq("status", "ready")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (result.error) {
    logServerError("hotels.search.session", result.error);
    return null;
  }

  return result.data as SearchSessionRow | null;
}

async function readSearchQuotes(searchId: string, stage: "serp" | "hotelpage") {
  const result = await getSupabaseAdminClient()
    .from("provider_quote_snapshots")
    .select("id,provider_reference,currency,price_amount,safe_payload,metadata,expires_at")
    .eq("search_session_id", searchId)
    .eq("service_type", "hotel")
    .eq("status", "available")
    .eq("safe_payload->>stage", stage)
    .gt("expires_at", new Date().toISOString())
    .order("price_amount", { ascending: true });

  if (result.error) throw result.error;
  return (result.data ?? []) as unknown as QuoteRow[];
}

async function resolveProviderDestination(input: {
  destinationSlug?: string;
  providerRegionId?: number;
  destinationName?: string;
}) {
  const admin = getSupabaseAdminClient();
  const provider = await admin
    .from("external_providers")
    .select("id")
    .eq("slug", RATEHAWK_PROVIDER_SLUG)
    .eq("is_active", true)
    .maybeSingle();

  if (provider.error) throw provider.error;
  if (!provider.data) {
    throw new HotelSearchError(503, "Hotel search is not available right now.");
  }

  if (
    Number.isSafeInteger(input.providerRegionId) &&
    Number(input.providerRegionId) > 0 &&
    input.destinationName?.trim()
  ) {
    const mapped = await admin
      .from("provider_destination_mappings")
      .select("destination_id")
      .eq("provider_id", provider.data.id)
      .eq("external_region_id", input.providerRegionId!)
      .eq("status", "published")
      .maybeSingle();

    if (mapped.error) throw mapped.error;

    return {
      destinationId: (mapped.data?.destination_id as string | undefined) ?? null,
      destinationName: input.destinationName.trim().slice(0, 160),
      providerId: provider.data.id as string,
      regionId: Number(input.providerRegionId),
    };
  }

  const slug = input.destinationSlug?.trim().toLowerCase();
  if (!slug) {
    throw new HotelSearchError(400, "Please choose a destination from the search suggestions.");
  }

  const destination = await admin
    .from("destinations")
    .select("id,slug,name")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (destination.error) throw destination.error;
  if (!destination.data) {
    throw new HotelSearchError(404, "This destination is not available for hotel search.");
  }

  const mapping = await admin
    .from("provider_destination_mappings")
    .select("external_region_id")
    .eq("provider_id", provider.data.id)
    .eq("destination_id", destination.data.id)
    .eq("status", "published")
    .maybeSingle();
  if (mapping.error) throw mapping.error;
  if (!mapping.data) {
    throw new HotelSearchError(404, "Hotel search is not available for this destination yet.");
  }

  return {
    destinationId: destination.data.id as string,
    destinationName: destination.data.name as string,
    providerId: provider.data.id as string,
    regionId: Number(mapping.data.external_region_id),
  };
}

async function getRateHawkProviderId(): Promise<string> {
  const provider = await getSupabaseAdminClient()
    .from("external_providers")
    .select("id")
    .eq("slug", RATEHAWK_PROVIDER_SLUG)
    .eq("is_active", true)
    .maybeSingle();

  if (provider.error) throw provider.error;
  if (!provider.data) {
    throw new HotelSearchError(503, "Hotel search is not available right now.");
  }

  return provider.data.id as string;
}

function normalizeSearchInput(input: HotelSearchInput) {
  const destinationSlug = input.destinationSlug?.trim().toLowerCase();
  const providerRegionId = Number(input.providerRegionId);
  const destinationName = input.destinationName?.trim();
  const residency = input.residency?.trim().toLowerCase();
  const currency = (input.currency ?? "SAR").trim().toUpperCase();
  const language = (input.language ?? "en").trim().toLowerCase();

  const hasProviderRegion =
    Number.isSafeInteger(providerRegionId) &&
    providerRegionId > 0 &&
    Boolean(destinationName);
  const hasDestinationSlug =
    typeof destinationSlug === "string" &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(destinationSlug);

  if (!hasProviderRegion && !hasDestinationSlug) {
    throw new HotelSearchError(400, "Please choose a valid destination.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(input.checkOut)) {
    throw new HotelSearchError(400, "Please choose valid check-in and check-out dates.");
  }
  if (!/^[a-z]{2}$/.test(residency)) {
    throw new HotelSearchError(400, "Please choose the lead guest's passport country.");
  }
  if (!/^[A-Z]{3}$/.test(currency) || !/^[a-z]{2}$/.test(language)) {
    throw new HotelSearchError(400, "The hotel search currency or language is invalid.");
  }

  const rooms = normalizeRooms(input.rooms);
  const checkInTime = Date.parse(`${input.checkIn}T00:00:00Z`);
  const checkOutTime = Date.parse(`${input.checkOut}T00:00:00Z`);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const nights = Math.round((checkOutTime - checkInTime) / 86_400_000);

  if (!Number.isFinite(checkInTime) || !Number.isFinite(checkOutTime) || checkInTime < today.getTime() || nights < 1 || nights > 30) {
    throw new HotelSearchError(400, "Choose a future stay between 1 and 30 nights.");
  }

  return {
    destinationSlug,
    providerRegionId: hasProviderRegion ? providerRegionId : undefined,
    destinationName: hasProviderRegion ? destinationName : undefined,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    residency,
    currency,
    language,
    rooms,
  };
}

function normalizeRooms(rooms: HotelGuestRoom[]): GuestRoom[] {
  if (!Array.isArray(rooms) || rooms.length < 1 || rooms.length > 4) {
    throw new HotelSearchError(400, "Choose between 1 and 4 rooms.");
  }

  return rooms.map((room) => {
    if (!room || typeof room !== "object" || Array.isArray(room)) {
      throw new HotelSearchError(400, "Each room must include its guests.");
    }

    const adults = Number(room.adults);
    const rawChildren = room.children;

    if (!Number.isInteger(adults) || adults < 1 || adults > 6) {
      throw new HotelSearchError(400, "Each room needs between 1 and 6 adults.");
    }
    if (!Array.isArray(rawChildren) || rawChildren.length > 4) {
      throw new HotelSearchError(400, "Each room supports up to 4 children.");
    }
    const children = rawChildren.map(Number);
    if (children.some((age) => !Number.isInteger(age) || age < 0 || age > 17)) {
      throw new HotelSearchError(400, "Child ages must be between 0 and 17.");
    }
    return { adults, children };
  });
}

function mapSearchCard(row: QuoteRow): HotelSearchCardDTO {
  const safe = row.safe_payload ?? {};
  return {
    quoteId: row.id,
    hotelId: row.provider_reference,
    name: readText(safe.name) ?? "Hotel",
    address: readText(safe.address),
    imageUrl: readHttpsUrl(safe.image_url),
    starRating: readNullableNumber(safe.star_rating),
    roomName: readText(safe.room_name),
    boardBasis: readText(safe.board_basis),
    priceAmount: Number(row.price_amount) || 0,
    currency: row.currency,
    nights: readNullableNumber(safe.nights) ?? 1,
  };
}

function mapDetailRate(row: QuoteRow): HotelRateDTO {
  const safe = row.safe_payload ?? {};
  return {
    rateId: row.id,
    roomName: readText(safe.room_name),
    boardBasis: readText(safe.board_basis),
    priceAmount: Number(row.price_amount) || 0,
    currency: row.currency,
  };
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function nightsBetween(checkIn: string, checkOut: string) {
  return Math.round(
    (Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) /
      86_400_000,
  );
}

function readText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readHttpsUrl(value: unknown) {
  const text = readText(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function readNullableNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function pruneSuggestionCache() {
  const now = Date.now();
  for (const [key, value] of suggestionCache) {
    if (value.expiresAt <= now) suggestionCache.delete(key);
  }
  while (suggestionCache.size > MAX_SUGGESTION_CACHE_ENTRIES) {
    const oldest = suggestionCache.keys().next().value as string | undefined;
    if (!oldest) break;
    suggestionCache.delete(oldest);
  }
}
