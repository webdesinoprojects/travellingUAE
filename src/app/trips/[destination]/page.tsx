import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  TripList,
  type TripListInitialFilters,
} from "@/components/trips/TripList";
import { formatTripDisplayDate } from "@/lib/date";
import {
  getPublicTripDestination,
  getPublicTripDestinations,
} from "@/server/public/dal";
import {
  filterTripDestination,
  parseTripFilters,
  type PublicTripFilters,
} from "@/server/public/filters";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ destination: string }>;
}): Promise<Metadata> {
  const { destination } = await params;
  const tripDestination = await getPublicTripDestination(destination);

  if (!tripDestination) {
    return {
      title: "Trips Not Found | Fly Time",
    };
  }

  return {
    title: `${tripDestination.resultTitle} | Fly Time`,
    description: `Explore curated ${tripDestination.name} holiday packages with public demo pricing, dates, inclusions, and package details.`,
  };
}

export default async function DestinationTripsPage({
  params,
  searchParams,
}: {
  params: Promise<{ destination: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { destination } = await params;
  const paramsValue = await searchParams;
  const tripDestination = await getPublicTripDestination(destination);
  const destinations = await getPublicTripDestinations();

  if (!tripDestination) {
    notFound();
  }

  const filters = parseTripFilters(paramsValue);
  const initialFilters = toTripListInitialFilters(filters);
  const filteredTripDestination = filterTripDestination(
    tripDestination,
    filters,
  );

  return (
    <TripList
      key={`${tripDestination.slug}-${stableFilterKey(initialFilters)}`}
      destination={filteredTripDestination}
      filterSource={tripDestination}
      destinations={destinations}
      displayDate={formatTripDisplayDate(new Date())}
      initialFilters={initialFilters}
    />
  );
}

function toTripListInitialFilters(
  filters: PublicTripFilters,
): TripListInitialFilters {
  return {
    q: filters.q || undefined,
    city: filters.city === "all" ? undefined : filters.city,
    minDuration: filters.minDuration ?? undefined,
    maxDuration: filters.maxDuration ?? undefined,
    flights: filters.flights,
    stars: filters.stars,
    categories: filters.categories,
    sort: filters.sort,
  };
}

function stableFilterKey(filters: TripListInitialFilters) {
  return JSON.stringify({
    q: filters.q ?? "",
    city: filters.city ?? "all",
    minDuration: filters.minDuration ?? "",
    maxDuration: filters.maxDuration ?? "",
    flights: filters.flights ?? "",
    stars: filters.stars ?? [],
    categories: filters.categories ?? [],
    sort: filters.sort ?? "recommended",
  });
}
