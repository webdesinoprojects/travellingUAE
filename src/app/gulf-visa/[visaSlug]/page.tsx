import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VisaDetailView } from "@/components/visa/VisaDetailView";
import { getVisaDestination, gulfVisaPage } from "@/data/visa";

type GulfVisaDetailPageProps = {
  params: Promise<{ visaSlug: string }>;
};

export function generateStaticParams() {
  return gulfVisaPage.destinations.map((destination) => ({
    visaSlug: destination.slug,
  }));
}

export async function generateMetadata({
  params,
}: GulfVisaDetailPageProps): Promise<Metadata> {
  const { visaSlug } = await params;
  const result = getVisaDestination(gulfVisaPage.slug, visaSlug);

  if (!result) {
    return {};
  }

  return {
    title: `${result.destination.name} Visa | Fly Time`,
    description: result.destination.overview[0],
  };
}

export default async function GulfVisaDetailPage({
  params,
}: GulfVisaDetailPageProps) {
  const { visaSlug } = await params;
  const result = getVisaDestination(gulfVisaPage.slug, visaSlug);

  if (!result) {
    notFound();
  }

  return (
    <VisaDetailView page={result.page} destination={result.destination} />
  );
}
