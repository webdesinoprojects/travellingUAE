import { test } from "node:test";
import assert from "node:assert/strict";

import {
  decideOtpSend,
  decideOtpVerify,
  canStartEsimPayment,
  generateOtpCode,
  hashOtp,
  isVerificationFresh,
  normalizeEmail,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_SENDS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
} from "./otp-helpers.ts";
import { decideActivationEmailSend } from "./email-delivery-helpers.ts";

const NOW = 1_800_000_000_000;

test("normalizeEmail lowercases/trims and rejects invalid", () => {
  assert.equal(normalizeEmail("  Foo@Bar.COM "), "foo@bar.com");
  assert.equal(normalizeEmail("no-at-sign"), null);
  assert.equal(normalizeEmail(""), null);
  assert.equal(normalizeEmail(null), null);
  assert.equal(normalizeEmail("a@b"), null); // no TLD
});

test("generateOtpCode is a 6-digit numeric string", () => {
  for (let i = 0; i < 200; i += 1) {
    const code = generateOtpCode();
    assert.match(code, /^\d{6}$/);
  }
});

test("hashOtp is deterministic, peppered, and hides the code", () => {
  const h1 = hashOtp("a@b.com", "123456", "secret");
  const h2 = hashOtp("a@b.com", "123456", "secret");
  assert.equal(h1, h2);
  assert.notEqual(hashOtp("a@b.com", "123456", "secret"), hashOtp("a@b.com", "123456", "other"));
  assert.notEqual(hashOtp("a@b.com", "123456", "secret"), hashOtp("z@b.com", "123456", "secret"));
  assert.equal(h1.includes("123456"), false);
});

test("decideOtpSend enforces cooldown then window rate-limit", () => {
  // First send always allowed.
  const first = decideOtpSend({ lastSentAtMs: null, sendCount: 0, nowMs: NOW });
  assert.equal(first.allowed, true);
  assert.equal(first.nextSendCount, 1);

  // Within cooldown -> blocked.
  const cooling = decideOtpSend({ lastSentAtMs: NOW - 5000, sendCount: 1, nowMs: NOW });
  assert.equal(cooling.allowed, false);
  assert.equal(cooling.reason, "cooldown");
  assert.ok(cooling.retryAfterSeconds > 0);

  // Past cooldown, under cap -> allowed.
  const ok = decideOtpSend({
    lastSentAtMs: NOW - OTP_RESEND_COOLDOWN_MS - 1000,
    sendCount: 2,
    nowMs: NOW,
  });
  assert.equal(ok.allowed, true);
  assert.equal(ok.nextSendCount, 3);

  // Hit the cap within the window -> rate_limited.
  const capped = decideOtpSend({
    lastSentAtMs: NOW - OTP_RESEND_COOLDOWN_MS - 1000,
    sendCount: OTP_MAX_SENDS,
    nowMs: NOW,
  });
  assert.equal(capped.allowed, false);
  assert.equal(capped.reason, "rate_limited");

  // Stale window rolls the count over.
  const rolled = decideOtpSend({
    lastSentAtMs: NOW - 2 * 60 * 60 * 1000,
    sendCount: OTP_MAX_SENDS,
    nowMs: NOW,
  });
  assert.equal(rolled.allowed, true);
  assert.equal(rolled.nextSendCount, 1);
});

test("decideOtpVerify handles no-code / expiry / attempts / match / mismatch", () => {
  const good = hashOtp("a@b.com", "123456", "secret");

  assert.equal(
    decideOtpVerify({ storedHash: null, expiresAtMs: NOW + 1000, attempts: 0, submittedHash: good, nowMs: NOW }).reason,
    "no_code",
  );
  assert.equal(
    decideOtpVerify({ storedHash: good, expiresAtMs: NOW - 1, attempts: 0, submittedHash: good, nowMs: NOW }).reason,
    "expired",
  );
  assert.equal(
    decideOtpVerify({
      storedHash: good,
      expiresAtMs: NOW + OTP_TTL_MS,
      attempts: OTP_MAX_ATTEMPTS,
      submittedHash: good,
      nowMs: NOW,
    }).reason,
    "too_many_attempts",
  );

  const success = decideOtpVerify({
    storedHash: good,
    expiresAtMs: NOW + OTP_TTL_MS,
    attempts: 1,
    submittedHash: good,
    nowMs: NOW,
  });
  assert.equal(success.ok, true);

  const wrong = decideOtpVerify({
    storedHash: good,
    expiresAtMs: NOW + OTP_TTL_MS,
    attempts: 1,
    submittedHash: hashOtp("a@b.com", "000000", "secret"),
    nowMs: NOW,
  });
  assert.equal(wrong.ok, false);
  assert.equal(wrong.reason, "mismatch");
  assert.equal(wrong.nextAttempts, 2);
});

test("isVerificationFresh window", () => {
  assert.equal(isVerificationFresh(NOW - 1000, NOW), true);
  assert.equal(isVerificationFresh(NOW - 60 * 60 * 1000, NOW), false);
  assert.equal(isVerificationFresh(null, NOW), false);
});

test("payment is blocked before email verification and allowed after", () => {
  assert.equal(canStartEsimPayment(null), false);
  assert.equal(canStartEsimPayment(""), false);
  assert.equal(canStartEsimPayment("2026-07-06T00:00:00Z"), true);
});

test("decideActivationEmailSend enforces fulfilled + verified + activation + not-already-sent", () => {
  const base = { status: "fulfilled", emailVerifiedAt: "2026-07-06T00:00:00Z", hasActivation: true, alreadySent: false };
  assert.deepEqual(decideActivationEmailSend(base), { send: true, reason: "ok" });
  assert.equal(decideActivationEmailSend({ ...base, status: "paid" }).reason, "not_fulfilled");
  assert.equal(decideActivationEmailSend({ ...base, emailVerifiedAt: null }).reason, "email_not_verified");
  assert.equal(decideActivationEmailSend({ ...base, hasActivation: false }).reason, "no_activation_data");
  assert.equal(decideActivationEmailSend({ ...base, alreadySent: true }).reason, "already_sent");
});
