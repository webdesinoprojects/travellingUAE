import type { NextRequest } from "next/server";

import type { AdminPricingRulePatch } from "@/features/admin/esim/pricing-types";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { readJsonObject, readNumber, readString } from "@/server/http/validation";
import { savePricingRule } from "@/server/esim/pricing-rules";
import {
  isEsimRoundingMode,
  type EsimPricingScope,
} from "@/server/esim/pricing-helpers";
import { verifyAdminApiAccess } from "@/server/supabase/auth";
import { hasSupabaseAdminEnv } from "@/server/supabase/client";

export const dynamic = "force-dynamic";

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
    const patch = buildPricingPatch(body);

    await savePricingRule(patch);
    return jsonOk({ ok: true });
  } catch (error) {
    logServerError("api.admin.esim.pricing.update", error);
    return jsonError(500);
  }
}

function buildPricingPatch(body: Record<string, unknown>): AdminPricingRulePatch {
  const scope = readScope(readString(body, "scope", { required: true, max: 20 })!);
  const countryCode =
    scope === "global"
      ? null
      : readString(body, "countryCode", { min: 2, max: 2, required: true })!.toUpperCase();
  const planCode =
    scope === "plan"
      ? readString(body, "planCode", { min: 1, max: 120, required: true })!
      : null;
  const roundingMode = readString(body, "roundingMode", { required: true, max: 20 })!;

  if (!isEsimRoundingMode(roundingMode)) {
    throw new Error("roundingMode is invalid");
  }

  return {
    scope,
    countryCode,
    planCode,
    markupPercent: readNumber(body, "markupPercent", { min: 0, max: 9999.9999, fallback: 0 })!,
    markupFixed: readNumber(body, "markupFixed", { min: 0, max: 9999999999.99, fallback: 0 })!,
    minMargin: readNumber(body, "minMargin", { min: 0, max: 9999999999.99, fallback: 0 })!,
    roundingMode,
    isActive: body.isActive === true,
  };
}

function readScope(value: string): EsimPricingScope {
  if (value === "global" || value === "country" || value === "plan") {
    return value;
  }
  throw new Error("scope is invalid");
}
