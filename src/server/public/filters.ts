import "server-only";

import type { TripDestination, TripPackage } from "@/types/travel";

export type PublicTripSort = "recommended" | "cheapest" | "duration";
export type PublicTripFlightFilter = "with" | "without";

export type PublicTripFilters = {
  q: string;
  city: string;
  minDuration: number | null;
  maxDuration: number | null;
  flights: PublicTripFlightFilter | null;
  stars: string[];
  categories: string[];
  sort: PublicTripSort;
};

type SearchParamInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

export function parseTripFilters(input: SearchParamInput): PublicTripFilters {
  const sort = first(input, "sort");
  const flights = first(input, "flights");

  return {
    q: first(input, "q")?.trim() ?? "",
    city: first(input, "city") ?? first(input, "location") ?? "all",
    minDuration: parseNumber(first(input, "minDuration")),
    maxDuration: parseNumber(first(input, "maxDuration")),
    flights: flights === "with" || flights === "without" ? flights : null,
    stars: all(input, "stars"),
    categories: all(input, "categories"),
    sort:
      sort === "cheapest" || sort === "duration" || sort === "recommended"
        ? sort
        : "recommended",
  };
}

export function filterTripDestination(
  destination: TripDestination,
  filters: PublicTripFilters,
): TripDestination {
  const packages = filterTripPackages(destination.packages, filters);

  return {
    ...destination,
    packages,
    resultCount: `Showing 1 - ${packages.length} of ${packages.length} Packages`,
  };
}

export function filterTripPackages(
  packages: TripPackage[],
  filters: PublicTripFilters,
) {
  const query = filters.q.toLowerCase();

  return packages
    .filter((pkg) => {
      const matchesKeyword =
        !query ||
        [pkg.title, pkg.city, pkg.overview, ...pkg.tags, ...pkg.categories]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesCity = filters.city === "all" || pkg.city === filters.city;
      const matchesFlights =
        !filters.flights ||
        (filters.flights === "with" ? pkg.hasFlights : !pkg.hasFlights);
      const matchesDuration =
        (filters.minDuration === null ||
          pkg.durationDays >= filters.minDuration) &&
        (filters.maxDuration === null ||
          pkg.durationDays <= filters.maxDuration);
      const matchesCategories =
        filters.categories.length === 0 ||
        filters.categories.every((category) =>
          pkg.categories.includes(category),
        );
      const matchesStars =
        filters.stars.length === 0 ||
        filters.stars.some((star) =>
          star === "<3" ? pkg.hotelStar < 3 : pkg.hotelStar === Number(star),
        );

      return (
        matchesKeyword &&
        matchesCity &&
        matchesFlights &&
        matchesDuration &&
        matchesCategories &&
        matchesStars
      );
    })
    .toSorted((left, right) => {
      if (filters.sort === "cheapest") {
        return left.priceAmount - right.priceAmount;
      }

      if (filters.sort === "duration") {
        return left.durationDays - right.durationDays;
      }

      return (
        Number(right.badge === "Recommended") -
        Number(left.badge === "Recommended")
      );
    });
}

function first(input: SearchParamInput, key: string) {
  if (input instanceof URLSearchParams) {
    return input.get(key) ?? undefined;
  }

  const value = input[key];

  return Array.isArray(value) ? value[0] : value;
}

function all(input: SearchParamInput, key: string) {
  const values =
    input instanceof URLSearchParams
      ? input.getAll(key)
      : Array.isArray(input[key])
        ? input[key]
        : [input[key]];

  return values
    .filter((value): value is string => Boolean(value))
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumber(value: string | undefined) {
  if (!value) {
    return null;
  }

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}
