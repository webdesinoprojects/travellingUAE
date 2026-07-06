import "server-only";

import { createQrMatrix } from "@/lib/qr-code";
import { resolveEsimQrPayload } from "@/lib/esim-activation";
import { qrMatrixToPngBase64 } from "@/lib/qr-png";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/server/supabase/client";
import {
  generateAirhubLookupToken,
  hashAirhubLookupToken,
} from "@/server/providers/airhub/order-ids";

import { decideActivationEmailSend } from "./email-delivery-helpers";
import { buildActivationEmailContent } from "./email/esim-email-content";
import { resolveAppUrl, sendResendEmail } from "./email/resend-client";

type ActivationEmailOrderRow = {
  id: string;
  public_reference: string;
  status: string;
  guest_email: string;
  plan_name: string | null;
  plan_code: string;
  country_name: string | null;
  country_code: string | null;
  activation_code: string | null;
  qr_payload: string | null;
  apn: string | null;
  sim_id: string | null;
  email_verified_at: string | null;
  activation_email_sent_at: string | null;
};

export type ActivationEmailSendResult =
  | { ok: true; status: "sent" }
  | { ok: true; status: "skipped"; reason: string }
  | { ok: false; status: "failed"; reason: string };

export async function sendFulfilledEsimActivationEmail(input: {
  orderId: string;
  force?: boolean;
}): Promise<ActivationEmailSendResult> {
  if (!hasSupabaseAdminEnv()) {
    return { ok: true, status: "skipped", reason: "db_not_configured" };
  }

  const order = await readActivationEmailOrder(input.orderId);
  if (!order) return { ok: true, status: "skipped", reason: "not_found" };

  const qrPayload = resolveEsimQrPayload({
    activationCode: order.activation_code,
    qrPayload: order.qr_payload,
  });
  const hasActivation = Boolean(order.activation_code || qrPayload);
  const decision = decideActivationEmailSend({
    status: order.status,
    emailVerifiedAt: order.email_verified_at,
    hasActivation,
    alreadySent: input.force ? false : Boolean(order.activation_email_sent_at),
  });

  if (!decision.send) {
    return { ok: true, status: "skipped", reason: decision.reason };
  }

  const lookupToken = generateAirhubLookupToken();
  const lookupTokenHash = hashAirhubLookupToken(lookupToken);
  const secureUrl = `${resolveAppUrl()}/esim/order/${encodeURIComponent(
    order.public_reference,
  )}?token=${encodeURIComponent(lookupToken)}`;

  const supabase = getSupabaseAdminClient();
  const tokenUpdate = await supabase
    .from("esim_orders")
    .update({ activation_email_lookup_token_hash: lookupTokenHash })
    .eq("id", order.id)
    .eq("status", "fulfilled");
  if (tokenUpdate.error) throw tokenUpdate.error;

  const qrMatrix = qrPayload ? createQrMatrix(qrPayload) : null;
  const qrAttachment = qrMatrix
    ? {
        filename: `flytime-esim-${order.public_reference}.png`,
        content: qrMatrixToPngBase64(qrMatrix, { scale: 8 }),
      }
    : null;
  const content = buildActivationEmailContent({
    publicReference: order.public_reference,
    planName: order.plan_name ?? order.plan_code,
    countryName: order.country_name ?? order.country_code,
    secureUrl,
    activationCode: order.activation_code,
    apn: order.apn,
    simId: order.sim_id,
    hasQrAttachment: Boolean(qrAttachment),
  });

  const sent = await sendResendEmail({
    to: order.guest_email,
    subject: content.subject,
    html: content.html,
    text: content.text,
    attachments: qrAttachment ? [qrAttachment] : undefined,
    scope: input.force ? "esim_activation_resend" : "esim_activation_auto",
  });

  const now = new Date().toISOString();
  if (sent.ok) {
    const { error } = await supabase
      .from("esim_orders")
      .update({
        activation_email_status: "sent",
        activation_email_sent_at: now,
        activation_email_error: null,
      })
      .eq("id", order.id);
    if (error) throw error;
    return { ok: true, status: "sent" };
  }

  const { error } = await supabase
    .from("esim_orders")
    .update({
      activation_email_status: "failed",
      activation_email_error:
        sent.reason === "not_configured"
          ? "email_not_configured"
          : `email_failed${sent.status ? `:${sent.status}` : ""}`,
    })
    .eq("id", order.id);
  if (error) throw error;

  return {
    ok: false,
    status: "failed",
    reason: sent.reason,
  };
}

async function readActivationEmailOrder(
  orderId: string,
): Promise<ActivationEmailOrderRow | null> {
  const { data, error } = await getSupabaseAdminClient()
    .from("esim_orders")
    .select(
      "id,public_reference,status,guest_email,plan_name,plan_code,country_name,country_code,activation_code,qr_payload,apn,sim_id,email_verified_at,activation_email_sent_at",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw error;
  return data as ActivationEmailOrderRow | null;
}
