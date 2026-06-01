"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";

type SaveState = "idle" | "saving" | "success" | "error";

export function AddEnquiryForm() {
  const router = useRouter();
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaveState("saving");
    setErrorMsg("");

    const form = e.currentTarget;
    const data = new FormData(form);

    const body = {
      fullName: data.get("fullName"),
      email: data.get("email") || undefined,
      phone: data.get("phone") || undefined,
      travelersCount: Number(data.get("travelersCount") ?? 1),
      travelDate: data.get("travelDate") || undefined,
      status: "new",
    };

    try {
      const res = await fetch("/api/admin/resources/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await res.json().catch(() => null)) as {
        ok?: boolean;
        data?: { row?: { id?: string } };
      } | null;

      if (!res.ok || payload?.ok !== true) {
        setSaveState("error");
        setErrorMsg("The enquiry could not be saved. Check required fields.");
        return;
      }

      setSaveState("success");
      const newId = payload.data?.row?.id;

      if (newId) {
        router.push(`/admin/bookings/${newId}`);
      } else {
        router.push("/admin/bookings");
      }
    } catch {
      setSaveState("error");
      setErrorMsg("An unexpected error occurred.");
    }
  }

  return (
    <section className="rounded-lg border border-[#d7c5ad] bg-white/78 p-5 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]">
      <h2 className="mb-1 text-lg font-black">New travel enquiry</h2>
      <p className="mb-5 text-sm font-semibold text-brand-brown">
        Creates a desk-originated booking. Customer contact is optional — add it if provided by phone or email.
      </p>

      <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Full name *" id="fullName" name="fullName" required />
          <FormField label="Email" id="email" name="email" type="email" />
          <FormField label="Phone" id="phone" name="phone" type="tel" />
          <div>
            <label
              htmlFor="travelersCount"
              className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em] text-brand-brown"
            >
              Number of travelers
            </label>
            <input
              type="number"
              id="travelersCount"
              name="travelersCount"
              min={1}
              max={50}
              defaultValue={1}
              className="w-full rounded-lg border border-border-soft bg-[#fffaf2] px-3 py-2.5 text-sm font-bold text-brand-navy outline-none dark:bg-white/10 dark:text-white"
            />
          </div>
          <FormField label="Travel date" id="travelDate" name="travelDate" type="date" />
        </div>

        <div className="flex items-center gap-3 pt-2">
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
            Create enquiry
          </button>

          {saveState === "error" ? (
            <p className="text-sm font-bold text-red-600 dark:text-red-400">
              {errorMsg}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function FormField({
  label,
  id,
  name,
  type = "text",
  required,
}: {
  label: string;
  id: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em] text-brand-brown"
      >
        {label}
      </label>
      <input
        type={type}
        id={id}
        name={name}
        required={required}
        className="w-full rounded-lg border border-border-soft bg-[#fffaf2] px-3 py-2.5 text-sm font-bold text-brand-navy outline-none dark:bg-white/10 dark:text-white"
      />
    </div>
  );
}
