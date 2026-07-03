/**
 * Pure helpers for eSIM country/plan visibility (Phase 1B).
 *
 * No IO, no `server-only` — node --test friendly (only type-only `@/` imports,
 * plus the dependency-free search sanitizer). `toVisiblePublicPlans` returns the
 * SAME plan objects (filtered/sorted), so no admin field can ever be attached to
 * a public plan DTO.
 */

import type {
  AdminCountryQuery,
  AdminPlanItem,
  AdminPlanQuery,
  EsimVisibilityFilter,
} from "@/features/admin/esim/visibility-types";

export const ESIM_PLANS_PAGE_SIZE = 30;
export const ESIM_COUNTRIES_PAGE_SIZE = 30;

const MAX_SEARCH_LEN = 80;

/**
 * Strip characters that could break a PostgREST `.or()` / ilike filter and bound
 * the length. (Kept local so this module has no runtime imports and stays
 * node --test friendly.)
 */
function sanitizeSearchTerm(raw: string): string {
  return raw
    .replace(/[,()\\%*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SEARCH_LEN);
}

export function resolveCountryDisplayName(
  providerName: string,
  displayNameOverride: string | null | undefined,
): string {
  const override = typeof displayNameOverride === "string" ? displayNameOverride.trim() : "";
  return override || providerName;
}

export function normalizeVisibilityFilter(value: string | string[] | undefined): EsimVisibilityFilter {
  const first = firstParam(value);
  if (first === "visible" || first === "hidden" || first === "featured") return first;
  return "all";
}

export function normalizeCountryAdminQuery(input: {
  filter?: string | string[] | undefined;
  q?: string | string[] | undefined;
  page?: string | string[] | undefined;
}): AdminCountryQuery {
  return {
    filter: normalizeVisibilityFilter(input.filter),
    search: sanitizeSearchTerm(firstParam(input.q)),
    page: clampPage(firstParam(input.page)),
    pageSize: ESIM_COUNTRIES_PAGE_SIZE,
  };
}

/**
 * Rank public country search results by relevance:
 * exact ISO > exact name > name startsWith > ISO startsWith > name includes >
 * region includes. Non-matches are dropped. Ties preserve the input order, which
 * is already featured -> sort_order -> name from the DB query.
 */
export function rankPublicCountries<
  T extends { isoCode: string; name: string; regionName?: string | null },
>(countries: T[], rawQuery: string): T[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return countries;

  const scored: Array<{ country: T; index: number; score: number }> = [];
  countries.forEach((country, index) => {
    const name = country.name.toLowerCase();
    const iso = country.isoCode.toLowerCase();
    const region = (country.regionName ?? "").toLowerCase();

    let score = -1;
    if (iso === query) score = 0;
    else if (name === query) score = 1;
    else if (name.startsWith(query)) score = 2;
    else if (iso.startsWith(query)) score = 3;
    else if (name.includes(query)) score = 4;
    else if (region && region.includes(query)) score = 5;

    if (score >= 0) scored.push({ country, index, score });
  });

  scored.sort((a, b) => (a.score !== b.score ? a.score - b.score : a.index - b.index));
  return scored.map((entry) => entry.country);
}

export function normalizePlanAdminQuery(input: {
  filter?: string | string[] | undefined;
  country?: string | string[] | undefined;
  q?: string | string[] | undefined;
  page?: string | string[] | undefined;
}): AdminPlanQuery {
  const country = firstParam(input.country).trim().toUpperCase();
  return {
    filter: normalizeVisibilityFilter(input.filter),
    countryCode: country && /^[A-Z]{2}$/.test(country) ? country : "all",
    search: sanitizeSearchTerm(firstParam(input.q)),
    page: clampPage(firstParam(input.page)),
    pageSize: ESIM_PLANS_PAGE_SIZE,
  };
}

// ---- Plan controls: row shape + merge/filter ------------------------------

export type PlanControlRow = {
  country_code: string;
  plan_code: string;
  is_visible: boolean;
  is_featured: boolean;
  sort_order: number;
  disabled_reason: string | null;
  admin_note: string | null;
};

/** Cache plan flattened for the admin plans table. */
export type PlanFlatSource = {
  countryCode: string;
  planCode: string;
  planName: string | null;
  price: number | null;
  currency: string | null;
};

function planKey(countryCode: string, planCode: string): string {
  return `${countryCode.trim().toUpperCase()}::${planCode.trim().toLowerCase()}`;
}

/** Index single-country plan controls by (lower-cased) plan_code. */
export function indexControlsByPlanCode(controls: PlanControlRow[]): Map<string, PlanControlRow> {
  const map = new Map<string, PlanControlRow>();
  for (const control of controls) {
    map.set(control.plan_code.trim().toLowerCase(), control);
  }
  return map;
}

export function isPlanVisibleByControls(
  controls: Map<string, PlanControlRow>,
  planCode: string,
): boolean {
  const control = controls.get(planCode.trim().toLowerCase());
  return control ? control.is_visible : true;
}

/**
 * Public plan visibility: drop hidden plans, order featured-first then
 * sort_order then provider order. Returns the SAME plan objects (no admin data
 * added), so admin_note/disabled_reason can never leak into a public DTO.
 */
export function toVisiblePublicPlans<T extends { planCode: string }>(
  plans: T[],
  controls: Map<string, PlanControlRow>,
): T[] {
  const decorated = plans
    .map((plan, index) => ({
      plan,
      index,
      control: controls.get(plan.planCode.trim().toLowerCase()) ?? null,
    }))
    .filter((entry) => (entry.control ? entry.control.is_visible : true));

  decorated.sort((a, b) => {
    const featuredDelta =
      Number(Boolean(b.control?.is_featured)) - Number(Boolean(a.control?.is_featured));
    if (featuredDelta !== 0) return featuredDelta;
    const sortDelta = (a.control?.sort_order ?? 0) - (b.control?.sort_order ?? 0);
    if (sortDelta !== 0) return sortDelta;
    return a.index - b.index;
  });

  return decorated.map((entry) => entry.plan);
}

/** Merge flattened cache plans with controls into the admin plans list. */
export function mergePlanControlsForAdmin(
  plans: PlanFlatSource[],
  controls: PlanControlRow[],
): AdminPlanItem[] {
  const index = new Map<string, PlanControlRow>();
  for (const control of controls) {
    index.set(planKey(control.country_code, control.plan_code), control);
  }

  return plans.map((plan) => {
    const control = index.get(planKey(plan.countryCode, plan.planCode)) ?? null;
    return {
      countryCode: plan.countryCode,
      planCode: plan.planCode,
      planName: plan.planName,
      price: plan.price,
      currency: plan.currency,
      isVisible: control ? control.is_visible : true,
      isFeatured: control ? control.is_featured : false,
      sortOrder: control ? control.sort_order : 0,
      disabledReason: control?.disabled_reason ?? null,
      adminNote: control?.admin_note ?? null,
      hasControl: control != null,
    };
  });
}

/** Apply the admin plans filter + search in memory (data lives in JSONB cache). */
export function filterAdminPlans(items: AdminPlanItem[], query: AdminPlanQuery): AdminPlanItem[] {
  const search = query.search.trim().toLowerCase();

  return items.filter((item) => {
    if (query.countryCode !== "all" && item.countryCode.toUpperCase() !== query.countryCode) {
      return false;
    }
    if (query.filter === "visible" && !item.isVisible) return false;
    if (query.filter === "hidden" && item.isVisible) return false;
    if (query.filter === "featured" && !item.isFeatured) return false;
    if (search) {
      const haystack = [item.planName, item.planCode, item.countryCode]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

/** Stable admin ordering: featured first, then sort_order, then plan code. */
export function sortAdminPlans(items: AdminPlanItem[]): AdminPlanItem[] {
  return [...items].sort((a, b) => {
    if (a.countryCode !== b.countryCode) return a.countryCode.localeCompare(b.countryCode);
    const featuredDelta = Number(b.isFeatured) - Number(a.isFeatured);
    if (featuredDelta !== 0) return featuredDelta;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.planCode.localeCompare(b.planCode);
  });
}

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const from = (page - 1) * pageSize;
  return items.slice(from, from + pageSize);
}

export function computePlanPageCount(total: number, pageSize: number): number {
  if (total <= 0 || pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

// ---- internal -------------------------------------------------------------

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function clampPage(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}
