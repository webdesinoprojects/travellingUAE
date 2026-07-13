"use client";

import {
  ChevronRight,
  Clock3,
  MessageCircle,
  PhoneCall,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";

import type { VisaDestination, VisaPageContent } from "@/data/visa";
import {
  buildEnquiryFieldLines,
  defaultApplyFormConfig,
  defaultCallFormConfig,
  defaultContactCardsConfig,
  type VisaFormFieldConfig,
} from "@/lib/visa-forms";

type FormStatus = {
  type: "idle" | "success" | "error";
  message: string;
};

type VisaContactStackProps = {
  destination: VisaDestination;
  compact?: boolean;
};

type VisaLeadDrawerProps = {
  open: boolean;
  page: VisaPageContent;
  destination: VisaDestination | null;
  onClose: () => void;
};

export function VisaLeadDrawer({
  open,
  page,
  destination,
  onClose,
}: VisaLeadDrawerProps) {
  if (!open || !destination) {
    return null;
  }

  const detailHref = `/${page.slug}/${destination.slug}`;

  return (
    <div className="fixed inset-0 z-[82]">
      <button
        type="button"
        aria-label="Close visa details"
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
      />
      <aside className="absolute left-0 top-0 flex h-full w-[min(440px,calc(100vw-24px))] flex-col overflow-y-auto border-r border-border-soft bg-background shadow-[24px_0_70px_rgb(0_0_0/0.28)] dark:bg-black">
        <div className="sticky top-0 z-10 border-b border-border-soft bg-background/92 p-4 backdrop-blur-xl dark:bg-black/92">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-brown">
                Visa details
              </p>
              <h2 className="mt-1 font-serif text-2xl font-black text-brand-navy dark:text-white">
                {destination.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid size-10 shrink-0 place-items-center rounded-lg border border-border-soft text-brand-navy transition hover:border-brand-blue dark:text-white"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-4 p-4">
          <div className="overflow-hidden rounded-lg border border-border-soft bg-surface dark:bg-white/[0.04]">
            <div className="relative aspect-[16/9]">
              <Image
                src={destination.image}
                alt={destination.alt}
                fill
                sizes="(max-width: 560px) 92vw, 420px"
                className="object-cover"
              />
            </div>
            <div className="grid gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-brand-navy dark:text-white">
                    {destination.detailTitle}
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-foreground-muted">
                    {destination.approvalText}
                  </p>
                </div>
                <span className="rounded-full bg-brand-sky px-3 py-1 text-xs font-black text-brand-navy">
                  {destination.countryCode}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Metric label="Processing" value={destination.processingTime} />
                <Metric label="Starting from" value={destination.startingFrom} />
              </div>
              <Link
                href={detailHref}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-navy px-4 text-sm font-black text-white transition hover:bg-brand-blue dark:bg-brand-sand dark:text-brand-navy"
              >
                View full details
                <ChevronRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
          </div>

          <VisaContactStack destination={destination} compact />
        </div>
      </aside>
    </div>
  );
}

export function VisaContactStack({
  destination,
  compact = false,
}: VisaContactStackProps) {
  const applyForm = destination.applyForm ?? defaultApplyFormConfig();
  const callForm = destination.callForm ?? defaultCallFormConfig();
  const contactCards = destination.contactCards ?? defaultContactCardsConfig();

  const visaTypeOptions = useMemo(
    () => destination.visaTypes.map((visaType) => visaType.title),
    [destination.visaTypes],
  );

  const [openPanel, setOpenPanel] = useState<"apply" | "call">(
    applyForm.enabled ? "apply" : "call",
  );
  const [applyValues, setApplyValues] = useState<Record<string, string>>(() =>
    initialValues(applyForm.fields, { travelers: String(applyForm.defaultTravellers) }),
  );
  const [callValues, setCallValues] = useState<Record<string, string>>(() =>
    initialValues(callForm.fields, {}),
  );
  const [applyStatus, setApplyStatus] = useState<FormStatus>({ type: "idle", message: "" });
  const [callStatus, setCallStatus] = useState<FormStatus>({ type: "idle", message: "" });

  async function submitContact(payload: Record<string, unknown>) {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error("Contact submission failed");
    }
  }

  async function handleApplySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateFields(applyForm.fields, applyValues);
    if (validationError) {
      setApplyStatus({ type: "error", message: validationError });
      return;
    }

    const lines = buildEnquiryFieldLines(applyForm.fields, applyValues);
    const travelersRaw = applyValues.travelers?.trim();
    const travelers = travelersRaw ? Number(travelersRaw) : undefined;

    try {
      setApplyStatus({ type: "idle", message: "Submitting..." });
      // source stays 'visa-apply-online'. Known keys map to contact fields; all
      // enabled fields (incl. custom ones) are included in the message so they
      // appear in /admin/visa-enquiries.
      await submitContact({
        source: "visa-apply-online",
        fullName: applyValues.fullName?.trim() || "Visa applicant",
        email: applyValues.email?.trim() || undefined,
        phone: digits(applyValues.phone),
        subject: `${destination.name} visa application enquiry`,
        message: [
          `${destination.name} visa application enquiry`,
          ...lines,
          `Starting price: ${destination.startingFrom}`,
        ].join("\n"),
        ...(travelers && Number.isFinite(travelers) ? { travelers } : {}),
      });
      setApplyStatus({ type: "success", message: "Request received. The visa desk will contact you." });
      setApplyValues(initialValues(applyForm.fields, { travelers: String(applyForm.defaultTravellers) }));
    } catch {
      setApplyStatus({ type: "error", message: "Could not submit right now. Please try again shortly." });
    }
  }

  async function handleCallSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateFields(callForm.fields, callValues);
    if (validationError) {
      setCallStatus({ type: "error", message: validationError });
      return;
    }

    const lines = buildEnquiryFieldLines(callForm.fields, callValues);
    try {
      setCallStatus({ type: "idle", message: "Submitting..." });
      await submitContact({
        source: "visa-call-request",
        fullName: callValues.fullName?.trim() || "Visa call request",
        email: callValues.email?.trim() || undefined,
        phone: digits(callValues.phone),
        subject: `${destination.name} visa call request`,
        message: [`Call back requested for ${destination.name} visa support.`, ...lines].join("\n"),
      });
      setCallStatus({ type: "success", message: "Request received. We will call you back." });
      setCallValues(initialValues(callForm.fields, {}));
    } catch {
      setCallStatus({ type: "error", message: "Could not submit right now. Please try again shortly." });
    }
  }

  return (
    <div
      className={
        compact
          ? "grid gap-3"
          : "grid gap-4 rounded-lg border border-border-soft bg-brand-blue p-3 dark:bg-brand-navy"
      }
    >
      {contactCards.helperText ? (
        <div className="rounded-lg bg-brand-sand px-4 py-3 text-sm font-bold text-brand-navy">
          {contactCards.helperText}
        </div>
      ) : null}

      {applyForm.enabled ? (
        <ContactAccordion
          title={applyForm.heading}
          open={openPanel === "apply"}
          onToggle={() => setOpenPanel(openPanel === "apply" ? "call" : "apply")}
        >
          <form className="grid gap-4" onSubmit={handleApplySubmit} noValidate>
            {applyForm.fields
              .filter((field) => field.enabled)
              .map((field) => (
                <DynamicField
                  key={field.key}
                  field={field}
                  value={applyValues[field.key] ?? ""}
                  onChange={(v) => setApplyValues((s) => ({ ...s, [field.key]: v }))}
                  visaTypeOptions={visaTypeOptions}
                />
              ))}
            <div className="text-right text-2xl font-black text-brand-navy dark:text-white">
              {destination.startingFrom}
            </div>
            <button type="submit" className={primaryButtonClassName}>
              {applyForm.submitLabel}
            </button>
            <FormMessage status={applyStatus} />
          </form>
        </ContactAccordion>
      ) : null}

      {callForm.enabled ? (
        <ContactAccordion
          title={callForm.heading}
          open={openPanel === "call"}
          onToggle={() => setOpenPanel(openPanel === "call" ? "apply" : "call")}
        >
          <form className="grid gap-4" onSubmit={handleCallSubmit} noValidate>
            {callForm.fields
              .filter((field) => field.enabled)
              .map((field) => (
                <DynamicField
                  key={field.key}
                  field={field}
                  value={callValues[field.key] ?? ""}
                  onChange={(v) => setCallValues((s) => ({ ...s, [field.key]: v }))}
                  visaTypeOptions={visaTypeOptions}
                />
              ))}
            <button type="submit" className={primaryButtonClassName}>
              {callForm.submitLabel}
            </button>
            <FormMessage status={callStatus} />
          </form>
        </ContactAccordion>
      ) : null}

      {contactCards.whatsapp.enabled ? (
        <ContactCard icon={<MessageCircle aria-hidden="true" />} label={contactCards.whatsapp.label} value={contactCards.whatsapp.value} />
      ) : null}
      {contactCards.phone.enabled ? (
        <ContactCard icon={<PhoneCall aria-hidden="true" />} label={contactCards.phone.label} value={contactCards.phone.value} />
      ) : null}
      {contactCards.timing.enabled ? (
        <ContactCard icon={<Clock3 aria-hidden="true" />} label={contactCards.timing.label} value={contactCards.timing.value} />
      ) : null}
    </div>
  );
}

// ---- Dynamic field rendering ----------------------------------------------

function initialValues(fields: VisaFormFieldConfig[], seed: Record<string, string>): Record<string, string> {
  const values: Record<string, string> = { ...seed };
  for (const field of fields) {
    if (!(field.key in values)) values[field.key] = "";
  }
  return values;
}

function validateFields(fields: VisaFormFieldConfig[], values: Record<string, string>): string | null {
  for (const field of fields) {
    if (!field.enabled) continue;
    const value = (values[field.key] ?? "").trim();
    if (field.required && !value) {
      return `Please fill in ${field.label}.`;
    }
    if (!value) continue;
    if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return `Enter a valid ${field.label.toLowerCase()}.`;
    }
    if (field.type === "tel" && (digits(value) ?? "").length < 7) {
      return `Enter a valid ${field.label.toLowerCase()}.`;
    }
    if (field.type === "number" && !(Number(value) > 0)) {
      return `Enter a valid ${field.label.toLowerCase()}.`;
    }
  }
  return null;
}

function digits(value: string | undefined): string | undefined {
  const d = (value ?? "").replace(/\D/g, "");
  return d || undefined;
}

function DynamicField({
  field,
  value,
  onChange,
  visaTypeOptions,
}: {
  field: VisaFormFieldConfig;
  value: string;
  onChange: (v: string) => void;
  visaTypeOptions: string[];
}) {
  const options = field.optionsFromVisaTypes ? visaTypeOptions : field.options ?? [];

  return (
    <label className="grid gap-2">
      <span className="text-sm font-black text-brand-navy dark:text-white">
        {field.label}
        {field.required ? <span className="ml-1 text-red-500">*</span> : null}
      </span>
      {field.type === "textarea" ? (
        <textarea
          name={field.key}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className={`${fieldClassName} resize-y py-2`}
        />
      ) : field.type === "select" ? (
        <select name={field.key} value={value} onChange={(e) => onChange(e.target.value)} className={fieldClassName}>
          <option value="">Select {field.label.toLowerCase()}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          name={field.key}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={field.type === "number" ? "number" : field.type}
          inputMode={field.type === "tel" ? "tel" : field.type === "number" ? "numeric" : field.type === "email" ? "email" : undefined}
          min={field.type === "number" ? field.min ?? 1 : undefined}
          placeholder={field.placeholder}
          className={fieldClassName}
        />
      )}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-soft bg-background p-3 dark:bg-black">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-brand-brown">{label}</p>
      <p className="mt-1 font-black text-brand-navy dark:text-white">{value}</p>
    </div>
  );
}

function ContactAccordion({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg bg-surface dark:bg-white/[0.05]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-lg font-black text-brand-navy dark:text-white"
        aria-expanded={open}
      >
        <span>{title}</span>
        <span className="text-2xl leading-none">{open ? "-" : "+"}</span>
      </button>
      {open ? <div className="border-t border-border-soft px-5 py-5">{children}</div> : null}
    </section>
  );
}

function ContactCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 rounded-lg bg-surface px-5 py-4 dark:bg-white/[0.05]">
      <span className="text-brand-blue dark:text-brand-sand [&>svg]:size-5">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground-muted">{label}</span>
        <span className="block break-words text-xl font-black text-brand-navy dark:text-white">{value}</span>
      </span>
    </div>
  );
}

function FormMessage({ status }: { status: FormStatus }) {
  if (status.type === "idle" && !status.message) {
    return null;
  }

  return (
    <p
      className={
        status.type === "success"
          ? "text-sm font-bold text-emerald-600 dark:text-emerald-300"
          : status.type === "error"
            ? "text-sm font-bold text-red-600 dark:text-red-300"
            : "text-sm font-bold text-foreground-muted"
      }
      role={status.type === "error" ? "alert" : "status"}
    >
      {status.message}
    </p>
  );
}

const fieldClassName =
  "min-h-12 w-full rounded-lg border border-border-soft bg-background px-4 text-sm font-semibold text-brand-navy outline-none transition placeholder:text-foreground-muted focus:border-brand-blue focus:ring-2 focus:ring-brand-sky dark:border-white/15 dark:bg-white/10 dark:text-white dark:placeholder:text-white/60 dark:focus:border-brand-sand dark:focus:ring-brand-sand/40";

const primaryButtonClassName =
  "inline-flex min-h-12 items-center justify-center rounded-lg bg-brand-blue px-5 text-sm font-black uppercase tracking-widest text-white shadow-[0_14px_30px_rgb(7_23_57/0.22)] transition hover:bg-brand-navy active:bg-brand-navy dark:bg-brand-sand dark:text-brand-navy dark:hover:bg-brand-sand/90 dark:active:bg-brand-sand/85";
