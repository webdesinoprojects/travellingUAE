"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Orders", href: "/admin/esim/orders" },
  { label: "Countries", href: "/admin/esim/countries" },
  { label: "Plans", href: "/admin/esim/plans" },
];

export function EsimAdminTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2" aria-label="eSIM admin sections">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={[
              "inline-flex min-h-10 items-center rounded-lg border px-4 text-sm font-black transition",
              active
                ? "border-brand-navy bg-brand-navy text-white dark:border-brand-sand dark:bg-brand-sand dark:text-brand-navy"
                : "border-border-soft bg-white text-brand-brown hover:text-brand-navy dark:bg-white/10 dark:text-white",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
