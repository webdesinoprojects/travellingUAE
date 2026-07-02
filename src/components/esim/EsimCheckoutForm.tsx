"use client";

import { CreditCard, Loader2 } from "lucide-react";
import { useState } from "react";

import type { AirhubPublicPlan } from "@/server/providers/airhub/contracts";

type ApiResponse =
  | { ok: true; data: { url: string } }
  | { ok: false; message: string; code?: string };

export function EsimCheckoutForm({
  plan,
  countryCode,
}: {
  plan: AirhubPublicPlan;
  countryCode: string;
}) {
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const canPay = Boolean(plan.price && plan.currency);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
            onChange={(event) => setGuestEmail(event.target.value)}
            maxLength={180}
            className="min-h-12 rounded-lg border border-border-soft bg-white px-4 outline-none focus:border-brand-blue dark:bg-surface-muted"
            placeholder="name@example.com"
          />
        </label>

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
        disabled={!canPay || submitting}
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-blue px-5 text-sm font-extrabold uppercase text-white transition hover:bg-brand-navy disabled:pointer-events-none disabled:opacity-50"
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
