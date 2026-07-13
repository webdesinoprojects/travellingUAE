import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { VisaServicesView } from "@/components/visa/VisaServicesView";
import { getVisaPageContent } from "@/server/public/visa";

// DB-driven (with static fallback) content is read at request time so admin CMS
// edits are reflected immediately.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Global Visa Services | Fly Time",
  description:
    "Explore worldwide visa destinations and send an enquiry to the Fly Time visa desk.",
};

export default async function GlobalVisaPage() {
  const page = await getVisaPageContent("global-visa");
  if (!page) {
    notFound();
  }
  return <VisaServicesView page={page} />;
}
