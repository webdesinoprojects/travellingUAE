"use client";

import Link from "next/link";
import { ArrowLeft, Loader2, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { EsimCopyButton } from "@/features/admin/esim/components/EsimCopyButton";
import type { EsimFulfillmentGuardView, EsimOrderStatus } from "@/features/admin/esim/types";

type EsimOrderActionsProps = {
  orderId: string;
  status: EsimOrderStatus;
  publicReference: string;
  stripeCheckoutSessionId: string | null;
  fulfillmentGuard: EsimFulfillmentGuardView;
};

/**
 * Phase 1A actions: safe, read-only helpers only. No fulfill / retry / refund /
 * cancel. The customer "secure order link" is intentionally NOT offered here:
 * it requires the customer's one-time lookup token, which is stored only as a
 * hash and cannot be reconstructed (see the report).
 */
export function EsimOrderActions({
  orderId,
  status,
  publicReference,
  stripeCheckoutSessionId,
  fulfillmentGuard,
}: EsimOrderActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const showFulfillment = status === "paid" && fulfillmentGuard.isTestPlan;

  async function runFulfillment() {
    if (!fulfillmentGuard.canRunTestFulfillment || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/esim/orders/${encodeURIComponent(orderId)}/fulfill`, {
        method: "POST",
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: { status?: string; reason?: string | null; blockedReason?: string | null }; message?: string }
        | null;

      if (!response.ok || !payload?.ok) {
        setMessage(payload?.message ?? "Fulfillment could not be started.");
        return;
      }

      const reason = payload.data?.blockedReason ?? payload.data?.reason;
      setMessage(reason ? `${payload.data?.status}: ${reason}` : payload.data?.status ?? "Done");
      router.refresh();
    } catch {
      setMessage("Fulfillment could not be started.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href="/admin/esim/orders"
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-soft bg-white px-4 text-sm font-black text-brand-navy hover:bg-[#fffaf2] dark:bg-white/10 dark:text-white"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to orders
      </Link>

      <EsimCopyButton value={publicReference} label="Copy reference" />

      {stripeCheckoutSessionId ? (
        <EsimCopyButton value={stripeCheckoutSessionId} label="Copy Stripe session" />
      ) : null}

      {showFulfillment ? (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            disabled={!fulfillmentGuard.canRunTestFulfillment || busy}
            onClick={() => void runFulfillment()}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-navy px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-sand dark:text-brand-navy"
          >
            {busy ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Play aria-hidden="true" className="size-4" />
            )}
            Run Airhub test fulfillment
          </button>
          {fulfillmentGuard.blockedReason || message ? (
            <p className="max-w-sm text-xs font-bold text-brand-brown">
              {message ?? fulfillmentGuard.blockedReason}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
