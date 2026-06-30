import type { BookingClassification } from "../providers/ratehawk/booking/contracts.ts";

export type StandaloneHotelBookingStatus =
  | "form_created"
  | "unsupported_payment"
  | "payment_pending"
  | "finish_started"
  | "processing"
  | "confirmed"
  | "failed"
  | "pending_review"
  | "expired";

export const DEFAULT_STANDALONE_CONFIRMATION_WINDOW_SECONDS = 180;
export const STANDALONE_STRIPE_CLAIM_STALE_MS = 2 * 60 * 1000;

export type StandaloneStripeClaimDecision =
  | { kind: "claim" }
  | { kind: "return_existing"; url: string }
  | { kind: "wait" }
  | { kind: "reject" };

export function decideStandaloneStripeCheckoutClaim(input: {
  status: StandaloneHotelBookingStatus;
  stripeCheckoutUrl: string | null;
  stripeCheckoutClaimedAt: string | null;
  nowMs: number;
  staleAfterMs?: number;
}): StandaloneStripeClaimDecision {
  if (input.status === "form_created") {
    return { kind: "claim" };
  }

  if (input.status !== "payment_pending") {
    return { kind: "reject" };
  }

  if (input.stripeCheckoutUrl) {
    return { kind: "return_existing", url: input.stripeCheckoutUrl };
  }

  const claimedAt = input.stripeCheckoutClaimedAt
    ? new Date(input.stripeCheckoutClaimedAt).getTime()
    : 0;
  const staleAfterMs = input.staleAfterMs ?? STANDALONE_STRIPE_CLAIM_STALE_MS;

  if (!claimedAt || input.nowMs - claimedAt >= staleAfterMs) {
    return { kind: "claim" };
  }

  return { kind: "wait" };
}

export function isStandaloneStatusPollEligible(
  status: StandaloneHotelBookingStatus,
): boolean {
  return status === "finish_started" || status === "processing";
}

export function getStandaloneBookingCutoffAt(input: {
  bookingCutoffAt: string | null;
  finishStartedAt: string | null;
  confirmationWindowMs: number;
}): string | null {
  if (input.bookingCutoffAt) {
    return input.bookingCutoffAt;
  }

  if (!input.finishStartedAt) {
    return null;
  }

  const started = new Date(input.finishStartedAt).getTime();
  if (!Number.isFinite(started)) {
    return null;
  }

  return new Date(started + input.confirmationWindowMs).toISOString();
}

export function isStandaloneBookingCutoffReached(input: {
  bookingCutoffAt: string | null;
  finishStartedAt: string | null;
  confirmationWindowMs: number;
  nowMs: number;
}): boolean {
  const cutoff = getStandaloneBookingCutoffAt(input);
  if (!cutoff) {
    return false;
  }

  const cutoffMs = new Date(cutoff).getTime();
  return Number.isFinite(cutoffMs) && input.nowMs >= cutoffMs;
}

export function nextStandaloneStatusAfterFinishException(): StandaloneHotelBookingStatus {
  return "processing";
}

export function nextStandaloneStatusFromStatusClassification(
  classification: BookingClassification,
): StandaloneHotelBookingStatus {
  switch (classification.kind) {
    case "success":
      return "confirmed";
    case "poll":
    case "unknown":
      return "processing";
    case "requires_3ds":
      return "pending_review";
    case "failed":
      return "failed";
    default:
      return "pending_review";
  }
}
