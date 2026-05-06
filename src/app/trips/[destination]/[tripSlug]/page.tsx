import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TripDetail } from "@/components/trips/TripDetail";
import { getTripDestination, getTripPackage } from "@/data/trips";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ destination: string; tripSlug: string }>;
}): Promise<Metadata> {
  const { destination, tripSlug } = await params;
  const pkg = await getTripPackage(destination, tripSlug);

  if (!pkg) {
    return {
      title: "Trip Not Found | Fly Time",
    };
  }

  return {
    title: `${pkg.title} | Fly Time`,
    description: pkg.overview,
  };
}

export default async function TripPackagePage({
  params,
}: {
  params: Promise<{ destination: string; tripSlug: string }>;
}) {
  const { destination, tripSlug } = await params;
  const tripDestination = await getTripDestination(destination);
  const pkg = await getTripPackage(destination, tripSlug);

  if (!tripDestination || !pkg) {
    notFound();
  }

  return <TripDetail destination={tripDestination} pkg={pkg} />;
}
