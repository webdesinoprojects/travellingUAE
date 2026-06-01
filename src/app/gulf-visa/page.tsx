import type { Metadata } from "next";
import { VisaServicesView } from "@/components/visa/VisaServicesView";
import { gulfVisaPage } from "@/data/visa";

export const metadata: Metadata = {
  title: "Gulf Visa Services | Fly Time",
  description:
    "Explore GCC visa destinations and send an enquiry to the Fly Time visa desk.",
};

export default function GulfVisaPage() {
  return <VisaServicesView page={gulfVisaPage} />;
}
