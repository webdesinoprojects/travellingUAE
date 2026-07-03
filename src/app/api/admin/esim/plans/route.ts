import type { NextRequest } from "next/server";

import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { readJsonObject, readString } from "@/server/http/validation";
import { savePlanControl } from "@/server/admin/esim-plans";
import { verifyAdminApiAccess } from "@/server/supabase/auth";
import { hasSupabaseAdminEnv } from "@/server/supabase/client";
import type { PlanControlPatch } from "@/features/admin/esim/visibility-types";

export const dynamic = "force-dynamic";

/** Admin-only plan visibility control upsert (by country_code + plan_code). */
export async function PATCH(request: NextRequest) {
  try {
    const access = await verifyAdminApiAccess(request, "admin");
    if (!access.ok) {
      return jsonError(access.status, "You are not allowed to access this area.");
    }
    if (!hasSupabaseAdminEnv()) {
      return jsonError(503, "Database is not configured.");
    }

    const body = await readJsonObject(request);
    const countryCode = readString(body, "countryCode", { min: 2, max: 2, required: true })!.toUpperCase();
    const planCode = readString(body, "planCode", { min: 1, max: 120, required: true })!;
    const planNameSnapshot = readString(body, "planName", { max: 200 }) ?? null;

    const patch = buildPlanPatch(body);
    if (Object.keys(patch).length === 0) {
      return jsonError(400, "No changes were provided.");
    }

    await savePlanControl({ countryCode, planCode, planNameSnapshot, patch });
    return jsonOk({ ok: true });
  } catch (error) {
    logServerError("api.admin.esim.plans.update", error);
    return jsonError(500);
  }
}

function buildPlanPatch(body: Record<string, unknown>): PlanControlPatch {
  const patch: PlanControlPatch = {};
  if (typeof body.isVisible === "boolean") patch.isVisible = body.isVisible;
  if (typeof body.isFeatured === "boolean") patch.isFeatured = body.isFeatured;
  if ("disabledReason" in body) patch.disabledReason = readNullableText(body.disabledReason, 300);
  if ("adminNote" in body) patch.adminNote = readNullableText(body.adminNote, 2000);
  if (body.sortOrder !== undefined) patch.sortOrder = clampSortOrder(body.sortOrder);
  return patch;
}

function readNullableText(value: unknown, max: number): string | null {
  if (value == null || typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function clampSortOrder(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.trunc(Math.min(Math.max(parsed, -100000), 100000));
}
