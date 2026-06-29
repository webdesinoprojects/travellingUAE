/**
 * Refund policy evaluator - PURE, advisory only.
 *
 * The refund state machine is DELIBERATELY separate from both the Stripe payment
 * state and the ETG provider-order state. Requesting (or completing) an ETG
 * cancellation NEVER issues a Stripe refund on its own.
 *
 * This evaluator only RECOMMENDS. Its strongest action is "review": a human must
 * approve any refund before money moves. There is intentionally no "auto_refund"
 * outcome and this module never imports Stripe.
 *
 * Approved policy (recorded here as the source of truth):
 *   - A refund is only ever considered when the booking is PAID and the provider
 *     order is CANCELLED.
 *   - The suggested amount is paidAmount - cancellationPenalty, floored at 0, and
 *     only when both are in the same currency. Any currency mismatch or missing
 *     figure yields a review with no suggested amount (a human resolves it).
 *   - The decision is always routed to manual review; it is never auto-issued.
 */

export type RefundDecision = {
  /** "none" => nothing to refund. "review" => a human must approve. Never auto. */
  action: "none" | "review";
  reason: string;
  /** Suggested refund amount for the human to confirm; null when undeterminable. */
  suggestedAmount: number | null;
  currency: string | null;
};

export function evaluateRefundEligibility(input: {
  paymentStatus: string | null;
  paidAmount: number | null;
  paidCurrency: string | null;
  cancellationPenaltyAmount: number | null;
  cancellationPenaltyCurrency: string | null;
  providerOrderStatus: string | null;
}): RefundDecision {
  if (input.paymentStatus !== "paid") {
    return { action: "none", reason: "not_paid", suggestedAmount: null, currency: null };
  }

  if (input.providerOrderStatus !== "cancelled") {
    return {
      action: "none",
      reason: "order_not_cancelled",
      suggestedAmount: null,
      currency: null,
    };
  }

  const paid = input.paidAmount;
  const paidCurrency = input.paidCurrency?.toUpperCase() ?? null;
  const penalty = input.cancellationPenaltyAmount;
  const penaltyCurrency = input.cancellationPenaltyCurrency?.toUpperCase() ?? null;

  // Can only suggest a figure when we have a paid amount and matching currencies.
  if (paid == null || paidCurrency == null) {
    return {
      action: "review",
      reason: "missing_paid_amount",
      suggestedAmount: null,
      currency: null,
    };
  }

  // An UNKNOWN penalty is NOT zero. We never assume a value: route to manual
  // review with no suggested figure. A zero penalty is only ever applied when ETG
  // explicitly returns 0 (penalty === 0 below).
  if (penalty == null) {
    return {
      action: "review",
      reason: "penalty_unknown",
      suggestedAmount: null,
      currency: paidCurrency,
    };
  }

  if (penaltyCurrency != null && penaltyCurrency !== paidCurrency) {
    return {
      action: "review",
      reason: "currency_mismatch",
      suggestedAmount: null,
      currency: paidCurrency,
    };
  }

  // penalty is a known number (including an explicit 0).
  const suggested = Math.max(0, Number((paid - penalty).toFixed(2)));

  return {
    action: "review",
    reason: "refund_minus_penalty",
    suggestedAmount: suggested,
    currency: paidCurrency,
  };
}
