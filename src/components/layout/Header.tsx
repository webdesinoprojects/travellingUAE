"use client";

import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { navItems } from "@/data/travel";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function handleScroll() {
      const nextScrolled = window.scrollY > 24;
      setScrolled((current) =>
        current === nextScrolled ? current : nextScrolled,
      );
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={[
        "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,box-shadow,color] duration-200",
        scrolled
          ? "border-b border-border-soft bg-white text-slate-950 shadow-[0_1px_8px_rgb(15_23_42/0.08)] dark:bg-black dark:text-white"
          : "border-b border-transparent bg-transparent text-white",
      ].join(" ")}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1720px] items-center justify-between gap-5 px-4 sm:px-6 lg:px-12">
        <BrandLogo tone={scrolled ? "dark" : "light"} size="sm" />

        <nav
          className="hidden items-center gap-5 text-sm font-semibold lg:flex"
          aria-label="Primary navigation"
        >
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={[
                "group inline-flex items-center gap-1.5 whitespace-nowrap transition",
                scrolled
                  ? "hover:text-brand-blue"
                  : "drop-shadow-sm hover:text-white/80",
              ].join(" ")}
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
            className={[
              "hidden rounded-lg px-4 py-2 text-sm font-bold transition sm:inline-flex",
              scrolled
                ? "bg-brand-blue text-white hover:bg-brand-blue-strong"
                : "border border-white/40 bg-white/10 text-white backdrop-blur hover:bg-white/20",
            ].join(" ")}
          >
            Enquire
          </a>
          <div className="hidden items-center gap-2 text-sm font-semibold md:flex">
            <span aria-hidden="true" className="text-xl leading-none">
              IN
            </span>
            <span>IND</span>
            <DownCaret />
          </div>
          <div
            className={[
              "w-10 shrink-0 transition-opacity duration-200",
              scrolled ? "opacity-100" : "pointer-events-none opacity-0",
            ].join(" ")}
          >
            <ThemeToggle />
          </div>
          <details className="group relative lg:hidden">
            <summary
              className={[
                "grid size-10 list-none place-items-center rounded-lg border",
                scrolled
                  ? "border-border-soft bg-white text-slate-900 dark:bg-neutral-950 dark:text-white"
                  : "border-white/40 bg-white/10 text-white backdrop-blur",
              ].join(" ")}
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
                    className="flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-sky-50 hover:text-brand-blue dark:text-white dark:hover:bg-neutral-900"
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
