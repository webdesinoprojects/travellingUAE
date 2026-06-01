"use client";

import { Globe2, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { PublicHeaderCopy, PublicLocale } from "@/types/locale";
import type { NavItem } from "@/types/travel";

type HeaderProps = {
  copy: PublicHeaderCopy;
  currentLocale: PublicLocale;
  locales: PublicLocale[];
  navItems: NavItem[];
};

export function Header({ copy, currentLocale, locales, navItems }: HeaderProps) {
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);
  const [openDesktopMenu, setOpenDesktopMenu] = useState<string | null>(null);
  const [openMobileMenu, setOpenMobileMenu] = useState<string | null>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        navRef.current?.contains(event.target)
      ) {
        return;
      }

      setOpenDesktopMenu(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenDesktopMenu(null);
        setOpenMobileMenu(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 px-4 pt-3 text-foreground sm:px-6 lg:px-10"
    >
      <div
        ref={navRef}
        className="mx-auto flex h-[68px] w-full max-w-[1500px] items-center justify-between gap-4 rounded-lg border border-border-soft/80 bg-white/86 px-3 shadow-[0_18px_50px_rgb(7_23_57/0.12)] backdrop-blur-xl dark:bg-black/88"
      >
        <BrandLogo tone="dark" size="sm" />

        <nav
          className="hidden min-w-0 items-center gap-1 rounded-lg border border-border-soft bg-surface-muted/70 px-2 py-2 text-sm font-semibold lg:flex dark:bg-white/[0.06]"
          aria-label="Primary navigation"
        >
          {navItems.map((item) => {
            const menuId = getMenuId(item);

            return (
              <NavEntry
                key={menuId}
                item={item}
                isOpen={openDesktopMenu === menuId}
                menuId={menuId}
                onClose={() => setOpenDesktopMenu(null)}
                onToggle={() =>
                  setOpenDesktopMenu((current) =>
                    current === menuId ? null : menuId,
                  )
                }
              />
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/#contact"
            className="hidden min-h-10 items-center rounded-lg bg-brand-blue px-5 text-sm font-bold text-white shadow-[0_10px_24px_rgb(18_63_118/0.22)] transition hover:bg-brand-navy sm:inline-flex dark:bg-brand-sand dark:text-white dark:hover:bg-brand-sand/90"
          >
            {copy.enquire}
          </Link>
          <LanguageSelector
            currentLocale={currentLocale}
            locales={locales}
            pathname={pathname}
          />
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
                {navItems.map((item) => {
                  const menuId = getMenuId(item);

                  return (
                    <MobileNavEntry
                      key={menuId}
                      item={item}
                      isOpen={openMobileMenu === menuId}
                      onClose={() => setOpenMobileMenu(null)}
                      onToggle={() =>
                        setOpenMobileMenu((current) =>
                          current === menuId ? null : menuId,
                        )
                      }
                    />
                  );
                })}
              </nav>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

function NavEntry({
  isOpen,
  item,
  menuId,
  onClose,
  onToggle,
}: {
  isOpen: boolean;
  item: NavItem;
  menuId: string;
  onClose: () => void;
  onToggle: () => void;
}) {
  if (item.children?.length) {
    return (
      <div className="relative">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={`${menuId}-menu`}
          onClick={onToggle}
          className="inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-brand-navy transition hover:bg-white hover:text-brand-blue dark:text-white dark:hover:bg-white/[0.08]"
        >
          {item.label}
          <DownCaret />
        </button>
        {isOpen ? (
          <div
            id={`${menuId}-menu`}
            className="absolute right-0 top-11 z-20 grid min-w-56 gap-1 rounded-lg border border-border-soft bg-white p-2 shadow-xl dark:bg-black"
          >
            {item.children.map((child) => (
              <Link
                key={`${child.href}:${child.label}`}
                href={child.href}
                onClick={onClose}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-navy transition hover:bg-surface-strong hover:text-brand-blue dark:text-white dark:hover:bg-white/[0.08]"
              >
                {child.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className="group inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-brand-navy transition hover:bg-white hover:text-brand-blue dark:text-white dark:hover:bg-white/[0.08]"
    >
      {item.label}
    </Link>
  );
}

function MobileNavEntry({
  isOpen,
  item,
  onClose,
  onToggle,
}: {
  isOpen: boolean;
  item: NavItem;
  onClose: () => void;
  onToggle: () => void;
}) {
  if (item.children?.length) {
    return (
      <div>
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={onToggle}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-brand-navy transition hover:bg-surface-strong hover:text-brand-blue dark:text-white dark:hover:bg-white/[0.08]"
        >
          {item.label}
          <DownCaret />
        </button>
        {isOpen ? (
          <div className="mt-1 grid gap-1 border-l border-border-soft pl-2">
            {item.children.map((child) => (
              <Link
                key={`${child.href}:${child.label}`}
                href={child.href}
                onClick={onClose}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-navy/80 transition hover:bg-surface-strong hover:text-brand-blue dark:text-white/80 dark:hover:bg-white/[0.08]"
              >
                {child.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold text-brand-navy transition hover:bg-surface-strong hover:text-brand-blue dark:text-white dark:hover:bg-white/[0.08]"
    >
      {item.label}
    </Link>
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

function LanguageSelector({
  currentLocale,
  locales,
  pathname,
}: {
  currentLocale: PublicLocale;
  locales: PublicLocale[];
  pathname: string;
}) {
  return (
    <details className="group relative hidden md:block">
      <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg border border-border-soft bg-white/70 px-3 text-sm font-semibold text-brand-navy dark:bg-white/[0.06] dark:text-white">
        <Globe2 aria-hidden="true" className="size-4" />
        <span>{currentLocale.code.toUpperCase()}</span>
        <DownCaret />
      </summary>
      <div className="absolute right-0 top-12 z-20 grid min-w-36 gap-1 rounded-lg border border-border-soft bg-white p-2 shadow-xl dark:bg-black">
        {locales.map((locale) => (
          <Link
            key={locale.code}
            href={buildLocaleHref(pathname, locale.code)}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-navy transition hover:bg-surface-strong hover:text-brand-blue dark:text-white dark:hover:bg-white/[0.08]"
          >
            {locale.code.toUpperCase()}
            <span className="ml-2 text-xs font-medium text-foreground-muted">
              {locale.name}
            </span>
          </Link>
        ))}
      </div>
    </details>
  );
}

function buildLocaleHref(pathname: string, locale: string) {
  const params = new URLSearchParams();
  params.set("locale", locale);
  params.set("returnTo", pathname);
  return `/api/public/locale?${params.toString()}`;
}

function getMenuId(item: NavItem) {
  return `${item.href}:${item.label}`;
}
