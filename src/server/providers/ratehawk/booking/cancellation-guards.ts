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
