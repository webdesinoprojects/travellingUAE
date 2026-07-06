/**
 * Pure search/filter/sort helpers for the public eSIM plan grid.
 *
 * Dependency-free (node --test friendly). Every filter/sort here operates ONLY
 * on real Airhub fields already present on AirhubPublicPlan - no APN/hotspot/
 * network-generation/plan-tier filters, since those are not structured fields
 * on the confirmed contract (see plan-display.ts, which stays scoped to the
 * details modal for that free-text content).
 */

import type { AirhubPublicPlan } from "./contracts";

export type PlanPhoneFilter = "all" | "data_only" | "voice_data";
export type PlanRenewalFilter = "all" | "available" | "one_time";
export type PlanSortOption =
  | "recommended"
  | "price_asc"
  | "price_desc"
  | "capacity_asc"
  | "capacity_desc"
  | "validity_asc"
  | "validity_desc";

export type PlanFilterQuery = {
  search: string;
  phoneFilter: PlanPhoneFilter;
  renewalFilter: PlanRenewalFilter;
  /** Exact networkOperator value, or "all". */
  operator: string;
  sort: PlanSortOption;
};

export const DEFAULT_PLAN_FILTER_QUERY: PlanFilterQuery = {
  search: "",
  phoneFilter: "all",
  renewalFilter: "all",
  operator: "all",
  sort: "recommended",
};

export function isDefaultPlanFilterQuery(query: PlanFilterQuery): boolean {
  return (
    query.search.trim() === "" &&
    query.phoneFilter === "all" &&
    query.renewalFilter === "all" &&
    query.operator === "all" &&
    query.sort === "recommended"
  );
}

/** Unique, sorted operator names actually present in this plan list. Never hardcoded. */
export function getAvailablePlanOperators(plans: AirhubPublicPlan[]): string[] {
  const seen = new Set<string>();
  for (const plan of plans) {
    const value = plan.networkOperator?.trim();
    if (value) seen.add(value);
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

function planCapacityNumber(plan: AirhubPublicPlan): number | null {
  const capacity = plan.capacity?.trim();
  if (!capacity) return null;
  const parsed = Number(capacity);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Validity in whole days, derived ONLY when safely confirmed: either a real
 * numeric `validity` field, or a count found in the plan's own `planName`
 * next to its real `validityType` word (e.g. "30days" alongside a
 * validityType of "Days"). Returns null - never guessed - otherwise, so plans
 * without a confirmable validity simply sort to the end (see rankValue).
 */
export function derivePlanValidityDays(plan: AirhubPublicPlan): number | null {
  const validity = plan.validity?.trim();
  if (validity) {
    const parsed = Number(validity);
    if (Number.isFinite(parsed)) return parsed;
  }

  const validityType = plan.validityType?.trim();
  if (!validityType || !plan.planName) return null;
  const escaped = validityType.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(\\d+)\\s*${escaped}`, "i").exec(plan.planName);
  return match ? Number(match[1]) : null;
}

function matchesSearch(plan: AirhubPublicPlan, term: string): boolean {
  if (!term) return true;
  const haystack = [plan.planName, plan.countryName, plan.networkOperator]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
}

/** Missing values always sink to the end, regardless of sort direction. */
function rankValue(value: number | null, descending: boolean): number {
  if (value == null) return Number.POSITIVE_INFINITY;
  return descending ? -value : value;
}

function comparePlans(a: AirhubPublicPlan, b: AirhubPublicPlan, sort: PlanSortOption): number {
  switch (sort) {
    case "price_asc":
      return rankValue(a.price, false) - rankValue(b.price, false);
    case "price_desc":
      return rankValue(a.price, true) - rankValue(b.price, true);
    case "capacity_asc":
      return rankValue(planCapacityNumber(a), false) - rankValue(planCapacityNumber(b), false);
    case "capacity_desc":
      return rankValue(planCapacityNumber(a), true) - rankValue(planCapacityNumber(b), true);
    case "validity_asc":
      return rankValue(derivePlanValidityDays(a), false) - rankValue(derivePlanValidityDays(b), false);
    case "validity_desc":
      return rankValue(derivePlanValidityDays(a), true) - rankValue(derivePlanValidityDays(b), true);
    default:
      return 0;
  }
}

export function filterAndSortPlans(
  plans: AirhubPublicPlan[],
  query: PlanFilterQuery,
): AirhubPublicPlan[] {
  const term = query.search.trim().toLowerCase();

  const filtered = plans.filter((plan) => {
    if (!matchesSearch(plan, term)) return false;
    if (query.phoneFilter === "data_only" && plan.phoneNumber !== false) return false;
    if (query.phoneFilter === "voice_data" && plan.phoneNumber !== true) return false;
    if (query.renewalFilter === "available" && plan.subscription !== true) return false;
    if (query.renewalFilter === "one_time" && plan.subscription !== false) return false;
    if (query.operator !== "all" && plan.networkOperator !== query.operator) return false;
    return true;
  });

  if (query.sort === "recommended") return filtered;

  // Stable sort with an explicit tie-break (Array.prototype.sort stability is
  // spec-guaranteed in modern engines, but the tie-break keeps this correct
  // regardless).
  return filtered
    .map((plan, index) => ({ plan, index }))
    .sort((a, b) => {
      const cmp = comparePlans(a.plan, b.plan, query.sort);
      return cmp !== 0 ? cmp : a.index - b.index;
    })
    .map((entry) => entry.plan);
}
