import "server-only";

/**
 * Minimal Resend email sender via the REST API (no SDK dependency).
 *
 * Security: never logs the email HTML, attachments, activation code, QR, token,
 * or OTP. On failure only a short safe status/message is logged. Returns a
 * result object (never throws for a normal send failure) so callers can decide
 * how to surface it.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type ResendAttachment = {
  filename: string;
  /** base64-encoded content. */
  content: string;
};

export type SendEmailResult =
  | { ok: true; id: string | null }
  | { ok: false; reason: "not_configured" | "send_failed"; status?: number };

export function isEsimEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && resolveEsimEmailFrom());
}

export function resolveEsimEmailFrom(): string {
  // Staging default: onboarding@resend.dev only sends to the Resend account
  // owner. A verified domain sender is required for real customer emails.
  return process.env.ESIM_EMAIL_FROM?.trim() || "onboarding@resend.dev";
}

export function resolveAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

export async function sendResendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: ResendAttachment[];
  /** For safe logging only - a coarse label, never the recipient/content. */
  scope: string;
}): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = resolveEsimEmailFrom();
  if (!apiKey || !from) {
    console.error("[esim.email]", { scope: input.scope, status: "not_configured" });
    return { ok: false, reason: "not_configured" };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(input.attachments && input.attachments.length > 0
          ? { attachments: input.attachments }
          : {}),
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      // Read a short, safe status only. Never echo body content.
      console.error("[esim.email]", { scope: input.scope, status: response.status });
      return { ok: false, reason: "send_failed", status: response.status };
    }

    const payload = (await response.json().catch(() => null)) as { id?: string } | null;
    console.info("[esim.email]", { scope: input.scope, status: "sent" });
    return { ok: true, id: typeof payload?.id === "string" ? payload.id : null };
  } catch {
    console.error("[esim.email]", { scope: input.scope, status: "network_error" });
    return { ok: false, reason: "send_failed" };
  }
}
