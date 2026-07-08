"use client";

import { AlertTriangle, CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type PublicStatus = {
  checkoutId: string;
  state: "pending" | "in_progress" | "confirmed" | "failed" | "review" | "unsupported";
  message: string;
  nextAction: "wait" | "complete_3ds" | "contact_support" | null;
  threeDs?: ThreeDsRedirect | null;
};

type ThreeDsRedirect = {
  actionUrl: string;
  method: "get" | "post";
  fields: Record<string, string>;
};

type ApiResponse = {
  ok: boolean;
  message?: string;
  data?: PublicStatus;
};

type Props = {
  checkoutId: string;
  stripeSessionId: string | null;
  threeDsReturned?: boolean;
};

const TERMINAL_STATES = new Set(["confirmed", "failed", "review", "unsupported"]);

function submitThreeDsRedirect(threeDs: ThreeDsRedirect) {
  const form = document.createElement("form");
  form.method = threeDs.method === "get" ? "GET" : "POST";
  form.action = threeDs.actionUrl;
  for (const [name, value] of Object.entries(threeDs.fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

export function StandaloneHotelStatusPoller({
  checkoutId,
  stripeSessionId,
  threeDsReturned = false,
}: Props) {
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const params = useMemo(() => {
    const search = new URLSearchParams({ checkoutId });
    if (stripeSessionId) search.set("session_id", stripeSessionId);
    if (threeDsReturned) search.set("three_ds_return", "1");
    return search.toString();
  }, [checkoutId, stripeSessionId, threeDsReturned]);

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
  const needsThreeDs =
    status?.nextAction === "complete_3ds" && Boolean(status.threeDs);

  return (
    <div className="rounded-lg border border-border-soft bg-surface p-8 text-center">
      {isConfirmed ? (
        <CheckCircle2 className="mx-auto size-12 text-brand-green" aria-hidden="true" />
      ) : needsSupport ? (
        <AlertTriangle className="mx-auto size-12 text-amber-500" aria-hidden="true" />
      ) : needsThreeDs ? (
        <CreditCard className="mx-auto size-12 text-brand-blue dark:text-brand-sand" aria-hidden="true" />
      ) : (
        <Loader2 className="mx-auto size-12 animate-spin text-brand-blue dark:text-brand-sand" aria-hidden="true" />
      )}
      <h1 className="mt-5 text-3xl font-black">
        {isConfirmed
          ? "Hotel booking confirmed"
          : needsSupport
            ? "Booking needs review"
            : needsThreeDs
              ? "Complete card verification"
              : "Confirming your hotel"}
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-brand-navy/65 dark:text-white/65">
        {status?.message ??
          "Payment was received. We are waiting for ETG final booking confirmation."}
      </p>
      {error ? (
        <p className="mt-4 text-sm font-semibold text-red-700 dark:text-red-200">{error}</p>
      ) : null}
      {needsThreeDs && status?.threeDs ? (
        <button
          type="button"
          onClick={() => submitThreeDsRedirect(status.threeDs!)}
          className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-navy px-5 text-sm font-extrabold text-white transition hover:bg-brand-blue dark:bg-brand-sand dark:text-brand-navy"
        >
          <CreditCard aria-hidden="true" className="size-4" />
          Complete card verification
        </button>
      ) : null}
      {!isConfirmed && !needsSupport && !needsThreeDs ? (
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-brand-navy/45 dark:text-white/45">
          {loading ? "Checking status" : "Next check in 5 seconds"}
        </p>
      ) : null}
    </div>
  );
}
