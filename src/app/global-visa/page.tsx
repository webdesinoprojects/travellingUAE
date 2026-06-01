import type { Metadata } from "next";
import { VisaServicesView } from "@/components/visa/VisaServicesView";
import { globalVisaPage } from "@/data/visa";

export const metadata: Metadata = {
  title: "Global Visa Services | Fly Time",
  description:
    "Explore worldwide visa destinations and send an enquiry to the Fly Time visa desk.",
};

export default function GlobalVisaPage() {
  return <VisaServicesView page={globalVisaPage} />;
}
