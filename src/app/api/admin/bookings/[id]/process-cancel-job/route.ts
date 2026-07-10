import type { NextRequest } from "next/server";

import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { verifyAdminApiAccess } from "@/server/supabase/auth";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/server/supabase/client";
import { writeAdminAuditLog } from "@/server/admin/audit";
import { processBookingJob } from "@/server/providers/ratehawk/booking/job-worker";
import { mapProcessedCancellationResult } from "@/server/providers/ratehawk/booking/cancellation-guards";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type BookingStateRow = {
  provider_order_status: string | null;
  provider_result_code: string | null;
};

type CancelJobRow = {
  id: string;
  status: string;
};

/**
 * POST: process the pending hotel cancel job for a booking immediately.
 *
 * The cancel route (`cancel-hotel`) only enqueues a durable `cancel_booking`
 * job; no cron/worker runs it automatically. This admin-only action runs that
 * job now by reusing the existing worker (`processBookingJob`), so an admin can
 * cancel a confirmed test booking and see the result without waiting.
 *
 * Idempotent + double-cancel-safe: `processBookingJob` leases the job via
 * `claimAndGetJob` (only claims a queued/expired job) and `executeCancelBooking`
 * treats an already-cancelled booking as a no-op — so clicking twice never sends
 * a second ETG cancel. Provider timeout/error is handled by the worker's own
 * state machine (stays cancel_pending on a bounded retry, or moves to
 * pending_review), and this route only reports the resulting state.
 *
 * When provider booking is disabled, `processBookingJob` is a no-op and this
 * route simply reports the current (unchanged) state — no provider call is made.
 * Never logs card data, 3DS fields, hashes, or raw provider payloads.
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

    const supabase = getSupabaseAdminClient();

    const before = await loadBookingState(id);
    if (!before) return jsonError(404, "Booking not found.");

    // Find the most recent cancel job for this booking (created by the atomic
    // request_provider_cancellation RPC). No job => nothing to process.
    const jobResult = await supabase
      .from("provider_booking_jobs")
      .select("id,status")
      .eq("booking_id", id)
      .eq("job_type", "cancel_booking")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (jobResult.error) throw jobResult.error;

    const job = (jobResult.data as CancelJobRow | null) ?? null;

    let processed = false;
    if (job) {
      // Reuse the existing worker. It claims the job atomically (lease), so a
      // concurrent/duplicate call cannot double-run it.
      processed = await processBookingJob({ jobId: job.id });
    }

    const after = (await loadBookingState(id)) ?? before;
    const outcome = mapProcessedCancellationResult(after.provider_order_status);

    if (processed && before.provider_order_status !== after.provider_order_status) {
      await writeAdminAuditLog({
        actor: access.actor,
        action: "bookings.process_cancel_job",
        table: "bookings",
        entityId: id,
        before: { provider_order_status: before.provider_order_status },
        after: { provider_order_status: after.provider_order_status },
      });
    }

    return jsonOk({
      processed,
      adminState: outcome.adminState,
      message: outcome.message,
      providerState: safeProviderState(after.provider_order_status),
    });
  } catch (error) {
    logServerError("api.admin.bookings.process-cancel-job", error);
    return jsonError(500);
  }
}

async function loadBookingState(id: string): Promise<BookingStateRow | null> {
  const supabase = getSupabaseAdminClient();
  const result = await supabase
    .from("bookings")
    .select("provider_order_status,provider_result_code")
    .eq("id", id)
    .maybeSingle();
  if (result.error) throw result.error;
  return (result.data as BookingStateRow | null) ?? null;
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
