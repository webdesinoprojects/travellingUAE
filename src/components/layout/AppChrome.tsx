"use client";

import { usePathname } from "next/navigation";

import { FloatingSocial } from "@/components/layout/FloatingSocial";
import { Header } from "@/components/layout/Header";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";

type AppChromeProps = {
  children: React.ReactNode;
};

export function AppChrome({ children }: AppChromeProps) {
  const pathname = usePathname();
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  if (isAdminRoute) {
    return children;
  }

  return (
    <>
      <Header />
      {children}
      <WhatsAppButton />
      <FloatingSocial />
    </>
  );
}
