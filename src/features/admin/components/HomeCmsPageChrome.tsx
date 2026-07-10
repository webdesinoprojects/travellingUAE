import Link from "next/link";
import type { ReactNode } from "react";

type HomeCmsSectionKey =
  | "hero"
  | "services"
  | "routes"
  | "picks"
  | "testimonials"
  | "footer";

type HomeCmsPageChromeProps = {
  active: HomeCmsSectionKey;
  children: ReactNode;
};

const homeCmsSections: Array<{
  key: HomeCmsSectionKey;
  label: string;
  href: string;
}> = [
  { key: "hero", label: "Hero", href: "/admin/home/hero" },
  { key: "services", label: "What We Handle", href: "/admin/home/what-we-handle" },
  { key: "routes", label: "Routes People Ask For", href: "/admin/home/routes" },
  { key: "picks", label: "Fly Time Picks", href: "/admin/home/picks" },
  { key: "testimonials", label: "Traveler Voices", href: "/admin/home/testimonials" },
  { key: "footer", label: "Footer", href: "/admin/home/footer" },
];

export function HomeCmsPageChrome({
  active,
  children,
}: HomeCmsPageChromeProps) {
  const activeSection = homeCmsSections.find((section) => section.key === active);

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border border-[#d7c5ad] bg-white/78 p-4 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-brown">
          Home CMS
        </p>
        <div className="mt-2 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="font-serif text-3xl font-black tracking-tight">
              {activeSection?.label ?? "Homepage"}
            </h1>
            <p className="mt-1 text-sm font-semibold text-brand-brown">
              Edit one homepage section at a time. Saves still use the existing
              CMS APIs and Supabase storage.
            </p>
          </div>
          <nav className="flex max-w-full gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Home CMS sections">
            {homeCmsSections.map((section) => (
              <Link
                key={section.key}
                href={section.href}
                className={[
                  "inline-flex min-h-10 shrink-0 items-center rounded-lg border px-3 text-xs font-black transition",
                  section.key === active
                    ? "border-brand-navy bg-brand-navy text-white dark:border-brand-sand dark:bg-brand-sand dark:text-brand-navy"
                    : "border-[#d7c5ad] bg-[#fffaf2] text-brand-brown hover:border-brand-blue hover:text-brand-navy dark:border-white/10 dark:bg-white/10 dark:text-brand-sand",
                ].join(" ")}
              >
                {section.label}
              </Link>
            ))}
          </nav>
        </div>
      </section>
      {children}
    </div>
  );
}
