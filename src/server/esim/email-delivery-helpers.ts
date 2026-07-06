/**
 * Pure decision for whether the fulfilled-order activation email may be sent.
 * No IO - node --test friendly. Enforces the business rule: QR/activation is
 * emailed ONLY for a fulfilled order whose customer email was verified and that
 * actually has activation data. Auto-delivery also requires it not be already
 * sent; admin resend passes alreadySent=false to intentionally re-send.
 */

export type ActivationEmailDecision = {
  send: boolean;
  reason:
    | "ok"
    | "not_fulfilled"
    | "email_not_verified"
    | "no_activation_data"
    | "already_sent";
};

export function decideActivationEmailSend(input: {
  status: string;
  emailVerifiedAt: string | null;
  hasActivation: boolean;
  alreadySent: boolean;
}): ActivationEmailDecision {
  if (input.status !== "fulfilled") return { send: false, reason: "not_fulfilled" };
  if (!input.emailVerifiedAt) return { send: false, reason: "email_not_verified" };
  if (!input.hasActivation) return { send: false, reason: "no_activation_data" };
  if (input.alreadySent) return { send: false, reason: "already_sent" };
  return { send: true, reason: "ok" };
}
