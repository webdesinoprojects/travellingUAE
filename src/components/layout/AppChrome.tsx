"use client";

import { usePathname } from "next/navigation";

import { FloatingSocial } from "@/components/layout/FloatingSocial";
import { Header } from "@/components/layout/Header";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";
import type { PublicHeaderCopy, PublicLocale } from "@/types/locale";
import type { NavItem } from "@/types/travel";

type AppChromeProps = {
  children: React.ReactNode;
  currentLocale: PublicLocale;
  headerCopy: PublicHeaderCopy;
  locales: PublicLocale[];
  navItems: NavItem[];
};

export function AppChrome({
  children,
  currentLocale,
  headerCopy,
  locales,
  navItems,
}: AppChromeProps) {
  const pathname = usePathname();
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  if (isAdminRoute) {
    return children;
  }

  return (
    <>
      <Header
        currentLocale={currentLocale}
        copy={headerCopy}
        locales={locales}
        navItems={navItems}
      />
      {children}
      <WhatsAppButton />
      <FloatingSocial />
    </>
  );
}
