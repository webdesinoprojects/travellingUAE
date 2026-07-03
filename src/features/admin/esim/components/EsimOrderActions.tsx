"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { EsimCopyButton } from "@/features/admin/esim/components/EsimCopyButton";

type EsimOrderActionsProps = {
  publicReference: string;
  stripeCheckoutSessionId: string | null;
};

/**
 * Phase 1A actions: safe, read-only helpers only. No fulfill / retry / refund /
 * cancel. The customer "secure order link" is intentionally NOT offered here:
 * it requires the customer's one-time lookup token, which is stored only as a
 * hash and cannot be reconstructed (see the report).
 */
export function EsimOrderActions({ publicReference, stripeCheckoutSessionId }: EsimOrderActionsProps) {
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
    </div>
  );
}
