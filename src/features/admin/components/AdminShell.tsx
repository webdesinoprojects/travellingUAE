"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LogOut, Menu, PanelLeftClose, Search, X } from "lucide-react";
import type { CSSProperties } from "react";
import { useState } from "react";

import { adminNavItems } from "@/features/admin/mock/admin-data";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

type AdminShellProps = {
  children: React.ReactNode;
};

export function AdminShell({ children }: AdminShellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const sidebarWidth = isCollapsed ? 88 : 292;

  return (
    <div className="min-h-screen bg-[#f7efe4] text-brand-navy dark:bg-black dark:text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_0%,rgb(194_232_255/0.7),transparent_24rem),radial-gradient(circle_at_100%_14%,rgb(227_195_157/0.55),transparent_26rem)] dark:bg-[radial-gradient(circle_at_12%_0%,rgb(18_63_118/0.35),transparent_22rem)]" />
      <div className="min-h-screen">
        <aside
          className="fixed inset-y-0 left-0 z-50 hidden overflow-hidden border-r border-[#d7c5ad] bg-[#fffaf2]/90 px-4 py-5 shadow-[18px_0_60px_rgb(7_23_57/0.07)] backdrop-blur-xl transition-[width] duration-300 xl:block dark:border-white/10 dark:bg-[#050505]/94"
          style={{ width: sidebarWidth }}
        >
          <AdminSidebar
            isCollapsed={isCollapsed}
            onToggleCollapse={() => setIsCollapsed((value) => !value)}
          />
        </aside>

        <div
          className="min-w-0 transition-[padding] duration-300 xl:pl-[var(--admin-sidebar-width)]"
          style={
            {
              "--admin-sidebar-width": `${sidebarWidth}px`,
            } as CSSProperties
          }
        >
          <AdminTopbar onMenu={() => setIsOpen(true)} />
          <main className="mx-auto w-full max-w-[1580px] px-4 pb-8 pt-4 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-[80] bg-brand-navy/40 backdrop-blur-sm xl:hidden">
          <div className="h-full w-[min(88vw,330px)] border-r border-[#d7c5ad] bg-[#fffaf2] p-5 shadow-2xl dark:border-white/10 dark:bg-black">
            <AdminSidebar
              onClose={() => setIsOpen(false)}
              onNavigate={() => setIsOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AdminTopbar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[#d7c5ad]/80 bg-[#fffaf2]/80 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-black/78 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1580px] items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenu}
            className="grid size-11 place-items-center rounded-lg border border-border-soft bg-white text-brand-navy xl:hidden dark:bg-white/10 dark:text-white"
            aria-label="Open admin navigation"
          >
            <Menu aria-hidden="true" className="size-5" />
          </button>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-brown">
              Admin workspace
            </p>
            <h1 className="font-serif text-xl font-black tracking-tight sm:text-2xl">
              Fly Time Operations
            </h1>
          </div>
        </div>

        <div className="hidden min-w-[280px] items-center gap-3 rounded-lg border border-border-soft bg-white px-4 py-3 text-sm text-brand-brown shadow-sm lg:flex dark:bg-white/10">
          <Search aria-hidden="true" className="size-4 shrink-0" />
          <span>Search bookings, trips, pages</span>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            type="button"
            className="relative grid size-11 place-items-center rounded-lg border border-border-soft bg-white text-brand-navy dark:bg-white/10 dark:text-white"
            aria-label="View admin alerts"
          >
            <Bell aria-hidden="true" className="size-5" />
            <span className="absolute right-2 top-2 size-2 rounded-full bg-brand-sand" />
          </button>
          <div className="hidden items-center gap-3 rounded-lg border border-border-soft bg-white px-3 py-2 dark:bg-white/10 md:flex">
            <div className="grid size-10 place-items-center rounded-lg bg-brand-navy text-sm font-black text-white dark:bg-brand-sand dark:text-brand-navy">
              FT
            </div>
            <div>
              <p className="text-sm font-black">Admin User</p>
              <p className="text-xs font-semibold text-brand-brown">
                Owner access
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function AdminSidebar({
  isCollapsed = false,
  onClose,
  onNavigate,
  onToggleCollapse,
}: {
  isCollapsed?: boolean;
  onClose?: () => void;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-7 flex items-center justify-between gap-3">
        {isCollapsed ? (
          <Link
            href="/admin"
            className="grid size-12 place-items-center rounded-lg bg-brand-navy text-lg font-black text-brand-sand shadow-sm dark:bg-brand-sand dark:text-brand-navy"
            aria-label="Fly Time admin dashboard"
          >
            FT
          </Link>
        ) : (
          <BrandLogo size="sm" />
        )}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-lg border border-border-soft bg-white text-brand-navy dark:bg-white/10 dark:text-white"
            aria-label="Close admin navigation"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            {!isCollapsed ? (
              <span className="rounded-lg border border-border-soft bg-[#e8f7ff] px-2.5 py-1 text-xs font-black text-brand-blue dark:bg-white/10 dark:text-brand-sand">
              Mock
              </span>
            ) : null}
            <button
              type="button"
              onClick={onToggleCollapse}
              className="grid size-8 place-items-center rounded-lg border border-border-soft bg-white text-brand-brown dark:bg-white/10 dark:text-white"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <PanelLeftClose
                aria-hidden="true"
                className={[
                  "size-4 transition-transform",
                  isCollapsed ? "rotate-180" : "",
                ].join(" ")}
              />
            </button>
          </div>
        )}
      </div>

      <nav className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1" aria-label="Admin navigation">
        <div className="grid gap-1.5">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={[
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-extrabold transition",
                  isCollapsed ? "justify-center px-0" : "",
                  isActive
                    ? "bg-brand-navy text-white shadow-[0_14px_30px_rgb(7_23_57/0.22)] dark:bg-brand-sand dark:text-brand-navy"
                    : "text-brand-brown hover:bg-white hover:text-brand-navy dark:hover:bg-white/10 dark:hover:text-white",
                ].join(" ")}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className={isCollapsed ? "sr-only" : "min-w-0 flex-1 truncate"}>
                  {item.label}
                </span>
                {item.badge && !isCollapsed ? (
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-[11px]",
                      isActive
                        ? "bg-white/15 text-white dark:bg-brand-navy/15 dark:text-brand-navy"
                        : "bg-[#e8f7ff] text-brand-blue dark:bg-white/10 dark:text-brand-sand",
                    ].join(" ")}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="mt-6 border-t border-border-soft pt-4 dark:border-white/10">
        <button
          type="button"
          className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-extrabold text-brand-brown transition hover:bg-white hover:text-brand-navy dark:hover:bg-white/10 dark:hover:text-white"
          title={isCollapsed ? "Sign out" : undefined}
        >
          <LogOut aria-hidden="true" className="size-4" />
          <span className={isCollapsed ? "sr-only" : ""}>Sign out</span>
        </button>
      </div>
    </div>
  );
}
