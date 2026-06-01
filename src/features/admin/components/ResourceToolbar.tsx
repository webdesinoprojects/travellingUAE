"use client";

import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import type { FormEvent } from "react";

const BOOKING_STATUSES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "completed", label: "Completed" },
];

const PUBLISH_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

type ResourceToolbarProps = {
  resource: string;
  nextCursor?: string | null;
  hasMore?: boolean;
};

export function ResourceToolbar({
  resource,
  nextCursor,
  hasMore,
}: ResourceToolbarProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const currentQ = searchParams.get("q") ?? "";
  const currentStatus = searchParams.get("status") ?? "";
  const hasCursor = searchParams.has("cursor");

  const statuses =
    resource === "bookings" ? BOOKING_STATUSES : PUBLISH_STATUSES;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const q = (form.elements.namedItem("q") as HTMLInputElement).value.trim();
    const status = (form.elements.namedItem("status") as HTMLSelectElement)
      .value;
    const params = new URLSearchParams();

    if (q) {
      params.set("q", q);
    }

    if (status) {
      params.set("status", status);
    }

    router.push(`${pathname}?${params.toString()}`);
  }

  function buildNextUrl() {
    if (!nextCursor) {
      return null;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("cursor", nextCursor);

    return `${pathname}?${params.toString()}`;
  }

  function buildFirstUrl() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("cursor");

    return `${pathname}?${params.toString()}`;
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#d7c5ad] bg-white/78 p-3 shadow-[0_4px_20px_rgb(7_23_57/0.05)] dark:border-white/10 dark:bg-white/[0.06]">
      <form
        onSubmit={handleSubmit}
        className="flex flex-1 flex-wrap items-center gap-2"
        role="search"
      >
        <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-border-soft bg-[#fffaf2] px-3 py-2 dark:bg-white/10">
          <Search aria-hidden="true" className="size-4 shrink-0 text-brand-brown" />
          <input
            type="search"
            name="q"
            defaultValue={currentQ}
            placeholder="Search…"
            aria-label="Search records"
            autoComplete="off"
            className="flex-1 bg-transparent text-sm text-brand-navy outline-none placeholder:text-brand-brown dark:text-white"
          />
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border-soft bg-[#fffaf2] px-3 py-2 dark:bg-white/10">
          <SlidersHorizontal aria-hidden="true" className="size-4 shrink-0 text-brand-brown" />
          <select
            name="status"
            defaultValue={currentStatus}
            aria-label="Filter by status"
            className="bg-transparent text-sm font-bold text-brand-navy outline-none dark:text-white"
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-brand-navy px-4 text-sm font-black text-white dark:bg-brand-sand dark:text-brand-navy"
        >
          Apply
        </button>
      </form>

      <div className="flex items-center gap-2">
        {hasCursor ? (
          <Link
            href={buildFirstUrl()}
            className="inline-flex min-h-9 items-center rounded-lg border border-border-soft bg-white px-3 text-sm font-bold text-brand-brown hover:text-brand-navy dark:bg-white/10 dark:text-brand-sand"
          >
            ← First page
          </Link>
        ) : null}

        {hasMore && nextCursor ? (
          <Link
            href={buildNextUrl() ?? "#"}
            className="inline-flex min-h-9 items-center rounded-lg border border-border-soft bg-white px-3 text-sm font-bold text-brand-brown hover:text-brand-navy dark:bg-white/10 dark:text-brand-sand"
          >
            Next →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
