"use client";

import { RotateCcw } from "lucide-react";

import {
  isDefaultPlanFilterQuery,
  type PlanFilterQuery,
} from "@/server/providers/airhub/plan-search";

import { PlanFilterSelects } from "./PlanFilterSelects";
import { PlanSearchInput } from "./PlanSearchInput";
import { PlanSortSelect } from "./PlanSortSelect";

/** Search + filters + sort for the public eSIM plan grid. Server-side data stays untouched - this only reorders/hides the already-fetched list client-side. */
export function PlanToolbar({
  query,
  operators,
  resetToken,
  onChange,
  onReset,
  resultCount,
  totalCount,
}: {
  query: PlanFilterQuery;
  operators: string[];
  resetToken: number;
  onChange: (patch: Partial<PlanFilterQuery>) => void;
  onReset: () => void;
  resultCount: number;
  totalCount: number;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-border-soft bg-surface p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <PlanSearchInput
          key={resetToken}
          initialValue={query.search}
          onChange={(search) => onChange({ search })}
        />
        <div className="sm:w-56">
          <PlanSortSelect value={query.sort} onChange={(sort) => onChange({ sort })} />
        </div>
      </div>

      <PlanFilterSelects query={query} operators={operators} onChange={onChange} />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-brand-navy/55 dark:text-white/55">
        <span>
          Showing {resultCount} of {totalCount} plan{totalCount === 1 ? "" : "s"}
        </span>
        {!isDefaultPlanFilterQuery(query) ? (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 text-brand-blue transition hover:underline dark:text-brand-sand"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Reset filters
          </button>
        ) : null}
      </div>
    </div>
  );
}
