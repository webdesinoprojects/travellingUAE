"use client";

import Link from "next/link";
import { ArrowLeft, Loader2, Mail, Play } from "lucide-react";
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
  emailVerifiedAt: string | null;
};

type ActionMessage = {
  text: string;
  tone: "neutral" | "warning" | "error" | "success";
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
  emailVerifiedAt,
}: EsimOrderActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<"fulfill" | "email" | null>(null);
  const [message, setMessage] = useState<ActionMessage | null>(null);
  const showFulfillment = status === "paid" && fulfillmentGuard.isTestPlan;
  const showResendEmail = status === "fulfilled";
  const emailVerified = Boolean(emailVerifiedAt);
  const resendEmailBlockedMessage =
    "Email not sent because the customer email is not verified.";

  async function runFulfillment() {
    if (!fulfillmentGuard.canRunTestFulfillment || busy) return;
    setBusy("fulfill");
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
        setMessage({
          text: payload?.message ?? "Fulfillment could not be started.",
          tone: "error",
        });
        return;
      }

      const reason = payload.data?.blockedReason ?? payload.data?.reason;
      setMessage({
        text: reason ? `${payload.data?.status}: ${reason}` : payload.data?.status ?? "Done",
        tone: "neutral",
      });
      router.refresh();
    } catch {
      setMessage({ text: "Fulfillment could not be started.", tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function resendEmail() {
    if (busy || !emailVerified) return;
    setBusy("email");
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/esim/orders/${encodeURIComponent(orderId)}/resend-email`,
        {
          method: "POST",
          credentials: "same-origin",
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: { status?: string; reason?: string | null }; message?: string }
        | null;

      if (!response.ok || !payload?.ok) {
        setMessage({
          text: payload?.message ?? "eSIM email could not be sent.",
          tone: "error",
        });
        return;
      }

      if (payload.data?.status === "skipped" && payload.data.reason === "email_not_verified") {
        setMessage({ text: resendEmailBlockedMessage, tone: "warning" });
        return;
      }

      if (payload.data?.status === "skipped") {
        setMessage({
          text: payload.data.reason
            ? `Email not sent: ${payload.data.reason}.`
            : "Email was not sent.",
          tone: "warning",
        });
        return;
      }

      setMessage({ text: "eSIM email sent.", tone: "success" });
      router.refresh();
    } catch {
      setMessage({ text: "eSIM email could not be sent.", tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href="/admin/esim/orders"
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-soft bg-white px-4 text-sm font-black text-brand-navy hover:bg-[#fffaf2] dark:bg-white/10 dark:text-white dark:hover:bg-white/[0.14]"
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
            disabled={!fulfillmentGuard.canRunTestFulfillment || busy != null}
            onClick={() => void runFulfillment()}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-navy px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-sand dark:text-brand-navy"
          >
            {busy === "fulfill" ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Play aria-hidden="true" className="size-4" />
            )}
            Run Airhub test fulfillment
          </button>
          {fulfillmentGuard.blockedReason || message ? (
            <p className={messageClassName(message?.tone)}>
              {message?.text ?? fulfillmentGuard.blockedReason}
            </p>
          ) : null}
        </div>
      ) : null}

      {showResendEmail ? (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            disabled={busy != null || !emailVerified}
            onClick={() => void resendEmail()}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-blue px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "email" ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Mail aria-hidden="true" className="size-4" />
            )}
            Resend eSIM email
          </button>
          {!emailVerified ? (
            <p className={messageClassName("warning")}>{resendEmailBlockedMessage}</p>
          ) : null}
        </div>
      ) : null}

      {showResendEmail && message ? (
        <p className={messageClassName(message.tone)}>{message.text}</p>
      ) : null}
    </div>
  );
}

function messageClassName(tone: ActionMessage["tone"] | undefined): string {
  switch (tone) {
    case "error":
      return "max-w-sm rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 dark:border-red-400/40 dark:bg-red-950/35 dark:text-red-200";
    case "warning":
      return "max-w-sm rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 dark:border-amber-400/40 dark:bg-amber-950/35 dark:text-amber-200";
    case "success":
      return "max-w-sm rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs font-bold text-green-700 dark:border-green-400/40 dark:bg-green-950/35 dark:text-green-200";
    default:
      return "max-w-sm text-xs font-bold text-brand-brown dark:text-white/70";
  }
}
