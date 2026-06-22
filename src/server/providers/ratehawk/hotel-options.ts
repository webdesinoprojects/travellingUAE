import "server-only";

import { createHash } from "node:crypto";

import {
  mapMealToBoardBasis,
  searchRegionRatesDetailed,
  type GuestRoom,
  type HotelSearchParams,
} from "./hotels";
import type { LocalHotelContent } from "@/server/hotels/content";

/**
 * Orchestrates a live RateHawk hotel search into safe, displayable quotes for
 * the package hotel-option flow (HP-2).
 *
 * Flow: region search (detailed rates) -> enrich the cheapest N hotels with
 * static content (name/star/image/address) -> return safe quotes.
 *
 * The server-only `searchHash` / `matchHash` are carried through for the future
 * prebook step (HP-3) but MUST NOT be exposed to the browser. The DAL stores
 * them inside the provider quote snapshot (admin-only table) and never returns
 * them in a public DTO.
 */

export type LiveHotelQuote = {
  hid: number;
  hotelId: string;
  name: string;
  starRating: number | null;
  imageUrl: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  roomName: string | null;
  boardBasis: string | undefined;
  priceAmount: number;
  currency: string;
  /** Server-only — for HP-3 prebook. Never send to the browser. */
  searchHash: string | null;
  /** Server-only — for HP-3 prebook. Never send to the browser. */
  matchHash: string | null;
};

export type LiveHotelSearchInput = {
  regionId: number;
  checkin: string;
  checkout: string;
  residency: string;
  guests: GuestRoom[];
  currency: string;
  language?: string;
  /** How many cheapest hotels to enrich + return. Bounded for page load. */
  limit?: number;
  signal?: AbortSignal;
};

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 24;

/**
 * Deterministic hash of the price-affecting search inputs. Used by the DAL to
 * reuse persisted live options instead of re-searching on every request.
 */
export function buildRequestHash(input: LiveHotelSearchInput): string {
  const normalized = {
    regionId: input.regionId,
    checkin: input.checkin,
    checkout: input.checkout,
    residency: input.residency,
    currency: input.currency,
    guests: input.guests.map((room) => ({
      adults: room.adults,
      children: [...room.children].sort((a, b) => a - b),
    })),
  };

  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export async function buildLiveHotelQuotes(
  input: LiveHotelSearchInput,
  loadContent: (
    hotelIds: string[],
  ) => Promise<Map<string, LocalHotelContent>>,
): Promise<LiveHotelQuote[]> {
  const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

  const params: HotelSearchParams = {
    regionId: input.regionId,
    checkin: input.checkin,
    checkout: input.checkout,
    residency: input.residency,
    guests: input.guests,
    currency: input.currency,
    language: input.language,
    hotelsLimit: 50,
    signal: input.signal,
  };

  const rates = await searchRegionRatesDetailed(params);

  // Sort all bounded SERP results before joining local static content. A newly
  // added provider hotel can be absent from the latest dump, so filtering
  // before applying the UI limit avoids returning an unnecessarily empty list.
  const cheapest = rates
    .filter((rate) => rate.priceAmount > 0)
    .sort((a, b) => a.priceAmount - b.priceAmount);

  const localContent = await loadContent(cheapest.map((rate) => rate.hotelId));
  const enriched = cheapest.map((rate) => {
      const info = localContent.get(rate.hotelId);
      if (!info) return null;

      const quote: LiveHotelQuote = {
        hid: rate.hid,
        hotelId: rate.hotelId,
        name: info.name,
        starRating: info.starRating,
        imageUrl: info.imageUrl,
        address: info.address,
        latitude: info.latitude,
        longitude: info.longitude,
        roomName: rate.roomName,
        boardBasis: mapMealToBoardBasis(rate.meal),
        priceAmount: rate.priceAmount,
        currency: rate.currency ?? input.currency,
        searchHash: rate.searchHash,
        matchHash: rate.matchHash,
      };

      return quote;
    });

  return enriched
    .filter((quote): quote is LiveHotelQuote => quote !== null)
    .slice(0, limit);
}
