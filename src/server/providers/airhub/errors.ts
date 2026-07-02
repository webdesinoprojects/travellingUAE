export type AirhubErrorCode =
  | "airhub_disabled"
  | "airhub_purchase_disabled"
  | "airhub_auth_failed"
  | "airhub_plan_fetch_failed"
  | "airhub_country_fetch_failed"
  | "airhub_wallet_failed"
  | "airhub_purchase_failed"
  | "airhub_activation_missing"
  | "esim_order_not_found"
  | "esim_lookup_invalid"
  | "stripe_payment_required"
  | "duplicate_webhook_ignored";

export const AIRHUB_PLAN_FETCH_UNAVAILABLE_MESSAGE =
  "Plan fetching is temporarily unavailable.";

export class AirhubError extends Error {
  readonly code: AirhubErrorCode;
  readonly status: number;

  constructor(code: AirhubErrorCode, message: string, status = 400) {
    super(message);
    this.name = "AirhubError";
    this.code = code;
    this.status = status;
  }
}

export function isAirhubError(error: unknown): error is AirhubError {
  return error instanceof AirhubError;
}

export function toSafeAirhubPlanFetchFailure(error: unknown):
  | {
      ok: false;
      code: "airhub_plan_fetch_failed";
      message: string;
      status: number;
    }
  | null {
  if (!isAirhubError(error) || error.code !== "airhub_plan_fetch_failed") {
    return null;
  }

  return {
    ok: false,
    code: "airhub_plan_fetch_failed",
    message: AIRHUB_PLAN_FETCH_UNAVAILABLE_MESSAGE,
    status: error.status,
  };
}
