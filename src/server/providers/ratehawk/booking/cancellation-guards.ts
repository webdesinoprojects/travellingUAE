/**
 * Cancellation authorization + state guards - PURE.
 *
 * One decision function used by BOTH the authenticated admin route and any future
 * secure customer cancellation flow, so the rules cannot diverge:
 *   - State: only a CONFIRMED order may begin cancellation. cancel_pending means a
 *     cancellation is already in flight (duplicate request rejected). Terminal
 *     states are rejected.
 *   - Ownership: an admin/editor actor may cancel any booking. A customer actor
 *     may cancel ONLY their own booking, verified by a case-insensitive match of
 *     the authenticated email against the booking's customer email. A customer
 *     request with no verified email is rejected.
 */

export type CancellationRequester =
  | { kind: "admin" }
  | { kind: "customer"; verifiedEmail: string | null };

export type CancellationDecision =
  | { allowed: true }
  | {
      allowed: false;
      code:
        | "not_confirmed"
        | "already_cancelling"
        | "already_terminal"
        | "ownership_failed"
        | "no_verified_identity";
    };

export function evaluateCancellationRequest(input: {
  providerOrderStatus: string | null;
  bookingCustomerEmail: string | null;
  requester: CancellationRequester;
}): CancellationDecision {
  // Ownership first: never reveal state details to a non-owner.
  if (input.requester.kind === "customer") {
    const verified = input.requester.verifiedEmail?.trim().toLowerCase();
    if (!verified) {
      return { allowed: false, code: "no_verified_identity" };
    }
    const owner = input.bookingCustomerEmail?.trim().toLowerCase();
    if (!owner || owner !== verified) {
      return { allowed: false, code: "ownership_failed" };
    }
  }

  switch (input.providerOrderStatus) {
    case "confirmed":
      return { allowed: true };
    case "cancel_pending":
      return { allowed: false, code: "already_cancelling" };
    case "cancelled":
    case "failed":
      return { allowed: false, code: "already_terminal" };
    default:
      // pending / creating / starting / processing / requires_3ds / pending_review
      return { allowed: false, code: "not_confirmed" };
  }
}

/**
 * Map the atomic `request_provider_cancellation` RPC result to an HTTP outcome.
 * Pure so the route's decision logic is unit-testable. Only the `requested`
 * result means the booking was moved to cancel_pending AND a durable cancel job
 * was created in the same transaction.
 */
export function mapCancellationOutcome(
  rpcResult: string | null,
): { httpStatus: 200 | 404 | 409 | 500; status: string } {
  switch (rpcResult) {
    case "requested":
      return { httpStatus: 200, status: "cancellation_requested" };
    case "already_cancelling":
      return { httpStatus: 409, status: "already_cancelling" };
    case "already_terminal":
      return { httpStatus: 409, status: "already_terminal" };
    case "not_confirmed":
      return { httpStatus: 409, status: "not_confirmed" };
    case "missing_partner_order_id":
      return { httpStatus: 409, status: "missing_partner_order_id" };
    case "not_found":
      return { httpStatus: 404, status: "not_found" };
    default:
      return { httpStatus: 500, status: "error" };
  }
}

/**
 * Admin-facing view of a hotel booking's cancellation lifecycle — PURE.
 *
 * Derives only from `provider_order_status` (never card data, 3DS fields, hashes,
 * or raw payloads), so it is safe to serialize to the admin client and to test.
 * Drives the admin detail panel: which action to offer and what result to show.
 */
export type HotelCancellationAdminState =
  | "not_requested" // confirmed: cancel can be requested
  | "requested_pending" // cancel_pending: a cancel job is in flight/queued
  | "cancelled" // terminal success
  | "needs_review" // pending_review: cancel ambiguous/errored, human required
  | "failed" // terminal failure
  | "not_cancellable"; // pending/creating/starting/processing/requires_3ds/unknown

export type HotelCancellationView = {
  adminState: HotelCancellationAdminState;
  title: string;
  detail: string;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
  /** Offer the "Cancel hotel booking" action (confirmed bookings only). */
  canRequestCancel: boolean;
  /** Offer "process the pending cancel job now" (cancel_pending only). */
  canProcessPending: boolean;
};

/** Authoritative admin check: only a confirmed order may begin cancellation. */
export function canAdminRequestHotelCancel(
  providerOrderStatus: string | null,
): boolean {
  return (
    evaluateCancellationRequest({
      providerOrderStatus,
      bookingCustomerEmail: null,
      requester: { kind: "admin" },
    }).allowed === true
  );
}

export function describeHotelCancellationState(
  providerOrderStatus: string | null,
): HotelCancellationView {
  switch (providerOrderStatus) {
    case "confirmed":
      return {
        adminState: "not_requested",
        title: "Confirmed",
        detail: "This booking is confirmed and can be cancelled.",
        tone: "info",
        canRequestCancel: true,
        canProcessPending: false,
      };
    case "cancel_pending":
      return {
        adminState: "requested_pending",
        title: "Cancellation in progress",
        detail:
          "Cancellation has been requested from RateHawk/ETG and is being processed.",
        tone: "warning",
        canRequestCancel: false,
        canProcessPending: true,
      };
    case "cancelled":
      return {
        adminState: "cancelled",
        title: "Cancelled",
        detail: "RateHawk/ETG confirmed the cancellation of this booking.",
        tone: "success",
        canRequestCancel: false,
        canProcessPending: false,
      };
    case "pending_review":
      return {
        adminState: "needs_review",
        title: "Needs manual review",
        detail:
          "The cancellation could not be resolved automatically and needs manual review with RateHawk/ETG.",
        tone: "warning",
        canRequestCancel: false,
        canProcessPending: false,
      };
    case "failed":
      return {
        adminState: "failed",
        title: "Failed",
        detail: "This booking is in a failed state and cannot be cancelled here.",
        tone: "danger",
        canRequestCancel: false,
        canProcessPending: false,
      };
    default:
      // pending / creating / starting / processing / requires_3ds / null
      return {
        adminState: "not_cancellable",
        title: "Not cancellable yet",
        detail:
          "This booking is not confirmed, so it cannot be cancelled from here.",
        tone: "neutral",
        canRequestCancel: false,
        canProcessPending: false,
      };
  }
}

/** Admin-facing result label for a just-processed cancellation. */
export function mapProcessedCancellationResult(
  providerOrderStatus: string | null,
): { adminState: HotelCancellationAdminState; message: string } {
  const view = describeHotelCancellationState(providerOrderStatus);
  switch (view.adminState) {
    case "cancelled":
      return { adminState: view.adminState, message: "Cancellation confirmed — booking cancelled." };
    case "requested_pending":
      return { adminState: view.adminState, message: "Cancellation is still pending. Try processing again in a moment." };
    case "needs_review":
      return { adminState: view.adminState, message: "Cancellation needs manual review." };
    case "failed":
      return { adminState: view.adminState, message: "Cancellation failed." };
    case "not_requested":
      return { adminState: view.adminState, message: "No cancellation has been requested for this booking." };
    default:
      return { adminState: view.adminState, message: "This booking cannot be cancelled." };
  }
}
