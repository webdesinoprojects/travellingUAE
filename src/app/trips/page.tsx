import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { TripList } from "@/components/trips/TripList";
import { formatTripDisplayDate } from "@/lib/date";
import { getPublicTripDestinations } from "@/server/public/dal";

export const metadata: Metadata = {
  title: "Trips | Fly Time",
  description:
    "Browse available Fly Time holiday destinations and open their package lists.",
};

export default async function TripsPage() {
  await connection();
  const destinations = await getPublicTripDestinations();
  const destination = destinations[0];

  if (!destination) {
    notFound();
  }

  return (
    <TripList
      key={destination.slug}
      destination={destination}
      destinations={destinations}
      displayDate={formatTripDisplayDate(new Date())}
    />
  );
}
