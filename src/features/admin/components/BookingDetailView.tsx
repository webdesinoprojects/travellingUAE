"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";

import { StatusBadge } from "@/features/admin/components/StatusBadge";

type BookingDetailDTO = {
  id: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  travelersCount: number;
  travelDate: string | null;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

type BookingDetailViewProps = {
  booking: BookingDetailDTO;
};

const BOOKING_STATUSES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "completed", label: "Completed" },
];

type SaveState = "idle" | "saving" | "success" | "error";

export function BookingDetailView({ booking }: BookingDetailViewProps) {
  const router = useRouter();
  const [status, setStatus] = useState(booking.status);
  const [notes, setNotes] = useState(booking.adminNotes ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveState("saving");

    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNotes: notes }),
      });

      if (!res.ok) {
        setSaveState("error");
        return;
      }

      setSaveState("success");
      router.refresh();
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border border-[#d7c5ad] bg-white/78 p-5 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-brown">
              Enquiry
            </p>
            <h2 className="mt-1 font-serif text-2xl font-black">{booking.customerName}</h2>
          </div>
          <StatusBadge
            status={
              booking.status as Parameters<typeof StatusBadge>[0]["status"]
            }
          />
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-black uppercase tracking-[0.14em] text-brand-brown">
              Email
            </dt>
            <dd className="mt-1 text-sm font-bold">
              {booking.customerEmail ?? "Not provided"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-black uppercase tracking-[0.14em] text-brand-brown">
              Phone
            </dt>
            <dd className="mt-1 text-sm font-bold">
              {booking.customerPhone ?? "Not provided"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-black uppercase tracking-[0.14em] text-brand-brown">
              Travelers
            </dt>
            <dd className="mt-1 text-sm font-bold">{booking.travelersCount}</dd>
          </div>
          <div>
            <dt className="text-xs font-black uppercase tracking-[0.14em] text-brand-brown">
              Travel date
            </dt>
            <dd className="mt-1 text-sm font-bold">
              {booking.travelDate ?? "Not specified"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-black uppercase tracking-[0.14em] text-brand-brown">
              Received
            </dt>
            <dd className="mt-1 text-sm font-bold">
              {new Date(booking.createdAt).toLocaleString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "UTC",
              })}{" "}
              UTC
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-[#d7c5ad] bg-white/78 p-5 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]">
        <h2 className="mb-4 text-lg font-black">Update enquiry</h2>

        <form onSubmit={(e) => void handleSave(e)} className="grid gap-4">
          <div>
            <label
              htmlFor="booking-status"
              className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em] text-brand-brown"
            >
              Status
            </label>
            <select
              id="booking-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-border-soft bg-[#fffaf2] px-3 py-2.5 text-sm font-bold text-brand-navy dark:bg-white/10 dark:text-white"
            >
              {BOOKING_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="admin-notes"
              className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em] text-brand-brown"
            >
              Internal notes
            </label>
            <textarea
              id="admin-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Notes are never shown to the customer."
              maxLength={4000}
              className="w-full resize-y rounded-lg border border-border-soft bg-[#fffaf2] px-3 py-2.5 text-sm font-semibold text-brand-navy outline-none placeholder:text-brand-brown/60 dark:bg-white/10 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saveState === "saving"}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-navy px-5 text-sm font-black text-white disabled:opacity-50 dark:bg-brand-sand dark:text-brand-navy"
            >
              {saveState === "saving" ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : saveState === "success" ? (
                <CheckCircle2 aria-hidden="true" className="size-4" />
              ) : null}
              Save changes
            </button>

            {saveState === "error" ? (
              <p className="text-sm font-bold text-red-600 dark:text-red-400">
                The record could not be updated.
              </p>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  );
}
