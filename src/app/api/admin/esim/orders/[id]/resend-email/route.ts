import type { NextRequest } from "next/server";

import { sendFulfilledEsimActivationEmail } from "@/server/esim/activation-email";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { verifyAdminApiAccess } from "@/server/supabase/auth";
import { hasSupabaseAdminEnv } from "@/server/supabase/client";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

    const result = await sendFulfilledEsimActivationEmail({
      orderId: id,
      force: true,
    });

    if (!result.ok) {
      return jsonError(502, "eSIM email could not be sent.");
    }

    return jsonOk({
      status: result.status,
      reason: "reason" in result ? result.reason : null,
    });
  } catch (error) {
    logServerError("api.admin.esim.orders.resend-email", error);
    return jsonError(500);
  }
}
