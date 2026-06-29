import type { NextRequest } from "next/server";

import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { verifyAdminApiAccess } from "@/server/supabase/auth";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/server/supabase/client";
import { writeAdminAuditLog } from "@/server/admin/audit";
import {
  evaluateCancellationRequest,
  mapCancellationOutcome,
} from "@/server/providers/ratehawk/booking/cancellation-guards";
import { evaluateRefundEligibility } from "@/server/providers/ratehawk/booking/refund-policy";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CANCEL_COLUMNS = `id,
  provider_order_status,
  provider_status_version,
  provider_partner_order_id,
  provider_cancel_penalty_amount,
  provider_cancel_penalty_currency,
  payment_status,
  paid_amount,
  paid_currency`;

type CancelRow = {
  id: string;
  provider_order_status: string | null;
  provider_status_version: number | null;
  provider_partner_order_id: string | null;
  provider_cancel_penalty_amount: number | null;
  provider_cancel_penalty_currency: string | null;
  payment_status: string | null;
  paid_amount: number | null;
  paid_currency: string | null;
};

/**
 * GET: cancellation preview. Shows the provider state, known penalty, and the
 * advisory refund recommendation BEFORE an admin confirms. Exposes no provider
 * order IDs, hotel confirmation numbers, hashes, or raw payloads.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const access = await verifyAdminApiAccess(request, "admin");
    if (!access.ok) return jsonError(access.status, "You are not allowed to access this area.");
    if (!UUID_RE.test(id)) return jsonError(400, "Invalid booking ID.");
    if (!hasSupabaseAdminEnv()) return jsonError(503, "Database is not configured.");

    const row = await loadCancelRow(id);
    if (!row) return jsonError(404, "Booking not found.");

    const decision = evaluateCancellationRequest({
      providerOrderStatus: row.provider_order_status,
      bookingCustomerEmail: null,
      requester: { kind: "admin" },
    });

    const refund = evaluateRefundEligibility({
      paymentStatus: row.payment_status,
      paidAmount: row.paid_amount,
      paidCurrency: row.paid_currency,
      cancellationPenaltyAmount: row.provider_cancel_penalty_amount,
      cancellationPenaltyCurrency: row.provider_cancel_penalty_currency,
      providerOrderStatus: "cancelled", // preview the post-cancel refund position
    });

    return jsonOk({
      cancellable: decision.allowed,
      reason: decision.allowed ? null : decision.code,
      providerState: safeProviderState(row.provider_order_status),
      penalty: {
        amount: row.provider_cancel_penalty_amount,
        currency: row.provider_cancel_penalty_currency,
        known: row.provider_cancel_penalty_amount != null,
      },
      // The free-cancellation deadline/policy was shown at checkout (HP-4A) from
      // the prebook snapshot; penalty here reflects any later order/info sync.
      refundPreview: {
        action: refund.action,
        reason: refund.reason,
        suggestedAmount: refund.suggestedAmount,
        currency: refund.currency,
        note: "Refunds require manual approval; ETG cancellation never auto-refunds.",
      },
    });
  } catch (error) {
    logServerError("api.admin.bookings.cancel-hotel.preview", error);
    return jsonError(500);
  }
}

/**
 * POST: execute the cancellation. Atomic confirmed -> cancel_pending with an
 * optimistic lock (rejects duplicate concurrent cancels), then enqueues the
 * durable cancel_booking job. The actual ETG call + single timeout retry happen
 * in the worker, never inside this request.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const access = await verifyAdminApiAccess(request, "admin");
    if (!access.ok) return jsonError(access.status, "You are not allowed to access this area.");
    if (!UUID_RE.test(id)) return jsonError(400, "Invalid booking ID.");
    if (!hasSupabaseAdminEnv()) return jsonError(503, "Database is not configured.");

    const row = await loadCancelRow(id);
    if (!row) return jsonError(404, "Booking not found.");

    const decision = evaluateCancellationRequest({
      providerOrderStatus: row.provider_order_status,
      bookingCustomerEmail: null,
      requester: { kind: "admin" },
    });
    if (!decision.allowed) {
      return jsonError(409, "This booking cannot be cancelled right now.");
    }

    const supabase = getSupabaseAdminClient();

    // Atomic: the confirmed -> cancel_pending transition AND the durable
    // cancel_booking job are created in ONE transaction inside this RPC. A
    // booking can never reach cancel_pending without its cancel job.
    const rpc = await supabase.rpc("request_provider_cancellation", {
      p_booking_id: id,
      p_partner_order_id: row.provider_partner_order_id,
    });

    if (rpc.error) throw rpc.error;

    const outcome = mapCancellationOutcome(rpc.data as string | null);

    if (outcome.httpStatus !== 200) {
      const message =
        outcome.httpStatus === 404
          ? "Booking not found."
          : "This booking cannot be cancelled right now.";
      return jsonError(outcome.httpStatus as 404 | 409 | 500, message);
    }

    await writeAdminAuditLog({
      actor: access.actor,
      action: "bookings.cancel_hotel",
      table: "bookings",
      entityId: id,
      before: { provider_order_status: row.provider_order_status },
      after: { provider_order_status: "cancel_pending" },
    });

    return jsonOk({ status: outcome.status });
  } catch (error) {
    logServerError("api.admin.bookings.cancel-hotel.execute", error);
    return jsonError(500);
  }
}

async function loadCancelRow(id: string): Promise<CancelRow | null> {
  const supabase = getSupabaseAdminClient();
  const result = await supabase
    .from("bookings")
    .select(CANCEL_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (result.error) throw result.error;
  return (result.data as CancelRow | null) ?? null;
}

/** Coarse, user-safe provider state label. Never the raw internal slug set. */
function safeProviderState(raw: string | null): string {
  switch (raw) {
    case "confirmed":
      return "confirmed";
    case "cancel_pending":
      return "cancellation_in_progress";
    case "cancelled":
      return "cancelled";
    case "pending_review":
      return "under_review";
    default:
      return "not_confirmed";
  }
}
