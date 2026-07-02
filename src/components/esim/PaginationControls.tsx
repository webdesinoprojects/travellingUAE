"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export function PaginationControls({
  page,
  totalPages,
  summary,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  summary: string;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return (
      <p className="text-sm font-bold text-brand-navy/55 dark:text-white/55">
        {summary}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-bold text-brand-navy/55 dark:text-white/55">
        {summary}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex size-10 items-center justify-center rounded-lg border border-border-soft bg-white text-brand-navy transition hover:border-brand-blue disabled:pointer-events-none disabled:opacity-45 dark:bg-surface-muted dark:text-white"
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <span className="min-w-24 text-center text-sm font-black text-brand-navy dark:text-white">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="inline-flex size-10 items-center justify-center rounded-lg border border-border-soft bg-white text-brand-navy transition hover:border-brand-blue disabled:pointer-events-none disabled:opacity-45 dark:bg-surface-muted dark:text-white"
          aria-label="Next page"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function buildPaginationSummary({
  page,
  pageSize,
  total,
  itemLabel,
}: {
  page: number;
  pageSize: number;
  total: number;
  itemLabel: string;
}) {
  if (!total) {
    return `0 ${itemLabel}`;
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return `Showing ${start}-${end} of ${total} ${itemLabel}`;
}
