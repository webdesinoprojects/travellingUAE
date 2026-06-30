"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type PublicStatus = {
  checkoutId: string;
  state: "pending" | "in_progress" | "confirmed" | "failed" | "review" | "unsupported";
  message: string;
  nextAction: "wait" | "contact_support" | null;
};

type ApiResponse = {
  ok: boolean;
  message?: string;
  data?: PublicStatus;
};

type Props = {
  checkoutId: string;
  stripeSessionId: string | null;
};

const TERMINAL_STATES = new Set(["confirmed", "failed", "review", "unsupported"]);

export function StandaloneHotelStatusPoller({ checkoutId, stripeSessionId }: Props) {
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const params = useMemo(() => {
    const search = new URLSearchParams({ checkoutId });
    if (stripeSessionId) search.set("session_id", stripeSessionId);
    return search.toString();
  }, [checkoutId, stripeSessionId]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      setLoading(true);
      try {
        const response = await fetch(`/api/public/hotels/booking/status?${params}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as ApiResponse | null;
        if (cancelled) return;

        if (!response.ok || !payload?.ok || !payload.data) {
          setError(payload?.message ?? "Booking status is temporarily unavailable.");
          setLoading(false);
          timer = setTimeout(poll, 5000);
          return;
        }

        setStatus(payload.data);
        setError(null);
        setLoading(false);

        if (!TERMINAL_STATES.has(payload.data.state)) {
          timer = setTimeout(poll, 5000);
        }
      } catch {
        if (cancelled) return;
        setError("A connection error occurred while checking booking status.");
        setLoading(false);
        timer = setTimeout(poll, 5000);
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [params]);

  const state = status?.state ?? "pending";
  const isConfirmed = state === "confirmed";
  const needsSupport = state === "failed" || state === "review" || state === "unsupported";

  return (
    <div className="rounded-lg border border-border-soft bg-surface p-8 text-center">
      {isConfirmed ? (
        <CheckCircle2 className="mx-auto size-12 text-brand-green" aria-hidden="true" />
      ) : needsSupport ? (
        <AlertTriangle className="mx-auto size-12 text-amber-500" aria-hidden="true" />
      ) : (
        <Loader2 className="mx-auto size-12 animate-spin text-brand-blue dark:text-brand-sand" aria-hidden="true" />
      )}
      <h1 className="mt-5 text-3xl font-black">
        {isConfirmed
          ? "Hotel booking confirmed"
          : needsSupport
            ? "Booking needs review"
            : "Confirming your hotel"}
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-brand-navy/65 dark:text-white/65">
        {status?.message ??
          "Payment was received. We are waiting for ETG final booking confirmation."}
      </p>
      {error ? (
        <p className="mt-4 text-sm font-semibold text-red-700 dark:text-red-200">{error}</p>
      ) : null}
      {!isConfirmed && !needsSupport ? (
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-brand-navy/45 dark:text-white/45">
          {loading ? "Checking status" : "Next check in 5 seconds"}
        </p>
      ) : null}
    </div>
  );
}
