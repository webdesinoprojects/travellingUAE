/**
 * Shared atomic terminal-state reconciliation.
 *
 * Both the status poller (booking/finish/status -> `ok`) and the
 * signed status webhook (`completed`/`failed`) converge HERE. There is exactly
 * one confirmation transition and one failure transition in the codebase, so the
 * two redundant channels can never disagree about how a booking becomes terminal.
 *
 * Pure orchestration over the injected BookingRepository: no IO of its own, no
 * server-only import, no @/ alias - unit-testable with a mock repo.
 *
 * Resurrection guard: a booking already in a terminal state (confirmed / failed /
 * cancelled) is never transitioned again. A late webhook for an order that was
 * already cancelled or confirmed is a no-op.
 */

import { TERMINAL_BOOKING_STATES } from "./contracts.ts";
import type { BookingContext, BookingRepository } from "./orchestrator.ts";

/** Delay before the first post-confirmation order/info reconciliation poll. */
export const POST_CONFIRM_ORDER_INFO_DELAY_MS = 60_000;

export type ReconcileSource = "booking_status" | "webhook";

export type ReconcileResult =
  | { kind: "applied"; toState: "confirmed" | "failed" }
  | { kind: "noop"; reason: "already_terminal" | "lock_lost" };

/**
 * Atomically confirm a booking. Used by polling success AND signed webhook
 * success. Returns `applied` only if this call performed the transition.
 */
export async function reconcileToConfirmed(input: {
  repo: BookingRepository;
  ctx: BookingContext;
  jobId: string | null;
  source: ReconcileSource;
  httpStatus: number | null;
  rawCode: string | null;
  nowMs?: number;
}): Promise<ReconcileResult> {
  const { repo, ctx, jobId, source, httpStatus, rawCode } = input;
  const nowMs = input.nowMs ?? Date.now();

  if (ctx.providerOrderStatus && TERMINAL_BOOKING_STATES.has(ctx.providerOrderStatus)) {
    return { kind: "noop", reason: "already_terminal" };
  }

  const ok = await repo.transitionState({
    bookingId: ctx.bookingId,
    toState: "confirmed",
    expectedVersion: ctx.providerStatusVersion,
    patch: { providerConfirmedAt: new Date(nowMs).toISOString() },
  });

  if (!ok) {
    return { kind: "noop", reason: "lock_lost" };
  }

  await repo.appendEvent({
    bookingId: ctx.bookingId,
    jobId,
    step: source,
    outcome: "ok",
    providerResultCode: rawCode,
    httpStatus,
    fromState: ctx.providerOrderStatus,
    toState: "confirmed",
    attempt: null,
    note: null,
  });

  // Schedule delayed post-confirmation reconciliation (HCN/voucher may lag).
  // Deduped per booking so polling + webhook confirmation enqueue it at most once.
  await repo.enqueueJob({
    bookingId: ctx.bookingId,
    jobType: "sync_order_info",
    dedupeKey: `sync_order_info:${ctx.bookingId}:post_confirm`,
    runAfterMs: POST_CONFIRM_ORDER_INFO_DELAY_MS,
    maxAttempts: 6,
    partnerOrderId: ctx.providerPartnerOrderId,
    payload: { trigger: "post_confirm" },
  });

  return { kind: "applied", toState: "confirmed" };
}

/**
 * Atomically fail a booking. Used by the signed webhook failure path. Never
 * resurrects a confirmed/cancelled record.
 */
export async function reconcileToFailed(input: {
  repo: BookingRepository;
  ctx: BookingContext;
  jobId: string | null;
  source: ReconcileSource;
  httpStatus: number | null;
  rawCode: string | null;
}): Promise<ReconcileResult> {
  const { repo, ctx, jobId, source, httpStatus, rawCode } = input;

  if (ctx.providerOrderStatus && TERMINAL_BOOKING_STATES.has(ctx.providerOrderStatus)) {
    return { kind: "noop", reason: "already_terminal" };
  }

  const ok = await repo.transitionState({
    bookingId: ctx.bookingId,
    toState: "failed",
    expectedVersion: ctx.providerStatusVersion,
    patch: { providerResultCode: rawCode },
  });

  if (!ok) {
    return { kind: "noop", reason: "lock_lost" };
  }

  await repo.appendEvent({
    bookingId: ctx.bookingId,
    jobId,
    step: source,
    outcome: "terminal",
    providerResultCode: rawCode,
    httpStatus,
    fromState: ctx.providerOrderStatus,
    toState: "failed",
    attempt: null,
    note: null,
  });

  return { kind: "applied", toState: "failed" };
}
