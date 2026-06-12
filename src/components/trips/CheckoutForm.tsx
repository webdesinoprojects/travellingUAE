"use client";

import { CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import { useState } from "react";

type Field = {
  name: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  pattern?: string;
};

const fields: Field[] = [
  { name: "fullName", label: "Full name", type: "text", required: true, placeholder: "As on passport" },
  { name: "email", label: "Email", type: "email", required: true, placeholder: "you@example.com" },
  { name: "phone", label: "Phone / WhatsApp", type: "tel", required: true, placeholder: "+971 50 000 0000" },
  { name: "nationality", label: "Nationality", type: "text", required: false, placeholder: "e.g. Emirati, Indian, British" },
];

type Props = {
  destinationSlug: string;
  tripSlug: string;
  travelDate?: string;
  travelersCount: number;
  tripPageHref: string;
  /** When provided, shows a "Pay with card" button that POSTs form data to this URL and redirects to Stripe. */
  stripeSessionPath?: string | null;
};

type FormState = "idle" | "submitting" | "success" | "error";
type PayState = "idle" | "redirecting" | "error";

export function CheckoutForm({
  destinationSlug,
  tripSlug,
  travelDate,
  travelersCount,
  tripPageHref,
  stripeSessionPath,
}: Props) {
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [travelers, setTravelers] = useState(travelersCount);
  const [payState, setPayState] = useState<PayState>("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormState("submitting");
    setErrorMessage(null);

    const form = e.currentTarget;
    const data = new FormData(form);

    const body = {
      destinationSlug,
      tripSlug,
      fullName: data.get("fullName") as string,
      email: data.get("email") as string,
      phone: data.get("phone") as string,
      nationality: data.get("nationality") as string | undefined,
      travelDate: travelDate ?? undefined,
      travelersCount: travelers,
      message: data.get("message") as string | undefined,
    };

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        setFormState("error");
        setErrorMessage("We could not submit your request right now. Please try again or contact us directly.");
        return;
      }

      setFormState("success");
    } catch {
      setFormState("error");
      setErrorMessage("A connection error occurred. Please check your internet and try again.");
    }
  }

  async function handlePayWithCard(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (!stripeSessionPath) return;

    const form = (e.currentTarget as HTMLButtonElement).form;
    if (!form?.reportValidity()) return;

    setPayState("redirecting");

    const data = new FormData(form);
    const body = {
      fullName: data.get("fullName"),
      email: data.get("email"),
      phone: data.get("phone"),
      nationality: data.get("nationality"),
      travelersCount: travelers,
      message: data.get("message"),
    };

    try {
      const res = await fetch(stripeSessionPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        setPayState("error");
        return;
      }

      const json = (await res.json()) as { ok: boolean; data?: { url?: string } };
      if (json.ok && json.data?.url) {
        window.location.href = json.data.url;
      } else {
        setPayState("error");
      }
    } catch {
      setPayState("error");
    }
  }

  if (formState === "success") {
    return (
      <div className="mt-6 rounded-lg border border-brand-green/20 bg-brand-green/8 p-8 text-center">
        <CheckCircle2
          aria-hidden="true"
          className="mx-auto size-12 text-brand-green"
        />
        <h3 className="mt-4 text-xl font-extrabold text-brand-navy dark:text-white">
          Request received
        </h3>
        <p className="mt-3 text-sm leading-6 text-brand-navy/68 dark:text-white/68">
          Thank you. Our travel team will review your selected options and
          contact you within 24 hours to confirm availability and next steps.
        </p>
        <a
          href={tripPageHref}
          className="mt-6 inline-flex h-11 items-center rounded-lg bg-brand-blue px-6 text-sm font-extrabold text-white transition hover:bg-brand-blue-strong dark:bg-brand-sand dark:text-brand-navy"
        >
          Back to trip
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 grid gap-5">
      {fields.map((field) => (
        <div key={field.name}>
          <label
            htmlFor={field.name}
            className="block text-sm font-extrabold text-brand-navy dark:text-white"
          >
            {field.label}
            {field.required ? (
              <span className="ml-1 text-brand-blue dark:text-brand-sand">*</span>
            ) : null}
          </label>
          <input
            id={field.name}
            name={field.name}
            type={field.type}
            required={field.required}
            placeholder={field.placeholder}
            autoComplete={field.type === "email" ? "email" : field.type === "tel" ? "tel" : "off"}
            className="mt-1.5 block h-11 w-full rounded-lg border border-border-soft bg-surface px-3.5 text-sm text-brand-navy placeholder-brand-navy/38 outline-none ring-brand-blue/30 transition focus:border-brand-blue focus:ring-2 dark:bg-white/[0.05] dark:text-white dark:placeholder-white/30 dark:ring-brand-sand/30 dark:focus:border-brand-sand"
          />
        </div>
      ))}

      <div>
        <label
          htmlFor="travelersCount"
          className="block text-sm font-extrabold text-brand-navy dark:text-white"
        >
          Total party size <span className="ml-1 text-brand-blue dark:text-brand-sand">*</span>
        </label>
        <input
          id="travelersCount"
          name="travelersCount"
          type="number"
          min={1}
          max={50}
          value={travelers}
          onChange={(e) => setTravelers(Math.max(1, parseInt(e.target.value, 10) || 1))}
          required
          className="mt-1.5 block h-11 w-full rounded-lg border border-border-soft bg-surface px-3.5 text-sm text-brand-navy outline-none ring-brand-blue/30 transition focus:border-brand-blue focus:ring-2 dark:bg-white/[0.05] dark:text-white dark:ring-brand-sand/30 dark:focus:border-brand-sand"
        />
        <p className="mt-1.5 text-xs text-brand-navy/50 dark:text-white/45">
          For our travel team. Room price is fixed per the selected room type.
        </p>
      </div>

      <div>
        <label
          htmlFor="message"
          className="block text-sm font-extrabold text-brand-navy dark:text-white"
        >
          Notes / special requests{" "}
          <span className="font-normal text-brand-navy/50 dark:text-white/50">
            (optional)
          </span>
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          placeholder="Dietary requirements, room preferences, special occasions..."
          className="mt-1.5 block w-full rounded-lg border border-border-soft bg-surface px-3.5 py-2.5 text-sm text-brand-navy placeholder-brand-navy/38 outline-none ring-brand-blue/30 transition focus:border-brand-blue focus:ring-2 dark:bg-white/[0.05] dark:text-white dark:placeholder-white/30 dark:ring-brand-sand/30 dark:focus:border-brand-sand"
        />
      </div>

      {errorMessage ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={formState === "submitting"}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-blue text-sm font-extrabold text-white transition hover:bg-brand-blue-strong disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand-sand dark:text-brand-navy"
      >
        {formState === "submitting" ? (
          <>
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            Submitting...
          </>
        ) : stripeSessionPath ? (
          "Send enquiry (pay later)"
        ) : (
          "Submit booking request"
        )}
      </button>

      {stripeSessionPath ? (
        <p className="text-center text-xs text-brand-navy/55 dark:text-white/55">
          We will contact you to confirm your trip. No payment taken via this form.
        </p>
      ) : (
        <p className="text-center text-xs text-brand-navy/55 dark:text-white/55">
          No payment is taken now. Our team will contact you to confirm.
        </p>
      )}

      {stripeSessionPath ? (
        <>
          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-border-soft" />
            <span className="text-xs font-semibold text-brand-navy/40 dark:text-white/40">
              or pay your hotel add-on now
            </span>
            <div className="h-px flex-1 bg-border-soft" />
          </div>

          <button
            type="button"
            onClick={handlePayWithCard}
            disabled={payState === "redirecting" || formState === "submitting"}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border-2 border-brand-blue bg-transparent text-sm font-extrabold text-brand-blue transition hover:bg-brand-blue hover:text-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-brand-sand dark:text-brand-sand dark:hover:bg-brand-sand dark:hover:text-brand-navy"
          >
            {payState === "redirecting" ? (
              <>
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                Redirecting to checkout...
              </>
            ) : (
              <>
                <CreditCard aria-hidden="true" className="size-4" />
                Pay hotel add-on with card
              </>
            )}
          </button>

          {payState === "error" ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
              We could not start your payment session. Please try again or
              send an enquiry instead.
            </p>
          ) : null}

          <p className="text-center text-xs text-brand-navy/55 dark:text-white/55">
            Securely charged via Stripe. Pays only your selected hotel add-on.
            No card details are stored by Fly Time.
          </p>
        </>
      ) : null}
    </form>
  );
}
