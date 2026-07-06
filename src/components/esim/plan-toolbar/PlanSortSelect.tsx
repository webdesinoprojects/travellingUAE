"use client";

import type { PlanSortOption } from "@/server/providers/airhub/plan-search";

const SORT_OPTIONS: Array<{ value: PlanSortOption; label: string }> = [
  { value: "recommended", label: "Recommended" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "capacity_asc", label: "Data: Low to High" },
  { value: "capacity_desc", label: "Data: High to Low" },
  { value: "validity_asc", label: "Validity: Short to Long" },
  { value: "validity_desc", label: "Validity: Long to Short" },
];

export function PlanSortSelect({
  value,
  onChange,
}: {
  value: PlanSortOption;
  onChange: (value: PlanSortOption) => void;
}) {
  return (
    <label className="grid min-w-0 gap-1">
      <span className="sr-only">Sort plans</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as PlanSortOption)}
        className="h-11 w-full min-w-0 rounded-lg border border-border-soft bg-surface px-2.5 text-xs font-bold text-brand-navy outline-none focus:border-brand-blue sm:text-sm dark:text-white"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
