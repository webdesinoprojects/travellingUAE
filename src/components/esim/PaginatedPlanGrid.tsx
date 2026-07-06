"use client";

import { useMemo, useState } from "react";

import { PaginationControls, buildPaginationSummary } from "@/components/esim/PaginationControls";
import { PlanCard } from "@/components/esim/PlanCard";
import { PlanDetailsModal } from "@/components/esim/PlanDetailsModal";
import { PlanToolbar } from "@/components/esim/plan-toolbar/PlanToolbar";
import {
  DEFAULT_PLAN_FILTER_QUERY,
  filterAndSortPlans,
  getAvailablePlanOperators,
  type PlanFilterQuery,
} from "@/server/providers/airhub/plan-search";
import type { AirhubPublicPlan } from "@/server/providers/airhub/contracts";

const PLANS_PER_PAGE = 9;

export function PaginatedPlanGrid({
  plans,
  countryCode,
}: {
  plans: AirhubPublicPlan[];
  countryCode: string;
}) {
  const [query, setQuery] = useState<PlanFilterQuery>(DEFAULT_PLAN_FILTER_QUERY);
  // Bumped on "Reset filters" to remount the search input back to empty.
  const [resetToken, setResetToken] = useState(0);
  const [page, setPage] = useState(1);
  const [detailsPlan, setDetailsPlan] = useState<AirhubPublicPlan | null>(null);

  const operators = useMemo(() => getAvailablePlanOperators(plans), [plans]);
  const filteredPlans = useMemo(() => filterAndSortPlans(plans, query), [plans, query]);

  const totalPages = Math.max(1, Math.ceil(filteredPlans.length / PLANS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const visiblePlans = useMemo(() => {
    const start = (currentPage - 1) * PLANS_PER_PAGE;
    return filteredPlans.slice(start, start + PLANS_PER_PAGE);
  }, [filteredPlans, currentPage]);
  const summary = buildPaginationSummary({
    page: currentPage,
    pageSize: PLANS_PER_PAGE,
    total: filteredPlans.length,
    itemLabel: "plans",
  });

  function updateQuery(patch: Partial<PlanFilterQuery>) {
    setQuery((current) => ({ ...current, ...patch }));
    setPage(1);
  }

  function resetFilters() {
    setQuery(DEFAULT_PLAN_FILTER_QUERY);
    setResetToken((token) => token + 1);
    setPage(1);
  }

  return (
    <div className="grid gap-5">
      <PlanToolbar
        query={query}
        operators={operators}
        resetToken={resetToken}
        onChange={updateQuery}
        onReset={resetFilters}
        resultCount={filteredPlans.length}
        totalCount={plans.length}
      />

      {filteredPlans.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-soft bg-surface p-8 text-center">
          <p className="text-sm font-bold text-brand-navy/60 dark:text-white/60">
            No plans match your filters.
          </p>
        </div>
      ) : (
        <>
          <PaginationControls
            page={currentPage}
            totalPages={totalPages}
            summary={summary}
            onPageChange={setPage}
          />
          <div className="grid gap-5 lg:grid-cols-3">
            {visiblePlans.map((plan) => (
              <PlanCard
                key={plan.planCode}
                plan={plan}
                countryCode={countryCode}
                onViewDetails={setDetailsPlan}
              />
            ))}
          </div>
          {totalPages > 1 ? (
            <PaginationControls
              page={currentPage}
              totalPages={totalPages}
              summary={summary}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}

      {detailsPlan ? (
        <PlanDetailsModal
          plan={detailsPlan}
          countryCode={countryCode}
          onClose={() => setDetailsPlan(null)}
        />
      ) : null}
    </div>
  );
}
