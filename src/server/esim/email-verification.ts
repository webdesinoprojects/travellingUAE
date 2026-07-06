import "server-only";

import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/server/supabase/client";

import {
  buildOtpEmailContent,
} from "./email/esim-email-content";
import { sendResendEmail } from "./email/resend-client";
import {
  decideOtpSend,
  decideOtpVerify,
  generateOtpCode,
  hashOtp,
  isVerificationFresh,
  normalizeEmail,
  OTP_TTL_MS,
} from "./otp-helpers";

type VerificationRow = {
  email: string;
  otp_hash: string | null;
  otp_expires_at: string | null;
  attempts: number;
  send_count: number;
  last_sent_at: string | null;
  verified_at: string | null;
};

export type EmailOtpSendResult =
  | { ok: true }
  | { ok: false; reason: "invalid_email" | "db_not_configured" | "cooldown" | "rate_limited" | "email_not_configured" | "email_failed"; retryAfterSeconds?: number };

export type EmailOtpVerifyResult =
  | { ok: true; verifiedAt: string }
  | { ok: false; reason: "invalid_email" | "invalid_code" | "db_not_configured" | "no_code" | "expired" | "too_many_attempts" | "mismatch" };

export async function sendEsimEmailOtp(rawEmail: string): Promise<EmailOtpSendResult> {
  const email = normalizeEmail(rawEmail);
  if (!email) return { ok: false, reason: "invalid_email" };
  if (!hasSupabaseAdminEnv()) return { ok: false, reason: "db_not_configured" };

  const supabase = getSupabaseAdminClient();
  const existing = await readVerificationRow(email);
  const now = Date.now();
  const decision = decideOtpSend({
    lastSentAtMs: toMs(existing?.last_sent_at),
    sendCount: existing?.send_count ?? 0,
    nowMs: now,
  });

  if (!decision.allowed) {
    return {
      ok: false,
      reason: decision.reason === "rate_limited" ? "rate_limited" : "cooldown",
      retryAfterSeconds: decision.retryAfterSeconds,
    };
  }

  const code = generateOtpCode();
  const content = buildOtpEmailContent(code);
  const sent = await sendResendEmail({
    to: email,
    subject: content.subject,
    html: content.html,
    text: content.text,
    scope: "esim_otp",
  });

  if (!sent.ok) {
    return {
      ok: false,
      reason: sent.reason === "not_configured" ? "email_not_configured" : "email_failed",
    };
  }

  const nowIso = new Date(now).toISOString();
  const expiresAt = new Date(now + OTP_TTL_MS).toISOString();
  const { error } = await supabase.from("esim_email_verifications").upsert(
    {
      email,
      otp_hash: hashOtp(email, code, getOtpSecret()),
      otp_expires_at: expiresAt,
      attempts: 0,
      send_count: decision.nextSendCount,
      last_sent_at: nowIso,
    },
    { onConflict: "email" },
  );

  if (error) throw error;
  return { ok: true };
}

export async function verifyEsimEmailOtp(
  rawEmail: string,
  rawCode: string,
): Promise<EmailOtpVerifyResult> {
  const email = normalizeEmail(rawEmail);
  const code = rawCode.trim();
  if (!email) return { ok: false, reason: "invalid_email" };
  if (!/^\d{6}$/.test(code)) return { ok: false, reason: "invalid_code" };
  if (!hasSupabaseAdminEnv()) return { ok: false, reason: "db_not_configured" };

  const row = await readVerificationRow(email);
  const now = Date.now();
  const decision = decideOtpVerify({
    storedHash: row?.otp_hash ?? null,
    expiresAtMs: toMs(row?.otp_expires_at),
    attempts: row?.attempts ?? 0,
    submittedHash: hashOtp(email, code, getOtpSecret()),
    nowMs: now,
  });

  const supabase = getSupabaseAdminClient();
  if (decision.ok) {
    const verifiedAt = new Date(now).toISOString();
    const { error } = await supabase
      .from("esim_email_verifications")
      .update({
        verified_at: verifiedAt,
        otp_hash: null,
        otp_expires_at: null,
        attempts: 0,
      })
      .eq("email", email);
    if (error) throw error;
    return { ok: true, verifiedAt };
  }

  if (decision.nextAttempts !== (row?.attempts ?? 0)) {
    const { error } = await supabase
      .from("esim_email_verifications")
      .update({ attempts: decision.nextAttempts })
      .eq("email", email);
    if (error) throw error;
  }

  return {
    ok: false,
    reason: decision.reason === "ok" ? "mismatch" : decision.reason,
  };
}

export async function getFreshEsimEmailVerification(
  rawEmail: string,
): Promise<{ email: string; verifiedAt: string } | null> {
  const email = normalizeEmail(rawEmail);
  if (!email || !hasSupabaseAdminEnv()) return null;

  const row = await readVerificationRow(email);
  const verifiedAtMs = toMs(row?.verified_at);
  if (!isVerificationFresh(verifiedAtMs, Date.now()) || !row?.verified_at) {
    return null;
  }

  return { email, verifiedAt: row.verified_at };
}

async function readVerificationRow(email: string): Promise<VerificationRow | null> {
  const { data, error } = await getSupabaseAdminClient()
    .from("esim_email_verifications")
    .select("email,otp_hash,otp_expires_at,attempts,send_count,last_sent_at,verified_at")
    .eq("email", email)
    .maybeSingle();

  if (error) throw error;
  return data as VerificationRow | null;
}

function getOtpSecret() {
  return (
    process.env.ESIM_OTP_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.RESEND_API_KEY?.trim() ||
    ""
  );
}

function toMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}
