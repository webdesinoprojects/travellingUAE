import Link from "next/link";
import { ArrowRight, Download, Plus } from "lucide-react";

import { CmsPagesEditor } from "@/features/admin/components/CmsPagesEditor";
import { FooterSettingsEditor } from "@/features/admin/components/FooterSettingsEditor";
import { MetricCard, StatusBadge } from "@/features/admin/components/AdminDashboard";
import { HomeContentEditor } from "@/features/admin/components/HomeContentEditor";
import { HomeHeroEditor } from "@/features/admin/components/HomeHeroEditor";
import { NavigationContentEditor } from "@/features/admin/components/NavigationContentEditor";
import { ResourceToolbar } from "@/features/admin/components/ResourceToolbar";
import { TranslationContentEditor } from "@/features/admin/components/TranslationContentEditor";
import type { AdminResourceConfig, AdminResourceRow } from "@/features/admin/types";
import { getAdminResourceDTO, type AdminResourceKey } from "@/server/admin/dal";
import { getAdminFooterSettings } from "@/server/admin/footer-settings";
import { getAdminHomeContent } from "@/server/admin/home-content";
import { getAdminHomeHero } from "@/server/admin/home-cms";
import { getAdminNavigationContent } from "@/server/admin/navigation-content";
import { getAdminCmsPageContent } from "@/server/admin/page-content";
import { getAdminTranslationContent } from "@/server/admin/translation-content";

type SearchParams = Record<string, string | string[] | undefined>;

type AdminResourcePageProps = {
  resource: AdminResourceKey;
  searchParams?: SearchParams;
};

function sp(params: SearchParams | undefined, key: string): string | undefined {
  const v = params?.[key];
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
}

export async function AdminResourcePage({
  resource,
  searchParams,
}: AdminResourcePageProps) {
  const listParams = {
    q: sp(searchParams, "q"),
    status: sp(searchParams, "status"),
    cursor: sp(searchParams, "cursor"),
    limit: sp(searchParams, "limit") ? Number(sp(searchParams, "limit")) : undefined,
  };

  const [
    config,
    homeHero,
    homeContent,
    footerSettings,
    navigationContent,
    pageContent,
    translationContent,
  ] = await Promise.all([
    getAdminResourceDTO(resource, listParams),
    resource === "home" ? getAdminHomeHero() : Promise.resolve(null),
    resource === "home" ? getAdminHomeContent() : Promise.resolve(null),
    resource === "home" ? getAdminFooterSettings() : Promise.resolve(null),
    resource === "navigation" ? getAdminNavigationContent() : Promise.resolve(null),
    resource === "pages" ? getAdminCmsPageContent() : Promise.resolve(null),
    resource === "translations" ? getAdminTranslationContent() : Promise.resolve(null),
  ]);

  if (homeHero && homeContent && footerSettings) {
    return (
      <div className="grid gap-5">
        <ResourceHero config={config} showActions={false} />
        <HomeHeroEditor initialHero={homeHero} />
        <HomeContentEditor initialContent={homeContent} />
        <FooterSettingsEditor initialSettings={footerSettings} />
      </div>
    );
  }

  if (navigationContent) {
    return (
      <div className="grid gap-5">
        <ResourceHero config={config} showActions={false} />
        <NavigationContentEditor initialContent={navigationContent} />
      </div>
    );
  }

  if (pageContent) {
    return (
      <div className="grid gap-5">
        <ResourceHero config={config} showActions={false} />
        <CmsPagesEditor initialContent={pageContent} />
      </div>
    );
  }

  if (translationContent) {
    return (
      <div className="grid gap-5">
        <ResourceHero config={config} showActions={false} />
        <TranslationContentEditor initialContent={translationContent} />
      </div>
    );
  }

  // Operational page: bookings, destinations, categories, trips — real data, no fake stats/queue
  if (
    resource === "bookings" ||
    resource === "destinations" ||
    resource === "categories" ||
    resource === "trips"
  ) {
    const createHref = `/admin/${resource}/new`;

    return (
      <div className="grid gap-5">
        <ResourceHero
          config={config}
          createHref={createHref}
          exportHref={
            resource === "bookings" ? "/api/admin/bookings/export" : undefined
          }
        />
        <ResourceToolbar
          resource={resource}
          nextCursor={config.pageInfo?.nextCursor}
          hasMore={config.pageInfo?.hasMore}
        />
        <OperationalTable resource={resource} config={config} />
      </div>
    );
  }

  // Generic module page — remove AdminCrudPanel; keep stats/queue from config (Codex territory)
  return (
    <div className="grid gap-5">
      <ResourceHero config={config} />

      <section className="grid gap-4 md:grid-cols-3">
        {config.stats.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <GenericTable config={config} />
        <ResourceQueue config={config} />
      </div>
    </div>
  );
}

// ── Resource hero ──────────────────────────────────────────────────────────────

function ResourceHero({
  config,
  showActions = true,
  createHref,
  exportHref,
}: {
  config: AdminResourceConfig;
  showActions?: boolean;
  createHref?: string;
  exportHref?: string;
}) {
  return (
    <section className="rounded-lg border border-[#d7c5ad] bg-brand-navy p-5 text-white shadow-[0_22px_70px_rgb(7_23_57/0.16)] dark:border-white/10">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-sand">
            {config.eyebrow}
          </p>
          <h1 className="mt-3 font-serif text-3xl font-black tracking-tight sm:text-4xl">
            {config.title}
          </h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-[#c2e8ff] sm:text-base">
            {config.description}
          </p>
        </div>
        {showActions ? (
          <div className="flex flex-wrap gap-3">
            {exportHref ? (
              <a
                href={exportHref}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 text-sm font-black text-white"
              >
                <Download aria-hidden="true" className="size-4" />
                Export CSV
              </a>
            ) : config.secondaryAction ? (
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 text-sm font-black text-white"
                disabled
              >
                <Download aria-hidden="true" className="size-4" />
                {config.secondaryAction}
              </button>
            ) : null}

            {createHref ? (
              <Link
                href={createHref}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-sand px-4 text-sm font-black text-brand-navy shadow-[0_12px_30px_rgb(0_0_0/0.2)]"
              >
                <Plus aria-hidden="true" className="size-4" />
                {config.primaryAction}
              </Link>
            ) : (
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-sand px-4 text-sm font-black text-brand-navy shadow-[0_12px_30px_rgb(0_0_0/0.2)]"
              >
                <Plus aria-hidden="true" className="size-4" />
                {config.primaryAction}
              </button>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

// ── Operational table (bookings / destinations / categories) ─────────────────

function OperationalTable({
  resource,
  config,
}: {
  resource: string;
  config: AdminResourceConfig;
}) {
  if (config.rows.length === 0) {
    return (
      <section className="rounded-lg border border-[#d7c5ad] bg-white/78 p-8 text-center shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]">
        <p className="text-sm font-black text-brand-brown">No records found.</p>
        <p className="mt-1 text-xs font-semibold text-brand-brown">
          Try adjusting your search or filters, or create a new record.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-[#d7c5ad] bg-white/78 p-4 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#d7c5ad] text-xs uppercase tracking-[0.14em] text-brand-brown dark:border-white/10">
              {config.columns.map((column) => (
                <th key={String(column.key)} className="py-3 pr-4">
                  {column.label}
                </th>
              ))}
              <th className="py-3 text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            {config.rows.map((row, index) => (
              <OperationalRow
                key={row.id ? String(row.id) : `row-${index}`}
                resource={resource}
                row={row}
                config={config}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OperationalRow({
  resource,
  row,
  config,
}: {
  resource: string;
  row: AdminResourceRow;
  config: AdminResourceConfig;
}) {
  const rowId = row.id ? String(row.id) : null;

  return (
    <tr className="border-b border-[#ead7bd] last:border-none dark:border-white/10">
      {config.columns.map((column) => {
        const value = row[column.key];
        const isStatus = column.key === "status";

        return (
          <td key={String(column.key)} className="py-4 pr-4 font-bold">
            {isStatus && typeof value === "string" ? (
              <StatusBadge
                status={value as Parameters<typeof StatusBadge>[0]["status"]}
              />
            ) : (
              <span>{value}</span>
            )}
          </td>
        );
      })}
      <td className="py-4 text-right">
        {rowId ? (
          <Link
            href={`/admin/${resource}/${rowId}`}
            className="inline-grid size-9 place-items-center rounded-lg bg-brand-navy text-white dark:bg-brand-sand dark:text-brand-navy"
            aria-label="Open record"
          >
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        ) : (
          <span className="inline-grid size-9 place-items-center rounded-lg bg-[#f5ede2] text-brand-brown dark:bg-white/10">
            <ArrowRight aria-hidden="true" className="size-4" />
          </span>
        )}
      </td>
    </tr>
  );
}

// ── Generic table (trips, media, pages, etc.) ─────────────────────────────────

function GenericTable({
  config,
}: {
  config: AdminResourceConfig;
}) {
  return (
    <section className="rounded-lg border border-[#d7c5ad] bg-white/78 p-4 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">Records</h2>
          <p className="text-sm font-semibold text-brand-brown">
            Protected display fields only. Sensitive details stay server-side.
          </p>
        </div>
      </div>

      {config.rows.length === 0 ? (
        <p className="py-6 text-center text-sm font-semibold text-brand-brown">
          No records available.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#d7c5ad] text-xs uppercase tracking-[0.14em] text-brand-brown dark:border-white/10">
                {config.columns.map((column) => (
                  <th key={String(column.key)} className="py-3 pr-4">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {config.rows.map((row, index) => {
                const rowId = row.id ? String(row.id) : null;

                return (
                  <tr
                    key={rowId ?? `row-${index}`}
                    className="border-b border-[#ead7bd] last:border-none dark:border-white/10"
                  >
                    {config.columns.map((column) => {
                      const value = row[column.key];
                      const isStatus = column.key === "status";

                      return (
                        <td
                          key={String(column.key)}
                          className="py-4 pr-4 font-bold"
                        >
                          {isStatus && typeof value === "string" ? (
                            <StatusBadge
                              status={
                                value as Parameters<typeof StatusBadge>[0]["status"]
                              }
                            />
                          ) : (
                            <span>{value}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ResourceQueue({ config }: { config: AdminResourceConfig }) {
  return (
    <aside className="rounded-lg border border-[#d7c5ad] bg-white/78 p-4 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">{config.queueTitle}</h2>
          <p className="text-sm font-semibold text-brand-brown">
            Operational tasks for this module.
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        {config.queue.map((item) => (
          <div
            key={item.title}
            className="rounded-lg border border-[#d7c5ad] bg-[#fffaf2] p-3 dark:border-white/10 dark:bg-white/[0.06]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black">{item.title}</p>
                <p className="mt-1 text-xs font-bold text-brand-brown">
                  {item.owner} - {item.due}
                </p>
              </div>
              <StatusBadge status={item.status} />
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
