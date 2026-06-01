import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VisaDetailView } from "@/components/visa/VisaDetailView";
import { getVisaDestination, globalVisaPage } from "@/data/visa";

type GlobalVisaDetailPageProps = {
  params: Promise<{ visaSlug: string }>;
};

export function generateStaticParams() {
  return globalVisaPage.destinations.map((destination) => ({
    visaSlug: destination.slug,
  }));
}

export async function generateMetadata({
  params,
}: GlobalVisaDetailPageProps): Promise<Metadata> {
  const { visaSlug } = await params;
  const result = getVisaDestination(globalVisaPage.slug, visaSlug);

  if (!result) {
    return {};
  }

  return {
    title: `${result.destination.name} Visa | Fly Time`,
    description: result.destination.overview[0],
  };
}

export default async function GlobalVisaDetailPage({
  params,
}: GlobalVisaDetailPageProps) {
  const { visaSlug } = await params;
  const result = getVisaDestination(globalVisaPage.slug, visaSlug);

  if (!result) {
    notFound();
  }

  return (
    <VisaDetailView page={result.page} destination={result.destination} />
  );
}
