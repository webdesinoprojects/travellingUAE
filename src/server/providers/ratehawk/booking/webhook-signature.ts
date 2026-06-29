/**
 * ETG booking-status webhook signature verification - PURE.
 *
 * Dependency-free (only `node:crypto`) so it can be unit tested directly with
 * `node --test`. NO route is wired in this slice; the webhook route itself is
 * `ratewhawk/04-prompt-webhook-status.md`. This module only provides the
 * verified primitives a future route must call BEFORE any DB mutation.
 *
 * Verified scheme (dev/ratehawk-booking-doc-verification.md): concatenate the
 * `timestamp` and `token` values, HMAC them with SHA-256 using the API Key token
 * as the key, hex-digest the result, and compare to the provided `signature`
 * with a timing-safe comparison. Exact field locations of timestamp/token in the
 * production payload must be confirmed verbatim at certification.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Default freshness window for the webhook timestamp (seconds). */
export const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;

/**
 * Non-secret idempotency fingerprint for a webhook delivery.
 *
 * = sha256(`${timestamp}:${token}`) as hex. The raw token is a secret-equivalent
 * nonce and must never be persisted; this one-way hash is safe to store and
 * unique per delivery, so it doubles as the dedupe key.
 */
export function computeWebhookDedupeKey(timestamp: string, token: string): string {
  return createHash("sha256").update(`${timestamp}:${token}`).digest("hex");
}

/**
 * Compute the expected hex signature for a webhook callback.
 * key = API Key token; message = timestamp + token; SHA-256; hexdigest.
 */
export function computeEtgSignature(
  timestamp: string,
  token: string,
  apiKey: string,
): string {
  return createHmac("sha256", apiKey)
    .update(`${timestamp}${token}`)
    .digest("hex");
}

/**
 * Timing-safe verification of a webhook signature. Returns false (never throws)
 * on any malformed input or mismatch.
 */
export function verifyEtgWebhookSignature(input: {
  timestamp: string;
  token: string;
  signature: string;
  apiKey: string;
}): boolean {
  const { timestamp, token, signature, apiKey } = input;

  if (
    typeof timestamp !== "string" ||
    typeof token !== "string" ||
    typeof signature !== "string" ||
    typeof apiKey !== "string" ||
    timestamp === "" ||
    token === "" ||
    signature === "" ||
    apiKey === ""
  ) {
    return false;
  }

  const expected = computeEtgSignature(timestamp, token, apiKey);

  // Hex strings of differing length cannot match; bail before timingSafeEqual
  // (which throws on unequal buffer lengths).
  if (expected.length !== signature.length) {
    return false;
  }

  try {
    return timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(signature, "utf8"),
    );
  } catch {
    return false;
  }
}

/**
 * Reject stale/replayed callbacks: the timestamp must be within +/- tolerance of
 * now. Replay dedupe beyond freshness is enforced by the durable store keyed on
 * the webhook token at the route layer (prompt 04).
 */
export function isWebhookTimestampFresh(
  timestampSeconds: number,
  nowSeconds: number,
  toleranceSeconds: number = DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
): boolean {
  if (
    !Number.isFinite(timestampSeconds) ||
    !Number.isFinite(nowSeconds) ||
    !Number.isFinite(toleranceSeconds) ||
    toleranceSeconds < 0
  ) {
    return false;
  }

  return Math.abs(nowSeconds - timestampSeconds) <= toleranceSeconds;
}
