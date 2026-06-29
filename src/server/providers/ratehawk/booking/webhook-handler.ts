/**
 * Core ETG/RateHawk booking-status webhook handler.
 *
 * Official ETG payload shape:
 * {
 *   data: { partner_order_id: string, status: "completed" | "failed" },
 *   signature: { signature: string, timestamp: number | string, token: string }
 * }
 *
 * Security/order:
 * 1. Validate content-type + bounded body size at the route layer (no full buffering of huge payloads).
 * 2. Parse the official nested ETG payload.
 * 3. Verify HMAC-SHA256 over String(timestamp) + token using the correct environment API key.
 * 4. Reject malformed, stale, forged, or cross-environment callbacks (400/401).
 * 5. CLAIM a durable receipt (status=processing + lease) before applying side effects.
 * 6. Mark the receipt 'processed' ONLY after side effects are durably applied; a
 *    duplicate already-processed delivery returns 200; an unprocessed/failed
 *    receipt is re-claimed and retried; an actively-leased one returns 500 so ETG
 *    retries later (work is never swallowed). On exception the lease is released
 *    (status='failed') and 500 is returned for ETG redelivery.
 *
 * Webhook status allowlist:
 * - "completed" => booking success path
 * - "failed"    => booking failure/status-reconciliation path
 * - anything else (incl. "ok"/"confirmed") => UNKNOWN: never success. Recorded as
 *   a durable manual-review receipt (normalized_outcome='unknown') and answered
 *   200 to avoid an endless retry storm on a permanently-unknown status. (Choice:
 *   200-with-durable-manual-review over 500-retry, since an unknown spelling will
 *   not become known on redelivery; ops reconciles from the receipt ledger.)
 */

import { classifyWebhookStatus, normalizeSignal, TERMINAL_BOOKING_STATES } from "./contracts.ts";
import {
  verifyEtgWebhookSignature,
  isWebhookTimestampFresh,
  computeWebhookDedupeKey,
  DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
} from "./webhook-signature.ts";
import { reconcileToConfirmed } from "./reconcile.ts";
import type { BookingContext, BookingRepository } from "./orchestrator.ts";

/** Max accepted webhook body. ETG status callbacks are small JSON objects. */
export const MAX_WEBHOOK_BODY_BYTES = 64 * 1024;

export type WebhookOutcome = "success" | "failed" | "unknown";

export type WebhookReceipt = {
  dedupeKey: string;
  bookingId: string | null;
  partnerOrderId: string;
  rawStatus: string;
  normalizedOutcome: WebhookOutcome;
  signatureValid: boolean;
};

/**
 * Result of claiming a receipt for processing.
 * - "claimed"            => this caller owns the lease; it MUST apply side effects
 *                           then markProcessed/markFailed.
 * - "already_processed"  => a prior delivery completed side effects; safe 200.
 * - "in_progress"        => another worker holds an active lease; do NOT double
 *                           process. Caller returns 500 so ETG retries later
 *                           (the work is not swallowed).
 */
export type ReceiptClaim = "claimed" | "already_processed" | "in_progress";

/**
 * Durable receipt ledger with claim/lease idempotency. A receipt is marked
 * 'processed' ONLY after its side effects are durably applied. An unprocessed or
 * 'failed' receipt is re-claimable (retried), never swallowed.
 */
export interface WebhookEventStore {
  /** Atomically insert-or-claim the receipt for processing. DB-safe under races. */
  claimReceipt(receipt: WebhookReceipt): Promise<ReceiptClaim>;
  /** Mark the claimed receipt processed (side effects durably applied). */
  markProcessed(dedupeKey: string, httpStatus: number, bookingId: string | null): Promise<void>;
  /** Release the lease and record a sanitized failure so it can be re-claimed. */
  markFailed(dedupeKey: string, httpStatus: number, errorMessage: string): Promise<void>;
  getBookingByPartnerOrderId(partnerOrderId: string): Promise<BookingContext | null>;
}

export type WebhookHandlerDeps = {
  repo: BookingRepository;
  store: WebhookEventStore;
  /** Active-environment API key token used for HMAC verification. */
  apiKey: string;
  /** Active RateHawk env ("sandbox" | "test" | "prod"). */
  ratehawkEnv: string;
  nowSeconds?: number;
  nowMs?: number;
  toleranceSeconds?: number;
};

export type WebhookRequest = {
  contentType: string | null;
  bodyText: string;
  /** Header lookup for signature fields that ETG may send as headers. */
  getHeader: (name: string) => string | null;
};

export type WebhookHandlerResult = {
  httpStatus: 200 | 400 | 401 | 500;
  reason: string;
};

type WebhookFields = {
  /** Always a numeric string; HMAC is computed over String(timestamp) + token. */
  timestamp: string;
  token: string;
  signature: string;
  partnerOrderId: string;
  status: string;
  env: string | null;
};

/** Accept a Unix timestamp as a number OR a numeric string; normalize to string. */
function numericTimestampToString(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    return String(Math.trunc(v));
  }
  if (typeof v === "string" && /^\d+$/.test(v.trim())) {
    return v.trim();
  }
  return null;
}

/**
 * Extract the official ETG webhook fields.
 *
 * The verified production payload is nested:
 *   { data: { partner_order_id, status },
 *     signature: { signature, timestamp, token } }
 * where `timestamp` is a Unix timestamp NUMBER and `token` is a 50-char nonce.
 * The HMAC is computed over String(timestamp) + token (handled by the caller).
 *
 * We read the official locations first, with header / flat-body fallbacks so a
 * differently-shaped sandbox delivery still works. Field locations remain
 * subject to verbatim confirmation at certification.
 */
export function extractWebhookFields(
  body: Record<string, unknown>,
  getHeader: (name: string) => string | null,
): WebhookFields | null {
  const obj = (v: unknown): Record<string, unknown> =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

  const data = obj(body.data);
  const sig = obj(body.signature); // official: `signature` is an OBJECT.

  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() !== "" ? v.trim() : null;

  const partnerOrderId = str(data.partner_order_id) ?? str(body.partner_order_id);
  const status = str(data.status) ?? str(body.status);

  const signature =
    str(sig.signature) ??
    (typeof body.signature === "string" ? str(body.signature) : null) ??
    str(getHeader("x-signature"));

  const token = str(sig.token) ?? str(body.token) ?? str(getHeader("x-signature-token"));

  const timestamp =
    numericTimestampToString(sig.timestamp) ??
    numericTimestampToString(body.timestamp) ??
    numericTimestampToString(getHeader("x-signature-timestamp"));

  const env = str(body.environment) ?? str(body.env) ?? str(data.environment);

  if (!timestamp || !token || !signature || !partnerOrderId || !status) {
    return null;
  }

  return { timestamp, token, signature, partnerOrderId, status, env };
}

function normalizeEnv(value: string): string {
  const v = value.trim().toLowerCase();
  return v === "production" ? "prod" : v;
}

export async function handleEtgWebhook(
  req: WebhookRequest,
  deps: WebhookHandlerDeps,
): Promise<WebhookHandlerResult> {
  const nowSeconds = deps.nowSeconds ?? Math.floor(Date.now() / 1000);
  const tolerance = deps.toleranceSeconds ?? DEFAULT_WEBHOOK_TOLERANCE_SECONDS;

  // 1. Content type.
  if (!req.contentType || !req.contentType.toLowerCase().includes("application/json")) {
    return { httpStatus: 400, reason: "unsupported_content_type" };
  }

  // 2. Body size.
  if (Buffer.byteLength(req.bodyText, "utf8") > MAX_WEBHOOK_BODY_BYTES) {
    return { httpStatus: 400, reason: "body_too_large" };
  }

  // 3. Parse JSON.
  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(req.bodyText) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { httpStatus: 400, reason: "malformed_body" };
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return { httpStatus: 400, reason: "malformed_body" };
  }

  // 4. Required fields.
  const fields = extractWebhookFields(body, req.getHeader);
  if (!fields) {
    return { httpStatus: 400, reason: "missing_fields" };
  }

  // 5. Signature (constant-time). Forged deliveries are NOT persisted (avoids a
  //    spoofed-flood filling the ledger); they are simply rejected.
  const signatureValid = verifyEtgWebhookSignature({
    timestamp: fields.timestamp,
    token: fields.token,
    signature: fields.signature,
    apiKey: deps.apiKey,
  });
  if (!signatureValid) {
    return { httpStatus: 401, reason: "invalid_signature" };
  }

  // 6. Freshness (anti-replay window).
  const tsNumeric = Number.parseInt(fields.timestamp, 10);
  if (!isWebhookTimestampFresh(tsNumeric, nowSeconds, tolerance)) {
    return { httpStatus: 400, reason: "stale_timestamp" };
  }

  // 7. Cross-environment guard (only when ETG includes an env field).
  if (fields.env && normalizeEnv(fields.env) !== normalizeEnv(deps.ratehawkEnv)) {
    return { httpStatus: 400, reason: "cross_environment" };
  }

  // 8. Classify the status. ONLY `completed` (success) and `failed` are accepted.
  //    Everything else (incl. `ok`/`confirmed`) is `unknown` and NEVER success.
  const classification = classifyWebhookStatus(normalizeSignal({ status: fields.status }));
  const normalizedOutcome: WebhookOutcome =
    classification.kind === "success"
      ? "success"
      : classification.kind === "failed"
        ? "failed"
        : "unknown";

  const dedupeKey = computeWebhookDedupeKey(fields.timestamp, fields.token);

  // 9. Atomically claim the receipt BEFORE side effects. Idempotency is enforced
  //    by the DB: a duplicate already-processed delivery returns 200; an
  //    unprocessed/failed receipt is re-claimed; an actively-leased one yields
  //    in_progress. A persistence failure is retryable (500).
  let claim: ReceiptClaim;
  try {
    claim = await deps.store.claimReceipt({
      dedupeKey,
      bookingId: null,
      partnerOrderId: fields.partnerOrderId,
      rawStatus: fields.status.slice(0, 64),
      normalizedOutcome,
      signatureValid: true,
    });
  } catch {
    return { httpStatus: 500, reason: "receipt_persist_failed" };
  }

  if (claim === "already_processed") {
    return { httpStatus: 200, reason: "duplicate_ignored" };
  }
  if (claim === "in_progress") {
    // Another worker holds an active lease. Do NOT double-process; ask ETG to
    // retry later (by then the receipt is processed -> 200). Not swallowed.
    return { httpStatus: 500, reason: "in_progress_retry" };
  }

  // claim === "claimed": we own the lease and must finish (processed/failed).
  try {
    // 10. Unknown signed status: NEVER success. The receipt is now durably stored
    //     (normalized_outcome='unknown') for manual review; we mark it processed
    //     and return 200 so a permanently-unknown status does not trigger an
    //     endless ETG retry storm. No booking transition occurs.
    if (normalizedOutcome === "unknown") {
      console.warn(
        `[booking.webhook] signed status needs manual review: status="${fields.status.slice(0, 32)}"`,
      );
      await deps.store.markProcessed(dedupeKey, 200, null);
      return { httpStatus: 200, reason: "unknown_status_manual_review" };
    }

    // 11. Match the booking by partner_order_id.
    const ctx = await deps.store.getBookingByPartnerOrderId(fields.partnerOrderId);
    if (!ctx) {
      await deps.store.markProcessed(dedupeKey, 200, null);
      return { httpStatus: 200, reason: "no_matching_booking" };
    }

    // 12. Signed success converges through the single atomic confirm transition
    //     shared with polling. A verified `completed` webhook may confirm.
    if (normalizedOutcome === "success") {
      await reconcileToConfirmed({
        repo: deps.repo,
        ctx,
        jobId: null,
        source: "webhook",
        httpStatus: 200,
        rawCode: fields.status.slice(0, 64),
        nowMs: deps.nowMs,
      });
      await deps.store.markProcessed(dedupeKey, 200, ctx.bookingId);
      return { httpStatus: 200, reason: "confirmed" };
    }

    // 13. Signed failure: the reason comes from the Check booking process, so we
    //     enqueue a bounded poll-status reconciliation (NOT order/info). The poll
    //     resolves the authoritative terminal state through reconcile.ts. We do
    //     not transition here and never resurrect a terminal record.
    if (ctx.providerOrderStatus && TERMINAL_BOOKING_STATES.has(ctx.providerOrderStatus)) {
      await deps.store.markProcessed(dedupeKey, 200, ctx.bookingId);
      return { httpStatus: 200, reason: "failed_terminal_noop" };
    }

    await deps.repo.enqueueJob({
      bookingId: ctx.bookingId,
      jobType: "poll_status",
      dedupeKey: `poll_status:${ctx.bookingId}:webhook_failure`,
      runAfterMs: 0,
      maxAttempts: 60,
      partnerOrderId: ctx.providerPartnerOrderId,
      payload: { pollCount: 0, trigger: "webhook_failure" },
    });
    await deps.store.markProcessed(dedupeKey, 200, ctx.bookingId);
    return { httpStatus: 200, reason: "failure_status_lookup_enqueued" };
  } catch {
    // Side-effect failure AFTER claiming: release the lease + record a sanitized
    // failure so the next delivery re-claims and retries. 500 => ETG redelivers.
    try {
      await deps.store.markFailed(dedupeKey, 500, "processing_error");
    } catch {
      // best-effort; lease will also expire and be reclaimed.
    }
    return { httpStatus: 500, reason: "processing_failed" };
  }
}
