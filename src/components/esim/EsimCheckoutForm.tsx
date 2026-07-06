"use client";

import { CheckCircle2, CreditCard, Loader2, MailCheck } from "lucide-react";
import { useState } from "react";

import type { AirhubPublicPlan } from "@/server/providers/airhub/contracts";

type ApiResponse =
  | { ok: true; data: { url: string } }
  | { ok: false; message: string; code?: string };

type BasicApiResponse =
  | { ok: true; data: unknown }
  | { ok: false; message: string; code?: string };

type OtpMessageTone = "neutral" | "success" | "error";

export function EsimCheckoutForm({
  plan,
  countryCode,
}: {
  plan: AirhubPublicPlan;
  countryCode: string;
}) {
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [otpMessageTone, setOtpMessageTone] = useState<OtpMessageTone>("neutral");
  const [otpBusy, setOtpBusy] = useState<"send" | "verify" | null>(null);
  const [guestPhone, setGuestPhone] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const normalizedEmail = guestEmail.trim().toLowerCase();
  const emailVerified = Boolean(verifiedEmail && verifiedEmail === normalizedEmail);
  const canPay = Boolean(plan.price && plan.currency);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailVerified) {
      setError("Verify your email before payment.");
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/public/esim/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryCode,
          planCode: plan.planCode,
          guestName,
          guestEmail,
          guestPhone,
          travelDate,
        }),
      });
      const payload = (await response.json().catch(() => null)) as ApiResponse | null;

      if (!payload) {
        setError("Payment setup failed.");
        return;
      }

      if (!payload.ok) {
        setError(payload.message);
        return;
      }

      if (!response.ok) {
        setError("Payment setup failed.");
        return;
      }

      window.location.assign(payload.data.url);
    } catch {
      setError("Payment setup failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendOtp() {
    setError(null);
    setOtpMessage(null);
    setOtpMessageTone("neutral");
    setOtpBusy("send");

    try {
      const response = await fetch("/api/public/esim/email-otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: guestEmail }),
      });
      const payload = (await response.json().catch(() => null)) as BasicApiResponse | null;

      if (!response.ok || !payload?.ok) {
        setOtpMessageTone("error");
        setOtpMessage(
          payload && !payload.ok
            ? payload.message
            : "Verification email could not be sent.",
        );
        return;
      }

      setOtpMessageTone("success");
      setOtpMessage("Verification code sent. Check your email.");
    } catch {
      setOtpMessageTone("error");
      setOtpMessage("Verification email could not be sent.");
    } finally {
      setOtpBusy(null);
    }
  }

  async function verifyOtp() {
    setError(null);
    setOtpMessage(null);
    setOtpMessageTone("neutral");
    setOtpBusy("verify");

    try {
      const response = await fetch("/api/public/esim/email-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: guestEmail, code: otpCode }),
      });
      const payload = (await response.json().catch(() => null)) as BasicApiResponse | null;

      if (!response.ok || !payload?.ok) {
        setOtpMessageTone("error");
        setOtpMessage(payload && !payload.ok ? payload.message : "Verification failed.");
        return;
      }

      setVerifiedEmail(normalizedEmail);
      setOtpMessageTone("success");
      setOtpMessage("Email verified.");
    } catch {
      setOtpMessageTone("error");
      setOtpMessage("Verification failed.");
    } finally {
      setOtpBusy(null);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border-soft bg-surface p-5 shadow-sm">
      <div>
        <p className="text-xs font-black uppercase text-brand-blue">
          Secure checkout
        </p>
        <h2 className="mt-2 text-2xl font-black">{plan.planName ?? plan.planCode}</h2>
        <p className="mt-2 text-sm font-semibold text-brand-navy/60 dark:text-white/60">
          Payment opens in Stripe. eSIM purchase remains disabled until Airhub live
          fulfillment is explicitly enabled.
        </p>
      </div>

      <div className="mt-6 grid gap-4">
        <label className="grid gap-2 text-sm font-bold">
          Full name
          <input
            value={guestName}
            onChange={(event) => setGuestName(event.target.value)}
            maxLength={120}
            className="min-h-12 rounded-lg border border-border-soft bg-white px-4 outline-none focus:border-brand-blue dark:bg-surface-muted"
            placeholder="Passenger name"
          />
        </label>

        <label className="grid gap-2 text-sm font-bold">
          Email
          <input
            type="email"
            required
            value={guestEmail}
            onChange={(event) => {
              setGuestEmail(event.target.value);
              setOtpCode("");
              setOtpMessage(null);
              setOtpMessageTone("neutral");
              setVerifiedEmail(null);
            }}
            maxLength={180}
            className="min-h-12 rounded-lg border border-border-soft bg-white px-4 outline-none focus:border-brand-blue dark:bg-surface-muted"
            placeholder="name@example.com"
          />
        </label>

        <div className="rounded-lg border border-border-soft bg-white p-4 dark:bg-surface-muted">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-black">
              {emailVerified ? (
                <CheckCircle2 className="size-4 text-brand-blue" aria-hidden="true" />
              ) : (
                <MailCheck className="size-4 text-brand-blue" aria-hidden="true" />
              )}
              {emailVerified ? "Email verified" : "Verify email before payment"}
            </div>
            <button
              type="button"
              disabled={!normalizedEmail || otpBusy != null || emailVerified}
              onClick={() => void sendOtp()}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border-soft bg-white px-3 text-xs font-black text-brand-navy disabled:opacity-50 dark:bg-white/10 dark:text-white"
            >
              {otpBusy === "send" ? <Loader2 className="size-4 animate-spin" /> : null}
              Send code
            </button>
          </div>

          {!emailVerified ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="6-digit code"
                className="min-h-11 flex-1 rounded-lg border border-border-soft bg-[#fffaf2] px-3 text-sm font-bold tracking-[0.18em] text-brand-navy outline-none focus:border-brand-blue dark:bg-white/10 dark:text-white"
              />
              <button
                type="button"
                disabled={otpCode.length !== 6 || otpBusy != null}
                onClick={() => void verifyOtp()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-navy px-4 text-sm font-black text-white disabled:opacity-50 dark:bg-brand-sand dark:text-brand-navy"
              >
                {otpBusy === "verify" ? <Loader2 className="size-4 animate-spin" /> : null}
                Verify
              </button>
            </div>
          ) : null}

          {otpMessage ? (
            <p
              className={[
                "mt-2 rounded-md px-3 py-2 text-xs font-bold",
                otpMessageTone === "error"
                  ? "border border-red-200 bg-red-50 text-red-700 dark:border-red-400/40 dark:bg-red-950/35 dark:text-red-200"
                  : otpMessageTone === "success"
                    ? "border border-green-200 bg-green-50 text-green-700 dark:border-green-400/40 dark:bg-green-950/35 dark:text-green-200"
                    : "text-brand-navy/65 dark:text-white/65",
              ].join(" ")}
            >
              {otpMessage}
            </p>
          ) : !emailVerified ? (
            <p className="mt-2 text-xs font-semibold text-brand-navy/60 dark:text-white/65">
              Enter the 6-digit code sent to your email.
            </p>
          ) : null}
        </div>

        <label className="grid gap-2 text-sm font-bold">
          Phone
          <input
            value={guestPhone}
            onChange={(event) => setGuestPhone(event.target.value)}
            maxLength={40}
            className="min-h-12 rounded-lg border border-border-soft bg-white px-4 outline-none focus:border-brand-blue dark:bg-surface-muted"
            placeholder="Optional"
          />
        </label>

        <label className="grid gap-2 text-sm font-bold">
          Travel date
          <input
            type="date"
            value={travelDate}
            onChange={(event) => setTravelDate(event.target.value)}
            className="min-h-12 rounded-lg border border-border-soft bg-white px-4 outline-none focus:border-brand-blue dark:bg-surface-muted"
          />
        </label>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!canPay || !emailVerified || submitting}
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-blue px-5 text-sm font-extrabold uppercase text-white transition hover:bg-brand-navy disabled:pointer-events-none disabled:opacity-50 dark:bg-brand-sand dark:text-brand-navy dark:hover:bg-brand-sand/90"
      >
        {submitting ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <CreditCard className="size-4" aria-hidden="true" />
        )}
        Continue to payment
      </button>
    </form>
  );
}
