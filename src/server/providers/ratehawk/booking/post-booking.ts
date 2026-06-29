/**
 * Post-booking orchestration - cancellation + order-info reconciliation.
 *
 * Pure state-machine steps over the injected transport + repository, mirroring
 * the create/start/poll steps in orchestrator.ts. No server-only import, no @/
 * alias, no direct IO: unit-testable with mocks, never reaches ETG in tests.
 *
 * Key rules (prompt 05):
 *   - order/info is reconciliation ONLY; it never changes booking state and is
 *     never used to decide confirmation.
 *   - Cancellation is an atomic confirmed -> cancel_pending -> cancelled |
 *     pending_review transition. A duplicate concurrent cancel loses the
 *     optimistic lock and is a no-op.
 *   - On ETG cancel timeout, retry EXACTLY once (bounded by the job's
 *     max_attempts); an still-ambiguous outcome goes to pending_review and is
 *     reconciled via order/info, never retried indefinitely.
 *   - A refund is NEVER auto-issued here; a successful cancel only routes the
 *     refund state machine to 'review' for human approval.
 */

import {
  BOOKING_ENDPOINTS,
  classifyCancel,
  classifyOrderInfo,
  buildCancelRequest,
  buildOrderInfoRequest,
} from "./contracts.ts";
import type {
  BookingJob,
  BookingRepository,
  OrchestratorTransport,
  OrchestratorTransportResult,
  StepOutcome,
} from "./orchestrator.ts";

/** Repository superset adding the post-booking persistence the steps need. */
export interface PostBookingRepository extends BookingRepository {
  storeOrderInfo(input: {
    bookingId: string;
    hotelConfirmationNumber: string | null;
    penaltyAmount: number | null;
    penaltyCurrency: string | null;
  }): Promise<void>;
  /** Move the SEPARATE refund state machine. Never issues money. */
  setRefundState(bookingId: string, state: "review"): Promise<void>;
}

const CANCEL_RETRY_DELAY_MS = 5_000;
const ORDER_INFO_RETRY_DELAY_MS = 60_000;

// ---- Cancellation ----------------------------------------------------------

export async function executeCancelBooking(input: {
  job: BookingJob;
  transport: OrchestratorTransport;
  repo: PostBookingRepository;
  nowMs?: number;
}): Promise<StepOutcome> {
  const { job, transport, repo } = input;
  const nowMs = input.nowMs ?? Date.now();

  const ctx = await repo.getBookingContext(job.bookingId);
  if (!ctx) return { kind: "terminal", errorCode: "booking_not_found" };

  // Idempotent: already cancelled.
  if (ctx.providerOrderStatus === "cancelled") return { kind: "succeeded" };

  // Only a confirmed or in-flight cancel may be cancelled.
  if (ctx.providerOrderStatus !== "confirmed" && ctx.providerOrderStatus !== "cancel_pending") {
    return { kind: "terminal", errorCode: "not_cancellable" };
  }

  let version = ctx.providerStatusVersion;

  // Ensure we are in cancel_pending (atomic; duplicate concurrent cancel loses).
  if (ctx.providerOrderStatus === "confirmed") {
    const locked = await repo.transitionState({
      bookingId: ctx.bookingId,
      toState: "cancel_pending",
      expectedVersion: version,
      patch: {},
    });
    if (!locked) {
      return { kind: "requeue", runAfterMs: CANCEL_RETRY_DELAY_MS, errorCode: null };
    }
    version += 1;
  }

  const partnerOrderId = job.partnerOrderId ?? ctx.providerPartnerOrderId;
  if (!partnerOrderId) {
    await repo.transitionState({
      bookingId: ctx.bookingId,
      toState: "pending_review",
      expectedVersion: version,
      patch: { providerResultCode: "missing_partner_order_id" },
    });
    return { kind: "terminal", errorCode: "missing_partner_order_id" };
  }

  const body = buildCancelRequest(partnerOrderId);

  let signal: OrchestratorTransportResult;
  try {
    signal = await transport.call("cancel", BOOKING_ENDPOINTS.orderCancel, body);
  } catch {
    signal = { httpStatus: null, status: null, error: "transport_error", data: null };
  }

  const classification = classifyCancel(signal);

  if (classification.kind === "success") {
    await repo.transitionState({
      bookingId: ctx.bookingId,
      toState: "cancelled",
      expectedVersion: version,
      patch: { providerCancelledAt: new Date(nowMs).toISOString() },
    });
    await repo.appendEvent({
      bookingId: ctx.bookingId,
      jobId: job.id,
      step: "cancel",
      outcome: "ok",
      providerResultCode: null,
      httpStatus: signal.httpStatus,
      fromState: "cancel_pending",
      toState: "cancelled",
      attempt: job.attempts,
      note: null,
    });
    // Refund is a SEPARATE machine: route to human review, never auto-refund.
    await repo.setRefundState(ctx.bookingId, "review");
    // Final reconciliation of penalty/HCN via order info (bounded).
    await repo.enqueueJob({
      bookingId: ctx.bookingId,
      jobType: "sync_order_info",
      dedupeKey: `sync_order_info:${ctx.bookingId}:post_cancel`,
      runAfterMs: 0,
      maxAttempts: 6,
      partnerOrderId,
      payload: { trigger: "post_cancel" },
    });
    return { kind: "succeeded" };
  }

  if (classification.kind === "retry") {
    // Retry EXACTLY once: bounded by the job's max_attempts (set to 2 at enqueue).
    if (job.attempts < job.maxAttempts) {
      await repo.appendEvent({
        bookingId: ctx.bookingId,
        jobId: job.id,
        step: "cancel",
        outcome: "retry",
        providerResultCode: signal.error,
        httpStatus: signal.httpStatus,
        fromState: "cancel_pending",
        toState: "cancel_pending",
        attempt: job.attempts,
        note: "one cancel retry",
      });
      return { kind: "requeue", runAfterMs: CANCEL_RETRY_DELAY_MS, errorCode: signal.error };
    }

    // Retry exhausted and still ambiguous: hand to human + reconcile via order info.
    await repo.transitionState({
      bookingId: ctx.bookingId,
      toState: "pending_review",
      expectedVersion: version,
      patch: { providerResultCode: "cancel_timeout_unresolved" },
    });
    await repo.appendEvent({
      bookingId: ctx.bookingId,
      jobId: job.id,
      step: "cancel",
      outcome: "terminal",
      providerResultCode: "cancel_timeout_unresolved",
      httpStatus: signal.httpStatus,
      fromState: "cancel_pending",
      toState: "pending_review",
      attempt: job.attempts,
      note: "cancel ambiguous after one retry",
    });
    await repo.enqueueJob({
      bookingId: ctx.bookingId,
      jobType: "sync_order_info",
      dedupeKey: `sync_order_info:${ctx.bookingId}:cancel_reconcile`,
      runAfterMs: 0,
      maxAttempts: 6,
      partnerOrderId,
      payload: { trigger: "cancel_reconcile" },
    });
    return { kind: "terminal", errorCode: "cancel_timeout_unresolved" };
  }

  // failed or unknown: a cancel that errors needs a human, not an auto-fail.
  await repo.transitionState({
    bookingId: ctx.bookingId,
    toState: "pending_review",
    expectedVersion: version,
    patch: {
      providerResultCode:
        classification.kind === "failed" ? (classification.code ?? null) : "cancel_unknown",
    },
  });
  await repo.appendEvent({
    bookingId: ctx.bookingId,
    jobId: job.id,
    step: "cancel",
    outcome: classification.kind === "failed" ? "terminal" : "unknown",
    providerResultCode:
      classification.kind === "failed" ? (classification.code ?? null) : "cancel_unknown",
    httpStatus: signal.httpStatus,
    fromState: "cancel_pending",
    toState: "pending_review",
    attempt: job.attempts,
    note: null,
  });
  return {
    kind: "terminal",
    errorCode: classification.kind === "failed" ? (classification.code ?? null) : "cancel_unknown",
  };
}

// ---- Order info reconciliation ---------------------------------------------

export type OrderInfoDetails = {
  /** Hotel internal order confirmation (HCN). Null when not yet synced by ETG. */
  hotelConfirmationNumber: string | null;
  /** Cancellation penalty. Null = UNKNOWN (never assumed); only set when present. */
  penaltyAmount: number | null;
  penaltyCurrency: string | null;
  /**
   * True only when the documented HCN field is present. When false, the order is
   * not fully synced and must be reconciled (ETG HCN can arrive with a delay) -
   * the caller must NOT treat this as a completed sync.
   */
  complete: boolean;
};

/**
 * Extract ONLY documented order-info fields. We never guess HCN from speculative
 * keys, and we never invent a penalty: a missing/undocumented value stays null
 * (UNKNOWN) and requires reconciliation. NO guest PII, documents, or raw payload
 * are extracted.
 *
 * Documented retrieve-bookings shape (verify verbatim at certification):
 *   data.orders[].hotel_data.order_id            -> hotel internal confirmation (HCN)
 *   data.orders[].cancellation_info.policies[]   -> { amount_charge, currency_code, ... }
 *   data.orders[].cancellation_info.free_cancellation_before
 * The penalty is a WINDOWED policy array, not a single field; we deliberately do
 * NOT collapse it into one number here (that would be a guess). Penalty stays
 * null (unknown) and the refund flow routes to manual review.
 */
export function extractOrderInfoDetails(data: unknown): OrderInfoDetails {
  const result: OrderInfoDetails = {
    hotelConfirmationNumber: null,
    penaltyAmount: null,
    penaltyCurrency: null,
    complete: false,
  };
  if (!data || typeof data !== "object") return result;

  const root = data as Record<string, unknown>;
  const orders = Array.isArray(root.orders) ? root.orders : null;
  // Only read the documented `data.orders[]` envelope; no fallback to `root`.
  if (!orders || orders.length === 0) return result;
  const order = orders[0];
  if (!order || typeof order !== "object") return result;
  const orderRec = order as Record<string, unknown>;

  // HCN: documented `hotel_data.order_id` only (single documented path).
  const hotelData =
    orderRec.hotel_data && typeof orderRec.hotel_data === "object"
      ? (orderRec.hotel_data as Record<string, unknown>)
      : null;
  const hcn = hotelData?.order_id;
  if (typeof hcn === "string" && hcn.trim() !== "") {
    result.hotelConfirmationNumber = hcn.trim().slice(0, 128);
    result.complete = true;
  } else if (typeof hcn === "number" && Number.isFinite(hcn)) {
    result.hotelConfirmationNumber = String(hcn);
    result.complete = true;
  }

  return result;
}

export async function executeOrderInfoSync(input: {
  job: BookingJob;
  transport: OrchestratorTransport;
  repo: PostBookingRepository;
}): Promise<StepOutcome> {
  const { job, transport, repo } = input;

  const ctx = await repo.getBookingContext(job.bookingId);
  if (!ctx) return { kind: "terminal", errorCode: "booking_not_found" };

  const partnerOrderId = job.partnerOrderId ?? ctx.providerPartnerOrderId;
  if (!partnerOrderId) return { kind: "terminal", errorCode: "missing_partner_order_id" };

  const body = buildOrderInfoRequest(partnerOrderId);

  let signal: OrchestratorTransportResult;
  try {
    signal = await transport.call("order_info", BOOKING_ENDPOINTS.orderInfo, body);
  } catch {
    signal = { httpStatus: null, status: null, error: "transport_error", data: null };
  }

  const classification = classifyOrderInfo(signal);

  if (classification.kind === "success") {
    const details = extractOrderInfoDetails(signal.data);
    // Persist whatever documented fields we actually resolved (HCN if present).
    // Penalty stays null (unknown) unless documented - never assumed.
    await repo.storeOrderInfo({
      bookingId: ctx.bookingId,
      hotelConfirmationNumber: details.hotelConfirmationNumber,
      penaltyAmount: details.penaltyAmount,
      penaltyCurrency: details.penaltyCurrency,
    });

    // The HTTP call succeeded but the HCN may not be synced yet (ETG delivers it
    // with a delay). Do NOT fake completion: reconcile via a bounded retry until
    // the documented HCN appears, then stop.
    if (!details.complete && job.attempts < job.maxAttempts) {
      await repo.appendEvent({
        bookingId: ctx.bookingId,
        jobId: job.id,
        step: "order_info",
        outcome: "poll",
        providerResultCode: "hcn_pending",
        httpStatus: signal.httpStatus,
        fromState: ctx.providerOrderStatus,
        toState: ctx.providerOrderStatus,
        attempt: job.attempts,
        note: "order info synced but HCN not yet available; reconciling",
      });
      return { kind: "requeue", runAfterMs: ORDER_INFO_RETRY_DELAY_MS, errorCode: "hcn_pending" };
    }

    await repo.appendEvent({
      bookingId: ctx.bookingId,
      jobId: job.id,
      step: "order_info",
      outcome: details.complete ? "ok" : "terminal",
      // order_info never changes booking state.
      providerResultCode: details.complete ? null : "hcn_unavailable_manual_review",
      httpStatus: signal.httpStatus,
      fromState: ctx.providerOrderStatus,
      toState: ctx.providerOrderStatus,
      attempt: job.attempts,
      note: details.complete ? null : "HCN unavailable after bounded retries; manual reconciliation",
    });
    return details.complete
      ? { kind: "succeeded" }
      : { kind: "terminal", errorCode: "order_info_hcn_unavailable" };
  }

  if (classification.kind === "poll") {
    // Bounded: data may be delayed, but never loop forever.
    if (job.attempts < job.maxAttempts) {
      return { kind: "requeue", runAfterMs: ORDER_INFO_RETRY_DELAY_MS, errorCode: signal.error };
    }
    await repo.appendEvent({
      bookingId: ctx.bookingId,
      jobId: job.id,
      step: "order_info",
      outcome: "terminal",
      providerResultCode: "order_info_unavailable",
      httpStatus: signal.httpStatus,
      fromState: ctx.providerOrderStatus,
      toState: ctx.providerOrderStatus,
      attempt: job.attempts,
      note: "order info unavailable after bounded retries",
    });
    return { kind: "terminal", errorCode: "order_info_unavailable" };
  }

  // failed or unknown: stop. Booking state is untouched (reconciliation only).
  await repo.appendEvent({
    bookingId: ctx.bookingId,
    jobId: job.id,
    step: "order_info",
    outcome: classification.kind === "failed" ? "terminal" : "unknown",
    providerResultCode: classification.kind === "failed" ? (classification.code ?? null) : null,
    httpStatus: signal.httpStatus,
    fromState: ctx.providerOrderStatus,
    toState: ctx.providerOrderStatus,
    attempt: job.attempts,
    note: null,
  });
  return {
    kind: "terminal",
    errorCode: classification.kind === "failed" ? (classification.code ?? null) : "order_info_unknown",
  };
}
