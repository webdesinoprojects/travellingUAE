/**
 * Pure OTP helpers for eSIM email verification.
 *
 * Only depends on node:crypto (node --test friendly). NEVER stores/returns the
 * OTP in plaintext: the DAL persists hashOtp() output only. All time inputs are
 * epoch-ms numbers so the decision logic is deterministic and unit testable.
 */

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const OTP_TTL_MS = 10 * 60 * 1000; // OTP valid for 10 minutes
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60s between sends
export const OTP_SEND_WINDOW_MS = 60 * 60 * 1000; // rolling 1h window for send cap
export const OTP_MAX_SENDS = 5; // max sends per window
export const OTP_MAX_ATTEMPTS = 5; // max verify attempts per code
export const OTP_VERIFICATION_FRESH_MS = 30 * 60 * 1000; // a verification is "fresh" for 30 min
export const OTP_CODE_LENGTH = 6;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lowercase + trim + basic-shape validate. Returns null when clearly invalid. */
export function normalizeEmail(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 180) return null;
  return EMAIL_RE.test(email) ? email : null;
}

/** Cryptographically-random 6-digit code (no modulo bias). */
export function generateOtpCode(): string {
  return String(randomInt(0, 10 ** OTP_CODE_LENGTH)).padStart(OTP_CODE_LENGTH, "0");
}

/**
 * HMAC-SHA256 of `email:code` keyed by a server secret (pepper). Peppering means
 * a DB read alone cannot brute-force the 6-digit code offline. The email is
 * mixed in so hashes are unique per address.
 */
export function hashOtp(email: string, code: string, secret: string): string {
  return createHmac("sha256", secret || "esim-otp-fallback")
    .update(`${email}:${code}`)
    .digest("hex");
}

function safeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

export type OtpSendDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
  /** send_count to persist when allowed (rolls over after the window). */
  nextSendCount: number;
  reason: "ok" | "cooldown" | "rate_limited";
};

export function decideOtpSend(input: {
  lastSentAtMs: number | null;
  sendCount: number;
  nowMs: number;
}): OtpSendDecision {
  const { lastSentAtMs, sendCount, nowMs } = input;

  // A stale last-send rolls the window over and resets the effective count.
  const withinWindow = lastSentAtMs != null && nowMs - lastSentAtMs <= OTP_SEND_WINDOW_MS;
  const effectiveCount = withinWindow ? sendCount : 0;

  if (lastSentAtMs != null) {
    const sinceLast = nowMs - lastSentAtMs;
    if (sinceLast < OTP_RESEND_COOLDOWN_MS) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((OTP_RESEND_COOLDOWN_MS - sinceLast) / 1000),
        nextSendCount: effectiveCount,
        reason: "cooldown",
      };
    }
  }

  if (effectiveCount >= OTP_MAX_SENDS) {
    const windowEndsIn = lastSentAtMs != null ? OTP_SEND_WINDOW_MS - (nowMs - lastSentAtMs) : 0;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(windowEndsIn / 1000)),
      nextSendCount: effectiveCount,
      reason: "rate_limited",
    };
  }

  return { allowed: true, retryAfterSeconds: 0, nextSendCount: effectiveCount + 1, reason: "ok" };
}

export type OtpVerifyDecision = {
  ok: boolean;
  reason: "ok" | "no_code" | "expired" | "too_many_attempts" | "mismatch";
  /** attempts value to persist (incremented on a mismatch). */
  nextAttempts: number;
};

export function decideOtpVerify(input: {
  storedHash: string | null;
  expiresAtMs: number | null;
  attempts: number;
  submittedHash: string;
  nowMs: number;
}): OtpVerifyDecision {
  const { storedHash, expiresAtMs, attempts, submittedHash, nowMs } = input;

  if (!storedHash || expiresAtMs == null) {
    return { ok: false, reason: "no_code", nextAttempts: attempts };
  }
  if (nowMs > expiresAtMs) {
    return { ok: false, reason: "expired", nextAttempts: attempts };
  }
  if (attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, reason: "too_many_attempts", nextAttempts: attempts };
  }
  if (safeHexEqual(storedHash, submittedHash)) {
    return { ok: true, reason: "ok", nextAttempts: attempts };
  }
  return { ok: false, reason: "mismatch", nextAttempts: attempts + 1 };
}

export function isVerificationFresh(verifiedAtMs: number | null, nowMs: number): boolean {
  return verifiedAtMs != null && nowMs - verifiedAtMs <= OTP_VERIFICATION_FRESH_MS;
}

export function canStartEsimPayment(emailVerifiedAt: string | null | undefined): boolean {
  return typeof emailVerifiedAt === "string" && emailVerifiedAt.trim().length > 0;
}
