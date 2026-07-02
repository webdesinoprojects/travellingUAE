"use client";

import { useMemo, useState } from "react";

import { PaginationControls, buildPaginationSummary } from "@/components/esim/PaginationControls";
import { PlanCard } from "@/components/esim/PlanCard";
import type { AirhubPublicPlan } from "@/server/providers/airhub/contracts";

const PLANS_PER_PAGE = 9;

export function PaginatedPlanGrid({
  plans,
  countryCode,
}: {
  plans: AirhubPublicPlan[];
  countryCode: string;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(plans.length / PLANS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const visiblePlans = useMemo(() => {
    const start = (currentPage - 1) * PLANS_PER_PAGE;
    return plans.slice(start, start + PLANS_PER_PAGE);
  }, [plans, currentPage]);
  const summary = buildPaginationSummary({
    page: currentPage,
    pageSize: PLANS_PER_PAGE,
    total: plans.length,
    itemLabel: "plans",
  });

  return (
    <div className="grid gap-5">
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
    </div>
  );
}
