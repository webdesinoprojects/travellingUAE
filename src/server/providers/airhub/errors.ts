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
