import "server-only";

import { randomUUID } from "node:crypto";

import { isProviderBookingEnabled } from "./transport.ts";
import {
  executeCreateBooking,
  executeStartBooking,
  executePollStatus,
  type BookingJob,
  type OrchestratorTransport,
} from "./orchestrator.ts";
import {
  executeCancelBooking,
  executeOrderInfoSync,
  type PostBookingRepository,
} from "./post-booking.ts";
import {
  claimAndGetJob,
  incrementJobAttempts,
  markJobSucceeded,
  markJobFailed,
  markJobDead,
  requeueJob,
  createSupabasePostBookingRepository,
} from "./booking-dal.ts";
import { createRealBookingTransport } from "./raw-transport.ts";
import { STATUS_POLL_INTERVAL_MS } from "./contracts.ts";

/**
 * Process one booking job from the outbox by ID.
 *
 * Called by a background trigger (edge function, cron, or admin route) that
 * already knows which job to run - never inside a browser request or Stripe
 * webhook.
 *
 * Accepts injectable transport and repository for testing; defaults to the
 * real ETG transport and Supabase repository in production.
 *
 * Returns false if the job was not claimed (already leased or not queued).
 */
export async function processBookingJob(input: {
  jobId: string;
  workerId?: string;
  transport?: OrchestratorTransport;
  repo?: PostBookingRepository;
}): Promise<boolean> {
  if (!isProviderBookingEnabled()) {
    return false;
  }

  const workerId = input.workerId ?? randomUUID();
  const transport = input.transport ?? createRealBookingTransport();
  const repo = input.repo ?? createSupabasePostBookingRepository();

  const row = await claimAndGetJob(input.jobId, workerId);
  if (!row) return false;

  await incrementJobAttempts(row.id);

  const job: BookingJob = {
    id: row.id,
    bookingId: row.booking_id,
    jobType: row.job_type as BookingJob["jobType"],
    status: row.status as BookingJob["status"],
    attempts: row.attempts + 1,
    maxAttempts: row.max_attempts,
    partnerOrderId: row.partner_order_id,
    payload: row.payload,
  };

  if (job.attempts > job.maxAttempts) {
    await markJobDead(job.id, "max_attempts_exceeded");
    return true;
  }

  try {
    let outcome: Awaited<ReturnType<typeof executeCreateBooking>>;

    switch (job.jobType) {
      case "create_booking":
        outcome = await executeCreateBooking({ job, transport, repo });
        break;
      case "start_booking":
        outcome = await executeStartBooking({ job, transport, repo });
        break;
      case "poll_status":
        outcome = await executePollStatus({ job, transport, repo });
        break;
      case "cancel_booking":
        outcome = await executeCancelBooking({ job, transport, repo });
        break;
      case "sync_order_info":
        outcome = await executeOrderInfoSync({ job, transport, repo });
        break;
      default:
        await markJobFailed(job.id, "unsupported_job_type");
        return true;
    }

    switch (outcome.kind) {
      case "succeeded":
        await markJobSucceeded(job.id);
        break;
      case "requeue":
        await requeueJob(job.id, outcome.runAfterMs, outcome.errorCode);
        break;
      case "terminal":
        await markJobFailed(job.id, outcome.errorCode);
        break;
    }
  } catch (err) {
    const code = err instanceof Error ? err.message.slice(0, 64) : "unknown_error";
    if (job.attempts >= job.maxAttempts) {
      await markJobDead(job.id, code);
    } else {
      await requeueJob(job.id, STATUS_POLL_INTERVAL_MS * 2, code);
    }
  }

  return true;
}
