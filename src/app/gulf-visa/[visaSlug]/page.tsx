import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { VisaDetailView } from "@/components/visa/VisaDetailView";
import { gulfVisaPage } from "@/data/visa";
import { getVisaDestinationDetail } from "@/server/public/visa";

type GulfVisaDetailPageProps = {
  params: Promise<{ visaSlug: string }>;
};

// Known slugs from the static fallback are prebuilt; DB-only slugs render on
// demand (dynamicParams default). Admin saves call revalidatePath to refresh.
export function generateStaticParams() {
  return gulfVisaPage.destinations.map((destination) => ({
    visaSlug: destination.slug,
  }));
}

export async function generateMetadata({
  params,
}: GulfVisaDetailPageProps): Promise<Metadata> {
  const { visaSlug } = await params;
  const result = await getVisaDestinationDetail("gulf-visa", visaSlug);
  if (!result) {
    return {};
  }
  return { title: result.seo.title, description: result.seo.description };
}

export default async function GulfVisaDetailPage({
  params,
}: GulfVisaDetailPageProps) {
  const { visaSlug } = await params;
  const result = await getVisaDestinationDetail("gulf-visa", visaSlug);
  if (!result) {
    notFound();
  }
  return <VisaDetailView page={result.page} destination={result.destination} />;
}
