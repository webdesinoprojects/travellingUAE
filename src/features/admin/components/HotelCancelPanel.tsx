"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";

import {
  describeHotelCancellationState,
  type HotelCancellationAdminState,
} from "@/server/providers/ratehawk/booking/cancellation-guards";

/**
 * Admin hotel-booking cancellation panel.
 *
 * Shows the safe provider fields for a RateHawk/ETG hotel booking and, for
 * CONFIRMED bookings only, a guarded "Cancel hotel booking" action. Cancelling
 * (a) requests cancellation (atomic confirmed -> cancel_pending + durable job)
 * then (b) processes that job immediately via the admin worker endpoint, then
 * refreshes to show the result. No card data, 3DS fields, or raw payloads are
 * ever received or displayed here.
 */
export type HotelProviderFields = {
  providerOrderStatus: string | null;
  providerPartnerOrderId: string | null;
  providerOrderId: string | null;
  providerOrderItemId: string | null;
  providerResultCode: string | null;
  providerConfirmedAt: string | null;
  providerCancelRequestedAt: string | null;
  providerCancelledAt: string | null;
};

type ActionState =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "done"; adminState: HotelCancellationAdminState; message: string }
  | { kind: "error"; message: string };

export function HotelCancelPanel({
  bookingId,
  provider,
}: {
  bookingId: string;
  provider: HotelProviderFields;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [action, setAction] = useState<ActionState>({ kind: "idle" });

  const view = describeHotelCancellationState(provider.providerOrderStatus);
  const busy = action.kind === "working";

  async function runCancel() {
    setConfirmOpen(false);
    setAction({ kind: "working" });

    try {
      // 1. Request cancellation (atomic confirmed -> cancel_pending + job).
      const requestRes = await fetch(`/api/admin/bookings/${bookingId}/cancel-hotel`, {
        method: "POST",
      });
      // 200 => requested. 409 => already cancelling (a job already exists); we
      // still process it. Anything else is a hard failure.
      if (!requestRes.ok && requestRes.status !== 409) {
        setAction({ kind: "error", message: "The cancellation could not be requested." });
        return;
      }

      // 2. Process the queued cancel job immediately.
      const outcome = await processPendingCancel(bookingId);
      if (!outcome) {
        setAction({ kind: "error", message: "The cancellation could not be processed." });
        return;
      }

      setAction({ kind: "done", adminState: outcome.adminState, message: outcome.message });
      router.refresh();
    } catch {
      setAction({ kind: "error", message: "The cancellation could not be completed." });
    }
  }

  async function runProcessPending() {
    setAction({ kind: "working" });
    try {
      const outcome = await processPendingCancel(bookingId);
      if (!outcome) {
        setAction({ kind: "error", message: "The pending cancellation could not be processed." });
        return;
      }
      setAction({ kind: "done", adminState: outcome.adminState, message: outcome.message });
      router.refresh();
    } catch {
      setAction({ kind: "error", message: "The pending cancellation could not be processed." });
    }
  }

  return (
    <section className="rounded-lg border border-[#d7c5ad] bg-white/78 p-5 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-brown">
            Hotel booking (RateHawk / ETG)
          </p>
          <h2 className="mt-1 text-lg font-black">{view.title}</h2>
          <p className="mt-1 text-sm font-semibold text-brand-brown">{view.detail}</p>
        </div>
        <ToneBadge tone={view.tone} label={view.title} />
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <Field label="Provider status" value={provider.providerOrderStatus} mono />
        <Field label="Result code" value={provider.providerResultCode} mono />
        <Field label="Partner order ID" value={provider.providerPartnerOrderId} mono />
        <Field label="Provider order ID" value={provider.providerOrderId} mono />
        <Field label="Order item ID" value={provider.providerOrderItemId} mono />
        <Field label="Confirmed at" value={formatUtc(provider.providerConfirmedAt)} />
        <Field label="Cancel requested at" value={formatUtc(provider.providerCancelRequestedAt)} />
        <Field label="Cancelled at" value={formatUtc(provider.providerCancelledAt)} />
      </dl>

      {/* Result / status feedback */}
      {action.kind === "done" ? (
        <ResultBanner adminState={action.adminState} message={action.message} />
      ) : action.kind === "error" ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
          <XCircle aria-hidden="true" className="size-4 shrink-0" />
          {action.message}
        </div>
      ) : null}

      {/* Actions */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {view.canRequestCancel ? (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={busy}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-black text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
            Cancel hotel booking
          </button>
        ) : null}

        {view.canProcessPending ? (
          <button
            type="button"
            onClick={() => void runProcessPending()}
            disabled={busy}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-soft bg-white px-5 text-sm font-black text-brand-navy transition hover:bg-[#fffaf2] disabled:opacity-50 dark:bg-white/10 dark:text-white"
          >
            {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
            Process pending cancellation
          </button>
        ) : null}

        {!view.canRequestCancel && !view.canProcessPending ? (
          <p className="inline-flex items-center gap-2 text-sm font-bold text-brand-brown">
            <AlertTriangle aria-hidden="true" className="size-4" />
            No cancellation action is available for this booking.
          </p>
        ) : null}
      </div>

      {confirmOpen ? (
        <ConfirmModal
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => void runCancel()}
        />
      ) : null}
    </section>
  );
}

async function processPendingCancel(
  bookingId: string,
): Promise<{ adminState: HotelCancellationAdminState; message: string } | null> {
  const res = await fetch(`/api/admin/bookings/${bookingId}/process-cancel-job`, {
    method: "POST",
  });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    data?: { adminState?: HotelCancellationAdminState; message?: string };
  };
  const data = body.data;
  if (!data?.adminState || !data.message) return null;
  return { adminState: data.adminState, message: data.message };
}

function ConfirmModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-hotel-title"
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md rounded-lg border border-[#d7c5ad] bg-white p-6 shadow-xl dark:border-white/10 dark:bg-[#1a1712]">
        <div className="flex items-start gap-3">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-red-600" />
          <div>
            <h3 id="cancel-hotel-title" className="text-lg font-black">
              Cancel this hotel booking?
            </h3>
            <p className="mt-2 text-sm font-semibold text-brand-brown">
              This will request cancellation from RateHawk/ETG. Use only for
              free-cancellation test bookings or genuine cancellations.
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-11 items-center rounded-lg border border-border-soft bg-white px-4 text-sm font-black text-brand-navy dark:bg-white/10 dark:text-white"
          >
            Keep booking
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex min-h-11 items-center rounded-lg bg-red-600 px-4 text-sm font-black text-white hover:bg-red-700"
          >
            Yes, cancel booking
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultBanner({
  adminState,
  message,
}: {
  adminState: HotelCancellationAdminState;
  message: string;
}) {
  const success = adminState === "cancelled";
  const warn = adminState === "requested_pending" || adminState === "needs_review";
  const cls = success
    ? "border-green-300 bg-green-50 text-green-700 dark:border-green-500/40 dark:bg-green-500/10 dark:text-green-300"
    : warn
      ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
      : "border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300";

  return (
    <div className={`mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold ${cls}`}>
      {success ? (
        <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
      ) : warn ? (
        <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
      ) : (
        <XCircle aria-hidden="true" className="size-4 shrink-0" />
      )}
      {message}
    </div>
  );
}

function ToneBadge({ tone, label }: { tone: string; label: string }) {
  const cls =
    tone === "success"
      ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300"
      : tone === "warning"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
        : tone === "danger"
          ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
          : tone === "info"
            ? "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
            : "bg-brand-sand/60 text-brand-brown dark:bg-white/10 dark:text-white";
  return (
    <span className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-black uppercase tracking-[0.08em] ${cls}`}>
      {label}
    </span>
  );
}

function Field({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-black uppercase tracking-[0.14em] text-brand-brown">{label}</dt>
      <dd className={`mt-1 truncate text-sm font-bold ${mono ? "font-mono text-[13px]" : ""}`}>
        {value && value.trim() ? value : "—"}
      </dd>
    </div>
  );
}

function formatUtc(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  })} UTC`;
}
