import type { NextRequest } from "next/server";

import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { fulfillPaidEsimOrderWithAirhub } from "@/server/providers/airhub/orders";
import { verifyAdminApiAccess } from "@/server/supabase/auth";
import { hasSupabaseAdminEnv } from "@/server/supabase/client";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Admin-only manual test fulfillment trigger.
 *
 * This route is safe to call even when disabled: fulfillPaidEsimOrderWithAirhub
 * applies the PurchaseSim guard internally and returns { kind: "blocked" }
 * without any provider call unless AIRHUB_PURCHASE_ENABLED is true AND the plan
 * is the configured test plan. Only sanitized outcome kind/reason are returned.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const access = await verifyAdminApiAccess(request, "admin");
    if (!access.ok) {
      return jsonError(access.status, "You are not allowed to access this area.");
    }

    const { id } = await context.params;
    if (!UUID_RE.test(id)) {
      return jsonError(400, "Invalid order id.");
    }
    if (!hasSupabaseAdminEnv()) {
      return jsonError(503, "Database is not configured.");
    }

    const outcome = await fulfillPaidEsimOrderWithAirhub(id);
    return jsonOk({
      status: outcome.kind,
      outcome: outcome.kind,
      blockedReason: outcome.kind === "blocked" ? outcome.reason : null,
      reason: "reason" in outcome ? outcome.reason : null,
    });
  } catch (error) {
    logServerError("api.admin.esim.orders.fulfill", error);
    return jsonError(500);
  }
}
