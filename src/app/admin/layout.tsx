import type { Metadata } from "next";

import { AdminShell } from "@/features/admin/components/AdminShell";

export const metadata: Metadata = {
  title: "Admin | Fly Time",
  description:
    "Fly Time admin preview for bookings, trips, destinations and CMS operations.",
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AdminShell>{children}</AdminShell>;
}
