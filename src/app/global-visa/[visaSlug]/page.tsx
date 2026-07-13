import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { VisaDetailView } from "@/components/visa/VisaDetailView";
import { globalVisaPage } from "@/data/visa";
import { getVisaDestinationDetail } from "@/server/public/visa";

type GlobalVisaDetailPageProps = {
  params: Promise<{ visaSlug: string }>;
};

// Known slugs from the static fallback are prebuilt; DB-only slugs render on
// demand (dynamicParams default). Admin saves call revalidatePath to refresh.
export function generateStaticParams() {
  return globalVisaPage.destinations.map((destination) => ({
    visaSlug: destination.slug,
  }));
}

export async function generateMetadata({
  params,
}: GlobalVisaDetailPageProps): Promise<Metadata> {
  const { visaSlug } = await params;
  const result = await getVisaDestinationDetail("global-visa", visaSlug);
  if (!result) {
    return {};
  }
  return { title: result.seo.title, description: result.seo.description };
}

export default async function GlobalVisaDetailPage({
  params,
}: GlobalVisaDetailPageProps) {
  const { visaSlug } = await params;
  const result = await getVisaDestinationDetail("global-visa", visaSlug);
  if (!result) {
    notFound();
  }
  return <VisaDetailView page={result.page} destination={result.destination} />;
}
