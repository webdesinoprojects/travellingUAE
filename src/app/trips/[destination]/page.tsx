import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TripList } from "@/components/trips/TripList";
import { getTripDestination, getTripDestinations } from "@/data/trips";
import { formatTripDisplayDate } from "@/lib/date";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ destination: string }>;
}): Promise<Metadata> {
  const { destination } = await params;
  const tripDestination = await getTripDestination(destination);

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
  searchParams: Promise<{ location?: string | string[] }>;
}) {
  const { destination } = await params;
  const { location } = await searchParams;
  const tripDestination = await getTripDestination(destination);
  const destinations = await getTripDestinations();

  if (!tripDestination) {
    notFound();
  }

  const selectedLocation = Array.isArray(location) ? location[0] : location;

  return (
    <TripList
      key={`${tripDestination.slug}-${selectedLocation ?? "all"}`}
      destination={tripDestination}
      destinations={destinations}
      displayDate={formatTripDisplayDate(new Date())}
      initialLocation={selectedLocation}
    />
  );
}
