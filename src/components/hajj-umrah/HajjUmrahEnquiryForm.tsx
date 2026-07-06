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
      className="rounded-lg border border-border-soft bg-white/92 p-5 shadow-[0_22px_70px_rgb(7_23_57/0.12)] sm:p-6 lg:p-7 dark:border-white/15 dark:bg-[#080808]/95 dark:shadow-[0_24px_70px_rgb(0_0_0/0.45)]"
    >
      <h2 className="text-center font-serif text-2xl font-semibold text-brand-navy sm:text-3xl dark:text-white">
        Book Your Pilgrimage
      </h2>

      <div className="mt-7 grid gap-4 sm:grid-cols-2">
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
          <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2">
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
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-blue px-5 text-sm font-extrabold text-white shadow-[0_16px_34px_rgb(18_63_118/0.22)] transition hover:bg-brand-navy disabled:cursor-not-allowed disabled:opacity-65 dark:bg-brand-sand dark:text-brand-navy dark:hover:bg-brand-sand/90"
      >
        <Send aria-hidden="true" className="size-4" />
        {status === "submitting" ? "Submitting..." : "Submit"}
      </button>

      {statusMessage ? (
        <p
          className={`mt-4 rounded-lg border px-3 py-2 text-sm font-semibold ${
            status === "success"
              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
              : "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-200"
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
        className="mb-2 flex items-center gap-2 text-sm font-extrabold text-brand-navy dark:text-white/92"
      >
        <span className="shrink-0 text-brand-blue [&>svg]:size-4 dark:text-brand-sand">
          {icon}
        </span>
        {label}
        {required ? <span className="text-red-600">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs font-bold text-red-600 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const inputClassName =
  "min-h-11 w-full rounded-lg border border-border-soft bg-surface-muted px-3 text-sm font-semibold text-brand-navy outline-none transition placeholder:text-foreground-muted focus:border-brand-blue focus:bg-white focus:ring-4 focus:ring-brand-sky/45 aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-4 aria-[invalid=true]:ring-red-500/10 dark:border-white/12 dark:bg-white/[0.06] dark:text-white dark:placeholder:text-white/42 dark:focus:border-brand-sand dark:focus:bg-white/[0.09] dark:focus:ring-brand-sand/15";

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
