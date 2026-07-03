import "server-only";

import { getSupabaseAdminClient } from "@/server/supabase/client";
import { readPlanControls, upsertPlanControl } from "@/server/esim/plan-controls";
import {
  computePlanPageCount,
  filterAdminPlans,
  mergePlanControlsForAdmin,
  paginate,
  sortAdminPlans,
  type PlanFlatSource,
} from "@/server/admin/esim-visibility-helpers";
import type {
  AdminPlanListResult,
  AdminPlanQuery,
  PlanControlPatch,
} from "@/features/admin/esim/visibility-types";

/**
 * Admin plans DAL. Plans live inside airhub_plan_cache as JSONB arrays, so we
 * flatten the cache server-side and merge the airhub_plan_controls table by
 * (country_code, plan_code). Admin fields (admin_note, disabled_reason) are only
 * ever returned to admin pages; they are never joined into public plan DTOs.
 */

const MAX_CACHE_ROWS = 500;

type PlanCacheRow = {
  country_code: string | null;
  plans: unknown;
};

export async function listAdminPlans(query: AdminPlanQuery): Promise<AdminPlanListResult> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("airhub_plan_cache")
    .select("country_code,plans")
    .limit(MAX_CACHE_ROWS);

  if (error) {
    throw error;
  }

  const flat = flattenCachePlans((data ?? []) as PlanCacheRow[]);
  const controls = await readPlanControls();
  const merged = mergePlanControlsForAdmin(flat, controls);

  const countries = Array.from(new Set(merged.map((item) => item.countryCode)))
    .filter(Boolean)
    .sort();

  const filtered = sortAdminPlans(filterAdminPlans(merged, query));
  const total = filtered.length;

  return {
    items: paginate(filtered, query.page, query.pageSize),
    countries,
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: computePlanPageCount(total, query.pageSize),
  };
}

export async function savePlanControl(input: {
  countryCode: string;
  planCode: string;
  planNameSnapshot: string | null;
  patch: PlanControlPatch;
}): Promise<void> {
  await upsertPlanControl(input);
}

function flattenCachePlans(rows: PlanCacheRow[]): PlanFlatSource[] {
  const seen = new Set<string>();
  const flat: PlanFlatSource[] = [];

  for (const row of rows) {
    const countryCode = (row.country_code ?? "").trim().toUpperCase();
    if (!countryCode || !Array.isArray(row.plans)) continue;

    for (const entry of row.plans) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const record = entry as Record<string, unknown>;
      const planCode = typeof record.planCode === "string" ? record.planCode : null;
      if (!planCode) continue;

      const key = `${countryCode}::${planCode.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      flat.push({
        countryCode,
        planCode,
        planName: typeof record.planName === "string" ? record.planName : null,
        price: toNumberOrNull(record.price),
        currency: typeof record.currency === "string" ? record.currency : null,
      });
    }
  }

  return flat;
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
