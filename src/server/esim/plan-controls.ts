import "server-only";

import { getSupabaseAdminClient } from "@/server/supabase/client";
import type { PlanControlRow } from "@/server/admin/esim-visibility-helpers";
import type { PlanControlPatch } from "@/features/admin/esim/visibility-types";

/**
 * Read/write access to airhub_plan_controls (Phase 1B). Shared by the admin DAL
 * and the public visible-plan layer. All access is via the service-role client;
 * controls are never exposed to anon clients (no public RLS policy).
 */

const PROVIDER = "airhub";
const CONTROL_COLUMNS =
  "country_code,plan_code,is_visible,is_featured,sort_order,disabled_reason,admin_note";

/** Read plan controls, optionally scoped to a single (upper-cased) country. */
export async function readPlanControls(countryCode?: string): Promise<PlanControlRow[]> {
  const supabase = getSupabaseAdminClient();
  let query = supabase.from("airhub_plan_controls").select(CONTROL_COLUMNS).eq("provider", PROVIDER);

  if (countryCode) {
    query = query.eq("country_code", countryCode.toUpperCase());
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return (data ?? []) as unknown as PlanControlRow[];
}

/**
 * Upsert a single plan control. Only the fields present in `patch` are written,
 * so a partial edit never clobbers other admin flags. The provider plan-cache
 * refresh never touches this table, so controls survive cache refreshes.
 */
export async function upsertPlanControl(input: {
  countryCode: string;
  planCode: string;
  planNameSnapshot: string | null;
  patch: PlanControlPatch;
}): Promise<void> {
  const supabase = getSupabaseAdminClient();

  const row: Record<string, unknown> = {
    provider: PROVIDER,
    country_code: input.countryCode.toUpperCase(),
    plan_code: input.planCode,
    plan_name_snapshot: input.planNameSnapshot,
  };
  if (input.patch.isVisible !== undefined) row.is_visible = input.patch.isVisible;
  if (input.patch.isFeatured !== undefined) row.is_featured = input.patch.isFeatured;
  if (input.patch.sortOrder !== undefined) row.sort_order = input.patch.sortOrder;
  if (input.patch.disabledReason !== undefined) row.disabled_reason = input.patch.disabledReason;
  if (input.patch.adminNote !== undefined) row.admin_note = input.patch.adminNote;

  const { error } = await supabase
    .from("airhub_plan_controls")
    .upsert(row, { onConflict: "provider,country_code,plan_code" });

  if (error) {
    throw error;
  }
}
