"use client";

import {
  CalendarDays,
  Flag,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  User,
  Users,
} from "lucide-react";
import { FormEvent, useState } from "react";
import {
  type HajjUmrahFieldErrors,
  validateHajjUmrahFields,
} from "@/lib/validation/hajj-umrah";

type FormState = {
  fullName: string;
  phoneCode: string;
  phoneNumber: string;
  email: string;
  travelDate: string;
  departureCity: string;
  travelers: string;
  nationality: string;
  remarks: string;
};

const initialForm: FormState = {
  fullName: "",
  phoneCode: "+91",
  phoneNumber: "",
  email: "",
  travelDate: "",
  departureCity: "",
  travelers: "1",
  nationality: "",
  remarks: "",
};

const genericError =
  "We could not submit the enquiry right now. Please try again in a moment.";

export function HajjUmrahEnquiryForm() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">(
    "idle",
  );
  const [statusMessage, setStatusMessage] = useState("");
  const [errors, setErrors] = useState<HajjUmrahFieldErrors>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setStatusMessage("");

    const validation = validateHajjUmrahFields(form);

    if (!validation.ok) {
      setErrors(validation.errors);
      setStatus("error");
      setStatusMessage("Please fix the highlighted fields.");
      return;
    }

    setErrors({});
    const data = validation.data;
    const message = [
      "Hajj & Umrah pilgrimage enquiry",
      `Travel date: ${data.travelDate}`,
      `Departure city: ${data.departureCity}`,
      `Travelers: ${data.travelers}`,
      `Nationality: ${data.nationality}`,
      `Remarks: ${data.remarks || "No remarks supplied."}`,
    ].join("\n");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: data.fullName,
          email: data.email,
          phoneCode: data.phoneCode,
          phoneNumber: data.phoneNumber,
          phone: data.phone,
          subject: "Hajj & Umrah pilgrimage enquiry",
          message,
          source: "hajj-umrah-page",
          travelDate: data.travelDate,
          departureCity: data.departureCity,
          travelers: data.travelers,
          nationality: data.nationality,
          remarks: data.remarks,
        }),
      });

      if (!response.ok) {
        throw new Error("Submission failed");
      }

      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      setForm(initialForm);
      setErrors({});
      setStatus("success");
      setStatusMessage(payload?.message ?? "Your enquiry has been received.");
    } catch {
      setStatus("error");
      setStatusMessage(genericError);
    }
  }

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-lg border border-[#e2d2bc] bg-white/95 p-4 shadow-[0_16px_42px_rgb(7_23_57/0.08)] sm:p-5 lg:p-6 dark:border-white/12 dark:bg-[#080808]/92 dark:shadow-[0_18px_48px_rgb(0_0_0/0.32)]"
    >
      <div className="text-center">
        <h2 className="font-serif text-2xl font-semibold text-brand-navy sm:text-3xl dark:text-white">
          Book Your Pilgrimage
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-brand-brown dark:text-brand-sand/88">
          Share your details and the Fly Time team will follow up.
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-5">
        <Field
          inputId="hajj-name"
          label="Name"
          required
          error={errors.fullName}
          icon={<User aria-hidden="true" />}
        >
          <input
            required
            id="hajj-name"
            value={form.fullName}
            onChange={(event) => updateField("fullName", event.target.value)}
            className={inputClassName}
            placeholder="Enter your name"
            autoComplete="name"
            minLength={2}
            maxLength={120}
            aria-invalid={Boolean(errors.fullName)}
          />
        </Field>

        <Field
          inputId="hajj-phone"
          label="Phone"
          required
          error={errors.phoneCode ?? errors.phoneNumber}
          icon={<Phone aria-hidden="true" />}
        >
          <div className="grid grid-cols-[86px_minmax(0,1fr)] gap-2 sm:grid-cols-[92px_minmax(0,1fr)]">
            <input
              required
              value={form.phoneCode}
              onChange={(event) =>
                updateField("phoneCode", normalizeDialingCode(event.target.value))
              }
              className={inputClassName}
              aria-label="Dialing code"
              autoComplete="tel-country-code"
              inputMode="tel"
              maxLength={8}
              placeholder="+91"
              aria-invalid={Boolean(errors.phoneCode)}
            />
            <input
              required
              id="hajj-phone"
              value={form.phoneNumber}
              onChange={(event) =>
                updateField("phoneNumber", normalizePhoneNumber(event.target.value))
              }
              className={inputClassName}
              placeholder="8123456789"
              autoComplete="tel-national"
              inputMode="tel"
              minLength={7}
              maxLength={24}
              aria-invalid={Boolean(errors.phoneNumber)}
            />
          </div>
        </Field>

        <Field
          inputId="hajj-email"
          label="Email"
          required
          error={errors.email}
          icon={<Mail aria-hidden="true" />}
        >
          <input
            required
            id="hajj-email"
            type="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            className={inputClassName}
            placeholder="Enter your email ID"
            autoComplete="email"
            maxLength={180}
            aria-invalid={Boolean(errors.email)}
          />
        </Field>

        <Field
          inputId="hajj-date"
          label="Date"
          required
          error={errors.travelDate}
          icon={<CalendarDays aria-hidden="true" />}
        >
          <input
            required
            id="hajj-date"
            type="date"
            value={form.travelDate}
            onChange={(event) => updateField("travelDate", event.target.value)}
            className={inputClassName}
            aria-invalid={Boolean(errors.travelDate)}
          />
        </Field>

        <Field
          inputId="hajj-departure"
          label="Departure city"
          required
          error={errors.departureCity}
          icon={<MapPin aria-hidden="true" />}
        >
          <input
            required
            id="hajj-departure"
            value={form.departureCity}
            onChange={(event) =>
              updateField("departureCity", event.target.value)
            }
            className={inputClassName}
            placeholder="Kochi, Kozhikode, Dubai..."
            maxLength={120}
            aria-invalid={Boolean(errors.departureCity)}
          />
        </Field>

        <Field
          inputId="hajj-travelers"
          label="No. of travellers"
          required
          error={errors.travelers}
          icon={<Users aria-hidden="true" />}
        >
          <input
            required
            id="hajj-travelers"
            type="text"
            value={form.travelers}
            onChange={(event) =>
              updateField("travelers", normalizeInteger(event.target.value))
            }
            className={inputClassName}
            inputMode="numeric"
            maxLength={3}
            aria-invalid={Boolean(errors.travelers)}
          />
        </Field>

        <Field
          inputId="hajj-nationality"
          label="Nationality"
          required
          error={errors.nationality}
          icon={<Flag aria-hidden="true" />}
        >
          <input
            required
            id="hajj-nationality"
            value={form.nationality}
            onChange={(event) => updateField("nationality", event.target.value)}
            className={inputClassName}
            placeholder="Indian, Saudi, UAE resident..."
            maxLength={120}
            aria-invalid={Boolean(errors.nationality)}
          />
        </Field>

        <Field
          inputId="hajj-remarks"
          label="Remarks"
          error={errors.remarks}
          icon={<MessageSquare aria-hidden="true" />}
          className="sm:col-span-2"
        >
          <textarea
            id="hajj-remarks"
            value={form.remarks}
            onChange={(event) => updateField("remarks", event.target.value)}
            className={`${inputClassName} min-h-28 resize-y py-3`}
            placeholder="Enter your remarks"
            maxLength={800}
            aria-invalid={Boolean(errors.remarks)}
          />
        </Field>
      </div>

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-navy px-5 text-sm font-extrabold text-white shadow-[0_12px_26px_rgb(7_23_57/0.18)] transition hover:bg-brand-blue disabled:cursor-not-allowed disabled:opacity-65 dark:bg-brand-sand dark:text-brand-navy dark:hover:bg-brand-sand/90"
      >
        <Send aria-hidden="true" className="size-4" />
        {status === "submitting" ? "Submitting..." : "Submit"}
      </button>

      {statusMessage ? (
        <p
          className={`mt-4 rounded-lg border px-3 py-2 text-sm font-semibold ${
            status === "success"
              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
              : "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-200"
          }`}
          aria-live="polite"
        >
          {statusMessage}
        </p>
      ) : null}
    </form>
  );
}

function Field({
  children,
  className,
  icon,
  inputId,
  label,
  required = false,
  error,
}: {
  children: React.ReactNode;
  className?: string;
  error?: string;
  icon: React.ReactNode;
  inputId: string;
  label: string;
  required?: boolean;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className="mb-1.5 flex min-w-0 items-center gap-2 text-sm font-extrabold text-brand-navy dark:text-white/92"
      >
        <span className="shrink-0 text-brand-blue/85 [&>svg]:size-4 dark:text-brand-sand">
          {icon}
        </span>
        <span className="min-w-0 flex-1">{label}</span>
        {required ? (
          <span className="rounded-full bg-brand-sand/35 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-brand-brown dark:bg-white/10 dark:text-brand-sand">
            Required
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-bold text-rose-600 dark:text-rose-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const inputClassName =
  "min-h-11 w-full rounded-lg border border-[#ddcbb3] bg-white px-3 text-sm font-semibold text-brand-navy outline-none transition placeholder:text-brand-brown/60 focus:border-brand-blue focus:ring-[3px] focus:ring-brand-sky/32 aria-[invalid=true]:border-rose-400 aria-[invalid=true]:ring-[3px] aria-[invalid=true]:ring-rose-500/10 dark:border-white/12 dark:bg-white/[0.07] dark:text-white dark:placeholder:text-white/42 dark:focus:border-brand-sand dark:focus:bg-white/[0.09] dark:focus:ring-brand-sand/15";

function normalizeDialingCode(value: string) {
  const cleaned = value.replace(/[^\d+]/g, "");
  const digits = cleaned.replace(/\D/g, "").slice(0, 4);
  return cleaned.startsWith("+") ? `+${digits}` : digits ? `+${digits}` : "";
}

function normalizePhoneNumber(value: string) {
  return value.replace(/[^\d\s-]/g, "").slice(0, 24);
}

function normalizeInteger(value: string) {
  return value.replace(/\D/g, "").slice(0, 3);
}
