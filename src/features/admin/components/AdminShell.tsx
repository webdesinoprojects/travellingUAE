"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BookOpenText,
  ChevronDown,
  FileText,
  GalleryHorizontalEnd,
  Home,
  Inbox,
  Languages,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Navigation,
  PanelLeftClose,
  Plane,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Tags,
  UserRoundCog,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CSSProperties, FormEvent } from "react";
import { useState } from "react";

import { BrandLogo } from "@/components/ui/BrandLogo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

type NavChildItem = {
  label: string;
  href: string;
};

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  children?: NavChildItem[];
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Bookings", href: "/admin/bookings", icon: Inbox },
  {
    label: "Hajj & Umrah",
    href: "/admin/hajj-umrah",
    icon: Inbox,
    children: [
      { label: "Page CMS", href: "/admin/hajj-umrah" },
      { label: "Enquiries", href: "/admin/hajj-umrah-enquiries" },
    ],
  },
  { label: "eSIM", href: "/admin/esim/orders", icon: Smartphone },
  { label: "Destinations", href: "/admin/destinations", icon: MapPin },
  { label: "Trips", href: "/admin/trips", icon: Plane },
  { label: "Categories", href: "/admin/categories", icon: Tags },
  { label: "Media", href: "/admin/media", icon: GalleryHorizontalEnd },
  { label: "Home CMS", href: "/admin/home", icon: Home },
  { label: "Pages", href: "/admin/pages", icon: FileText },
  { label: "Navigation", href: "/admin/navigation", icon: Navigation },
  { label: "Translations", href: "/admin/translations", icon: Languages },
  { label: "Newsletter", href: "/admin/newsletter", icon: BookOpenText },
  { label: "Users", href: "/admin/users", icon: UserRoundCog },
  { label: "Settings", href: "/admin/settings", icon: Settings },
  { label: "Audit Log", href: "/admin/audit-log", icon: ShieldCheck },
];

type AdminShellProps = {
  children: React.ReactNode;
};

export function AdminShell({ children }: AdminShellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const sidebarWidth = isCollapsed ? 88 : 292;

  if (pathname === "/admin/login") {
    return (
      <div className="min-h-screen bg-[#f7efe4] text-brand-navy dark:bg-black dark:text-white">
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_0%,rgb(194_232_255/0.7),transparent_24rem),radial-gradient(circle_at_100%_14%,rgb(227_195_157/0.55),transparent_26rem)] dark:bg-[radial-gradient(circle_at_12%_0%,rgb(18_63_118/0.35),transparent_22rem)]" />
        <main className="mx-auto grid min-h-screen w-full max-w-6xl place-items-center px-4 py-10">
          {children}
        </main>
      </div>
    );
  }

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
          className="min-w-0 overflow-x-hidden transition-[padding] duration-300 xl:pl-[var(--admin-sidebar-width)]"
          style={
            {
              "--admin-sidebar-width": `${sidebarWidth}px`,
            } as CSSProperties
          }
        >
          <AdminTopbar onMenu={() => setIsOpen(true)} />
          <main className="mx-auto w-full max-w-[1580px] min-w-0 px-4 pb-8 pt-4 sm:px-6 lg:px-8">
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
  const pathname = usePathname();
  const router = useRouter();

  function handleSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = (
      e.currentTarget.elements.namedItem("q") as HTMLInputElement
    ).value.trim();

    if (!q) {
      return;
    }

    const resourceMatch = pathname.match(/^\/admin\/([^/]+)$/);
    const target = resourceMatch ? resourceMatch[1] : "bookings";

    router.push(`/admin/${target}?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[#d7c5ad]/80 bg-[#fffaf2]/80 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-black/78 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1580px] min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenu}
            className="grid size-11 place-items-center rounded-lg border border-border-soft bg-white text-brand-navy xl:hidden dark:bg-white/10 dark:text-white"
            aria-label="Open admin navigation"
          >
            <Menu aria-hidden="true" className="size-5" />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-brown">
              Admin workspace
            </p>
            <h1 className="truncate font-serif text-xl font-black tracking-tight sm:text-2xl">
              Fly Time Operations
            </h1>
          </div>
        </div>

        <form
          role="search"
          onSubmit={handleSearch}
          className="hidden min-w-0 max-w-md flex-1 items-center gap-3 rounded-lg border border-border-soft bg-white px-4 py-3 shadow-sm xl:flex dark:bg-white/10"
        >
          <Search aria-hidden="true" className="size-4 shrink-0 text-brand-brown" />
          <input
            type="search"
            name="q"
            placeholder="Search bookings, trips, pages"
            aria-label="Search admin records"
            autoComplete="off"
            className="flex-1 bg-transparent text-sm text-brand-navy outline-none placeholder:text-brand-brown dark:text-white"
          />
          <button type="submit" className="sr-only">
            Search
          </button>
        </form>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <button
            type="button"
            className="relative grid size-11 place-items-center rounded-lg border border-border-soft bg-white text-brand-navy dark:bg-white/10 dark:text-white"
            aria-label="View admin alerts"
          >
            <Bell aria-hidden="true" className="size-5" />
            <span className="absolute right-2 top-2 size-2 rounded-full bg-brand-sand" />
          </button>
          <div className="hidden items-center gap-3 rounded-lg border border-border-soft bg-white px-3 py-2 dark:bg-white/10 2xl:flex">
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
  const router = useRouter();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    "Hajj & Umrah": pathname.startsWith("/admin/hajj-umrah"),
  });

  async function handleSignOut() {
    await fetch("/api/admin/session", { method: "DELETE" }).catch(() => null);
    router.replace("/admin/login");
    router.refresh();
  }

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
                Ops
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
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const children = item.children ?? [];
            const hasChildren = children.length > 0;
            const childActive = hasChildren
              ? children.some(
                  (child) =>
                    pathname === child.href ||
                    pathname.startsWith(`${child.href}/`),
                )
              : false;
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(`${item.href}/`)) ||
              childActive;
            const sectionOpenState = openSections[item.label];
            const isSectionOpen = isCollapsed
              ? false
              : sectionOpenState ?? childActive;

            if (hasChildren) {
              return (
                <div key={item.href} className="grid gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenSections((current) => ({
                        ...current,
                        [item.label]: !isSectionOpen,
                      }))
                    }
                    className={[
                      "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-extrabold transition",
                      isCollapsed ? "justify-center px-0" : "",
                      isActive
                        ? "bg-brand-navy text-white shadow-[0_14px_30px_rgb(7_23_57/0.22)] dark:bg-brand-sand dark:text-brand-navy"
                        : "text-brand-brown hover:bg-white hover:text-brand-navy dark:hover:bg-white/10 dark:hover:text-white",
                    ].join(" ")}
                    title={isCollapsed ? item.label : undefined}
                    aria-expanded={isSectionOpen}
                  >
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    <span
                      className={
                        isCollapsed ? "sr-only" : "min-w-0 flex-1 truncate"
                      }
                    >
                      {item.label}
                    </span>
                    {!isCollapsed ? (
                      <ChevronDown
                        aria-hidden="true"
                        className={[
                          "size-4 shrink-0 transition-transform",
                          isSectionOpen ? "rotate-180" : "",
                        ].join(" ")}
                      />
                    ) : null}
                  </button>

                  {isSectionOpen && !isCollapsed ? (
                    <div className="ml-7 grid gap-1 border-l border-[#d7c5ad] pl-2 dark:border-white/10">
                      {children.map((child) => {
                        const isChildActive =
                          pathname === child.href ||
                          pathname.startsWith(`${child.href}/`);

                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={onNavigate}
                            className={[
                              "flex min-h-9 items-center rounded-lg px-3 text-xs font-extrabold transition",
                              isChildActive
                                ? "bg-brand-sand text-brand-navy"
                                : "text-brand-brown hover:bg-white hover:text-brand-navy dark:hover:bg-white/10 dark:hover:text-white",
                            ].join(" ")}
                          >
                            <span className="min-w-0 truncate">
                              {child.label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            }

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
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="mt-6 border-t border-border-soft pt-4 dark:border-white/10">
        <button
          type="button"
          onClick={handleSignOut}
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
