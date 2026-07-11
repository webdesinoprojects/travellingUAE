/**
 * Pure client-side filter/sort logic for the hotel results page.
 *
 * Operates ONLY on the hotels already returned by the live search (no provider
 * call, no invented data). Facet counts are computed from the real loaded
 * results, so nothing is faked. Dependency-free — node --test friendly.
 */

import type { HotelSearchCardDTO } from "@/types/hotels";

export type HotelSortKey = "recommended" | "price_asc" | "price_desc" | "star_desc" | "name_asc";

export type HotelFilterState = {
  name: string;
  /** Selected star ratings (rounded ints, e.g. 3,4,5). Empty = any. */
  stars: number[];
  /** Selected board-basis labels (exact strings). Empty = any. */
  boards: string[];
  /** Inclusive price bounds; null = unbounded. */
  minPrice: number | null;
  maxPrice: number | null;
  onlyWithImage: boolean;
  sort: HotelSortKey;
};

export type HotelFacetCount = { value: string; label: string; count: number };

export type HotelFacets = {
  stars: Array<{ value: number; count: number }>;
  boards: HotelFacetCount[];
  priceMin: number | null;
  priceMax: number | null;
  currency: string | null;
  withImageCount: number;
  total: number;
};

export const DEFAULT_HOTEL_FILTER: HotelFilterState = {
  name: "",
  stars: [],
  boards: [],
  minPrice: null,
  maxPrice: null,
  onlyWithImage: false,
  sort: "recommended",
};

function roundedStar(value: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.max(1, Math.min(5, Math.round(value)));
}

/** Real facets computed from the loaded results (never invented). */
export function computeHotelFacets(hotels: HotelSearchCardDTO[]): HotelFacets {
  const starCounts = new Map<number, number>();
  const boardCounts = new Map<string, number>();
  let priceMin: number | null = null;
  let priceMax: number | null = null;
  let currency: string | null = null;
  let withImageCount = 0;

  for (const hotel of hotels) {
    const star = roundedStar(hotel.starRating);
    if (star) starCounts.set(star, (starCounts.get(star) ?? 0) + 1);

    const board = hotel.boardBasis?.trim();
    if (board) boardCounts.set(board, (boardCounts.get(board) ?? 0) + 1);

    if (Number.isFinite(hotel.priceAmount)) {
      priceMin = priceMin === null ? hotel.priceAmount : Math.min(priceMin, hotel.priceAmount);
      priceMax = priceMax === null ? hotel.priceAmount : Math.max(priceMax, hotel.priceAmount);
      if (!currency && hotel.currency) currency = hotel.currency;
    }

    if (hotel.imageUrl) withImageCount += 1;
  }

  return {
    stars: [...starCounts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.value - a.value),
    boards: [...boardCounts.entries()]
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    priceMin: priceMin === null ? null : Math.floor(priceMin),
    priceMax: priceMax === null ? null : Math.ceil(priceMax),
    currency,
    withImageCount,
    total: hotels.length,
  };
}

/** Apply the filter + sort to the loaded results. Returns a new array. */
export function filterAndSortHotels(
  hotels: HotelSearchCardDTO[],
  filter: HotelFilterState,
): HotelSearchCardDTO[] {
  const name = filter.name.trim().toLowerCase();
  const starSet = new Set(filter.stars);
  const boardSet = new Set(filter.boards);

  const filtered = hotels.filter((hotel) => {
    if (name) {
      const haystack = `${hotel.name} ${hotel.address ?? ""}`.toLowerCase();
      if (!haystack.includes(name)) return false;
    }
    if (starSet.size > 0) {
      const star = roundedStar(hotel.starRating);
      if (!star || !starSet.has(star)) return false;
    }
    if (boardSet.size > 0) {
      const board = hotel.boardBasis?.trim();
      if (!board || !boardSet.has(board)) return false;
    }
    if (filter.minPrice !== null && hotel.priceAmount < filter.minPrice) return false;
    if (filter.maxPrice !== null && hotel.priceAmount > filter.maxPrice) return false;
    if (filter.onlyWithImage && !hotel.imageUrl) return false;
    return true;
  });

  return sortHotels(filtered, filter.sort);
}

function sortHotels(hotels: HotelSearchCardDTO[], sort: HotelSortKey): HotelSearchCardDTO[] {
  const copy = [...hotels];
  switch (sort) {
    case "price_asc":
      return copy.sort((a, b) => a.priceAmount - b.priceAmount);
    case "price_desc":
      return copy.sort((a, b) => b.priceAmount - a.priceAmount);
    case "star_desc":
      return copy.sort((a, b) => (roundedStar(b.starRating) ?? 0) - (roundedStar(a.starRating) ?? 0));
    case "name_asc":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "recommended":
    default:
      return copy; // preserve provider order
  }
}

export function isDefaultHotelFilter(filter: HotelFilterState): boolean {
  return (
    filter.name.trim() === "" &&
    filter.stars.length === 0 &&
    filter.boards.length === 0 &&
    filter.minPrice === null &&
    filter.maxPrice === null &&
    !filter.onlyWithImage &&
    filter.sort === "recommended"
  );
}
