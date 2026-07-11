/**
 * Pure client-side filter/sort for the hotel detail "Available rooms" section.
 *
 * Operates only on already-loaded rate DTOs. Facets are exposed only when the
 * DTO contains real provider values for them; no provider field is invented.
 */

import type { HotelRateDTO } from "@/types/hotels";

export type RateSortKey = "recommended" | "price_asc" | "price_desc";

export type RateFilterState = {
  query: string;
  /** Selected board-basis labels. Empty = any. */
  meals: string[];
  beds: string[];
  paymentTypes: string[];
  smoking: string[];
  freeCancellationOnly: boolean;
  sort: RateSortKey;
};

export type RateFacets = {
  meals: Array<{ value: string; count: number }>;
  beds: Array<{ value: string; count: number }>;
  paymentTypes: Array<{ value: string; count: number }>;
  smoking: Array<{ value: string; count: number }>;
  hasCancellation: boolean;
  total: number;
};

export const DEFAULT_RATE_FILTER: RateFilterState = {
  query: "",
  meals: [],
  beds: [],
  paymentTypes: [],
  smoking: [],
  freeCancellationOnly: false,
  sort: "recommended",
};

export function computeRateFacets(rates: HotelRateDTO[]): RateFacets {
  const mealCounts = new Map<string, number>();
  const bedCounts = new Map<string, number>();
  const paymentCounts = new Map<string, number>();
  const smokingCounts = new Map<string, number>();
  let hasCancellation = false;

  for (const rate of rates) {
    const board = rate.boardBasis?.trim();
    if (board) mealCounts.set(board, (mealCounts.get(board) ?? 0) + 1);

    const bed = rate.bedType?.trim() || rate.beds[0]?.trim();
    if (bed) bedCounts.set(bed, (bedCounts.get(bed) ?? 0) + 1);

    const payment = rate.paymentType?.trim();
    if (payment) paymentCounts.set(payment, (paymentCounts.get(payment) ?? 0) + 1);

    const smoking = rate.smokingLabel?.trim();
    if (smoking) smokingCounts.set(smoking, (smokingCounts.get(smoking) ?? 0) + 1);

    if (rate.cancellationFreeBefore || rate.cancellationPolicyCount > 0) {
      hasCancellation = true;
    }
  }

  return {
    meals: sortFacetCounts(mealCounts),
    beds: sortFacetCounts(bedCounts),
    paymentTypes: sortFacetCounts(paymentCounts),
    smoking: sortFacetCounts(smokingCounts),
    hasCancellation,
    total: rates.length,
  };
}

export function filterAndSortRates(rates: HotelRateDTO[], filter: RateFilterState): HotelRateDTO[] {
  const query = filter.query.trim().toLowerCase();
  const mealSet = new Set(filter.meals);
  const bedSet = new Set(filter.beds);
  const paymentSet = new Set(filter.paymentTypes);
  const smokingSet = new Set(filter.smoking);

  const filtered = rates.filter((rate) => {
    if (query) {
      const haystack = [
        rate.roomName,
        rate.roomGroupName,
        rate.boardBasis,
        rate.bedType,
        ...rate.beds,
        ...rate.amenities,
        rate.smokingLabel,
        rate.paymentType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    if (mealSet.size > 0) {
      const board = rate.boardBasis?.trim();
      if (!board || !mealSet.has(board)) return false;
    }

    if (bedSet.size > 0) {
      const bed = rate.bedType?.trim() || rate.beds[0]?.trim();
      if (!bed || !bedSet.has(bed)) return false;
    }

    if (paymentSet.size > 0) {
      const payment = rate.paymentType?.trim();
      if (!payment || !paymentSet.has(payment)) return false;
    }

    if (smokingSet.size > 0) {
      const smoking = rate.smokingLabel?.trim();
      if (!smoking || !smokingSet.has(smoking)) return false;
    }

    if (filter.freeCancellationOnly && !rate.cancellationFreeBefore) return false;

    return true;
  });

  const copy = [...filtered];
  switch (filter.sort) {
    case "price_asc":
      return copy.sort((a, b) => a.priceAmount - b.priceAmount);
    case "price_desc":
      return copy.sort((a, b) => b.priceAmount - a.priceAmount);
    case "recommended":
    default:
      return copy;
  }
}

export function isDefaultRateFilter(filter: RateFilterState): boolean {
  return (
    filter.query.trim() === "" &&
    filter.meals.length === 0 &&
    filter.beds.length === 0 &&
    filter.paymentTypes.length === 0 &&
    filter.smoking.length === 0 &&
    !filter.freeCancellationOnly &&
    filter.sort === "recommended"
  );
}

function sortFacetCounts(counts: Map<string, number>): Array<{ value: string; count: number }> {
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}
