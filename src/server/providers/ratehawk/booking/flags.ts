/**
 * Provider booking feature flag - PURE evaluator.
 *
 * Dependency-free so it can be unit tested directly with `node --test`. The
 * server-side wrapper that reads process.env / provider config lives in
 * `transport.ts` (server-only) and delegates the decision here.
 *
 * Real ETG order creation must stay OFF until ALL of these hold:
 *   1. Explicit enablement (RATEHAWK_BOOKING_ENABLED === "true").
 *   2. Non-production environment (the production gate is a separate, later
 *      decision; this foundation never enables booking in prod).
 *   3. A confirmed payment model is configured (the Stripe<->ETG mapping is a
 *      blocking commercial decision; unset == disabled).
 *   4. Valid provider configuration (credentials present).
 *
 * There is deliberately no browser-controlled input here: the evaluator only
 * accepts server-supplied values, so the flag can never be toggled from a
 * request body, query string, cookie, or header.
 */

/** Payment models valid for enabling Affiliate booking. `deposit` is B2B-only. */
export const ENABLE_PAYMENT_MODELS = ["hotel", "now"] as const;

export type BookingPaymentModel = (typeof ENABLE_PAYMENT_MODELS)[number];

export type ProviderBookingFlagInput = {
  /** RATEHAWK_BOOKING_ENABLED raw value. */
  enabledFlag: string | undefined;
  /** RATEHAWK_BOOKING_PAYMENT_MODEL raw value. */
  paymentModel: string | undefined;
  /** Active RateHawk env: "sandbox" | "test" | "prod". */
  ratehawkEnv: string;
  /** Whether provider credentials are present. */
  providerConfigured: boolean;
};

export type ProviderBookingFlagResult =
  | { enabled: true; paymentModel: BookingPaymentModel }
  | { enabled: false; reasons: string[] };

function isEnablePaymentModel(value: string): value is BookingPaymentModel {
  return (ENABLE_PAYMENT_MODELS as readonly string[]).includes(value);
}

/**
 * Decide whether provider booking is enabled. Returns every failing reason so
 * callers/ops can see exactly what is missing. Defaults to disabled.
 */
export function evaluateProviderBookingFlag(
  input: ProviderBookingFlagInput,
): ProviderBookingFlagResult {
  const reasons: string[] = [];

  if ((input.enabledFlag ?? "").trim().toLowerCase() !== "true") {
    reasons.push("RATEHAWK_BOOKING_ENABLED is not 'true'");
  }

  const env = (input.ratehawkEnv ?? "").trim().toLowerCase();
  if (env === "prod" || env === "production") {
    reasons.push("provider booking is not enabled in production (separate gate)");
  }

  const model = (input.paymentModel ?? "").trim().toLowerCase();
  if (!model) {
    reasons.push("RATEHAWK_BOOKING_PAYMENT_MODEL is not configured");
  } else if (!isEnablePaymentModel(model)) {
    reasons.push(`RATEHAWK_BOOKING_PAYMENT_MODEL '${model}' is not a confirmed model`);
  }

  if (!input.providerConfigured) {
    reasons.push("RateHawk provider credentials are not configured");
  }

  if (reasons.length > 0) {
    return { enabled: false, reasons };
  }

  // Safe: validated non-empty and in the allowlist above.
  return { enabled: true, paymentModel: model as BookingPaymentModel };
}
