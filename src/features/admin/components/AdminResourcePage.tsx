import Link from "next/link";
import { ArrowRight, Download, Plus, Search } from "lucide-react";

import { MetricCard, StatusBadge } from "@/features/admin/components/AdminDashboard";
import { resourceConfigs } from "@/features/admin/mock/admin-data";
import type { AdminResourceConfig, AdminResourceRow } from "@/features/admin/types";

type AdminResourcePageProps = {
  resource: keyof typeof resourceConfigs;
};

export function AdminResourcePage({ resource }: AdminResourcePageProps) {
  const config = resourceConfigs[resource];

  return (
    <div className="grid gap-5">
      <ResourceHero config={config} />

      <section className="grid gap-4 md:grid-cols-3">
        {config.stats.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ResourceTable config={config} />
        <ResourceQueue config={config} />
      </div>

      <ResourceFormPreview config={config} />
    </div>
  );
}

function ResourceHero({ config }: { config: AdminResourceConfig }) {
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
        <div className="flex flex-wrap gap-3">
          {config.secondaryAction ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 text-sm font-black text-white"
            >
              <Download aria-hidden="true" className="size-4" />
              {config.secondaryAction}
            </button>
          ) : null}
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-sand px-4 text-sm font-black text-brand-navy shadow-[0_12px_30px_rgb(0_0_0/0.2)]"
          >
            <Plus aria-hidden="true" className="size-4" />
            {config.primaryAction}
          </button>
        </div>
      </div>
    </section>
  );
}

function ResourceTable({ config }: { config: AdminResourceConfig }) {
  return (
    <section className="rounded-lg border border-[#d7c5ad] bg-white/78 p-4 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">Records</h2>
          <p className="text-sm font-semibold text-brand-brown">
            Demo table uses backend-safe, redacted display data.
          </p>
        </div>
        <div className="flex min-w-[260px] items-center gap-2 rounded-lg border border-border-soft bg-[#fffaf2] px-3 py-2 text-sm text-brand-brown dark:bg-white/10">
          <Search aria-hidden="true" className="size-4" />
          <span>Search current view</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
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
              <ResourceRow
                key={`${config.title}-${index}`}
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

function ResourceRow({
  row,
  config,
}: {
  row: AdminResourceRow;
  config: AdminResourceConfig;
}) {
  return (
    <tr className="border-b border-[#ead7bd] last:border-none dark:border-white/10">
      {config.columns.map((column) => {
        const value = row[column.key];
        const isStatus = column.key === "status";

        return (
          <td key={String(column.key)} className="py-4 pr-4 font-bold">
            {isStatus && typeof value === "string" ? (
              <StatusBadge status={value as Parameters<typeof StatusBadge>[0]["status"]} />
            ) : (
              <span>{value}</span>
            )}
          </td>
        );
      })}
      <td className="py-4 text-right">
        <button
          type="button"
          className="inline-grid size-9 place-items-center rounded-lg bg-brand-navy text-white dark:bg-brand-sand dark:text-brand-navy"
          aria-label="Open record"
        >
          <ArrowRight aria-hidden="true" className="size-4" />
        </button>
      </td>
    </tr>
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

function ResourceFormPreview({ config }: { config: AdminResourceConfig }) {
  return (
    <section className="rounded-lg border border-[#d7c5ad] bg-white/78 p-4 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-brown">
            Future form area
          </p>
          <h2 className="mt-2 text-xl font-black">
            {config.primaryAction} workflow
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-brand-brown">
            This preview reserves the space and component shape for the real
            CRUD form. Later we connect validation, Supabase writes, image
            picker, and audit logs without redesigning the page.
          </p>
        </div>

        <div className="grid gap-3 rounded-lg bg-[#e8f7ff] p-4 dark:bg-white/10">
          <div className="h-10 rounded-lg bg-white dark:bg-white/10" />
          <div className="h-10 rounded-lg bg-white dark:bg-white/10" />
          <div className="h-24 rounded-lg bg-white dark:bg-white/10" />
          <Link
            href="/admin"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-navy px-4 text-sm font-black text-white dark:bg-brand-sand dark:text-brand-navy"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </section>
  );
}
