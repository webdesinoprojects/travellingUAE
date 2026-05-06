"use client";

import { Globe2, Menu } from "lucide-react";
import { navItems } from "@/data/travel";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function Header() {
  return (
    <header
      className="fixed inset-x-0 top-0 z-50 px-4 pt-3 text-foreground sm:px-6 lg:px-10"
    >
      <div className="mx-auto flex h-[68px] w-full max-w-[1240px] items-center justify-between gap-4 rounded-lg border border-border-soft/80 bg-white/86 px-3 shadow-[0_18px_50px_rgb(7_23_57/0.12)] backdrop-blur-xl dark:bg-black/88">
        <BrandLogo tone="dark" size="sm" />

        <nav
          className="hidden items-center gap-1 rounded-lg border border-border-soft bg-surface-muted/70 px-2 py-2 text-sm font-semibold lg:flex dark:bg-white/[0.06]"
          aria-label="Primary navigation"
        >
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="group inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-brand-navy transition hover:bg-white hover:text-brand-blue dark:text-white dark:hover:bg-white/[0.08]"
            >
              {item.label}
              {item.hasDropdown ? (
                <DownCaret />
              ) : null}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="#contact"
            className="hidden min-h-10 items-center rounded-lg bg-brand-blue px-5 text-sm font-bold text-white shadow-[0_10px_24px_rgb(18_63_118/0.22)] transition hover:bg-brand-navy sm:inline-flex dark:bg-brand-sand dark:text-brand-navy"
          >
            Enquire
          </a>
          <div className="hidden min-h-10 items-center gap-2 rounded-lg border border-border-soft bg-white/70 px-3 text-sm font-semibold text-brand-navy md:flex dark:bg-white/[0.06] dark:text-white">
            <Globe2 aria-hidden="true" className="size-4" />
            <span>IND</span>
            <DownCaret />
          </div>
          <div className="w-10 shrink-0">
            <ThemeToggle />
          </div>
          <details className="group relative lg:hidden">
            <summary
              className="grid size-10 list-none place-items-center rounded-lg border border-border-soft bg-white text-brand-navy dark:bg-white/[0.08] dark:text-white"
            >
              <Menu aria-hidden="true" className="size-5" />
              <span className="sr-only">Open menu</span>
            </summary>
            <div className="absolute right-0 top-12 w-72 rounded-lg border border-border-soft bg-white p-3 shadow-xl dark:bg-black">
              <nav className="grid gap-1" aria-label="Mobile navigation">
                {navItems.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold text-brand-navy transition hover:bg-surface-strong hover:text-brand-blue dark:text-white dark:hover:bg-white/[0.08]"
                  >
                    {item.label}
                    {item.hasDropdown ? (
                      <DownCaret />
                    ) : null}
                  </a>
                ))}
              </nav>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

function DownCaret() {
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 size-1.5 rotate-45 border-b-2 border-r-2 border-current"
    />
  );
}
