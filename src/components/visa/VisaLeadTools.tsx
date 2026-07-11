"use client";

import {
  ChevronRight,
  Clock3,
  Mail,
  MessageCircle,
  Phone,
  PhoneCall,
  User,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { VisaDestination, VisaPageContent } from "@/data/visa";

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
  const [openPanel, setOpenPanel] = useState<"apply" | "call">("apply");
  const [applyStatus, setApplyStatus] = useState<FormStatus>({
    type: "idle",
    message: "",
  });
  const [callStatus, setCallStatus] = useState<FormStatus>({
    type: "idle",
    message: "",
  });

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
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const email = String(form.get("email") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const visaType = String(form.get("visaType") ?? "").trim();
    const travelers = String(form.get("travelers") ?? "").trim();
    const phoneDigits = phone.replace(/\D/g, "");

    if (!isEmail(email) || phoneDigits.length < 7 || !isPositiveInteger(travelers)) {
      setApplyStatus({
        type: "error",
        message: "Enter a valid email, phone number, and traveller count.",
      });
      return;
    }

    try {
      setApplyStatus({ type: "idle", message: "Submitting..." });
      await submitContact({
        source: "visa-apply-online",
        fullName: "Visa applicant",
        email,
        phone: phoneDigits,
        subject: `${destination.name} visa application enquiry`,
        message: [
          `${destination.name} visa application enquiry`,
          `Visa type: ${visaType}`,
          `Travelers: ${travelers}`,
          `Starting price: ${destination.startingFrom}`,
        ].join("\n"),
        travelers: Number(travelers),
      });
      setApplyStatus({
        type: "success",
        message: "Request received. The visa desk will contact you.",
      });
      formElement.reset();
    } catch {
      setApplyStatus({
        type: "error",
        message: "Could not submit right now. Please try again shortly.",
      });
    }
  }

  async function handleCallSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const fullName = String(form.get("fullName") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const phoneDigits = phone.replace(/\D/g, "");

    if (fullName.length < 2 || !isEmail(email) || phoneDigits.length < 7) {
      setCallStatus({
        type: "error",
        message: "Enter a valid name, email, and contact number.",
      });
      return;
    }

    try {
      setCallStatus({ type: "idle", message: "Submitting..." });
      await submitContact({
        source: "visa-call-request",
        fullName,
        email,
        phone: phoneDigits,
        subject: `${destination.name} visa call request`,
        message: `Call back requested for ${destination.name} visa support.`,
      });
      setCallStatus({
        type: "success",
        message: "Request received. We will call you back.",
      });
      formElement.reset();
    } catch {
      setCallStatus({
        type: "error",
        message: "Could not submit right now. Please try again shortly.",
      });
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
      <div className="rounded-lg bg-brand-sand px-4 py-3 text-sm font-bold text-brand-navy">
        It takes less than 2 minutes to apply.
      </div>

      <ContactAccordion
        title="Apply Online"
        open={openPanel === "apply"}
        onToggle={() => setOpenPanel(openPanel === "apply" ? "call" : "apply")}
      >
        <form className="grid gap-4" onSubmit={handleApplySubmit} noValidate>
          <Field label="Email ID" icon={<Mail aria-hidden="true" />}>
            <input
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="name@example.com"
              className={fieldClassName}
            />
          </Field>
          <Field label="Contact No" icon={<Phone aria-hidden="true" />}>
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="Contact number"
              className={fieldClassName}
            />
          </Field>
          <Field label="Visa type" icon={<ChevronRight aria-hidden="true" />}>
            <select name="visaType" className={fieldClassName} defaultValue="">
              <option value="" disabled>
                Select visa type
              </option>
              {destination.visaTypes.map((visaType) => (
                <option key={visaType.title} value={visaType.title}>
                  {visaType.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Travellers" icon={<Users aria-hidden="true" />}>
            <input
              name="travelers"
              type="number"
              min={1}
              max={50}
              inputMode="numeric"
              defaultValue="1"
              className={fieldClassName}
            />
          </Field>
          <div className="text-right text-2xl font-black text-brand-navy dark:text-white">
            {destination.startingFrom}
          </div>
          <button type="submit" className={primaryButtonClassName}>
            Apply now
          </button>
          <FormMessage status={applyStatus} />
        </form>
      </ContactAccordion>

      <ContactAccordion
        title="Let us Call You"
        open={openPanel === "call"}
        onToggle={() => setOpenPanel(openPanel === "call" ? "apply" : "call")}
      >
        <form className="grid gap-4" onSubmit={handleCallSubmit} noValidate>
          <Field label="Name" icon={<User aria-hidden="true" />}>
            <input
              name="fullName"
              type="text"
              autoComplete="name"
              placeholder="Your name"
              className={fieldClassName}
            />
          </Field>
          <Field label="Email Id" icon={<Mail aria-hidden="true" />}>
            <input
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="name@example.com"
              className={fieldClassName}
            />
          </Field>
          <Field label="Contact Number" icon={<Phone aria-hidden="true" />}>
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="Contact number"
              className={fieldClassName}
            />
          </Field>
          <button type="submit" className={primaryButtonClassName}>
            Submit
          </button>
          <FormMessage status={callStatus} />
        </form>
      </ContactAccordion>

      <ContactCard
        icon={<MessageCircle aria-hidden="true" />}
        label="Visa on WhatsApp"
        value="+91 8879008992"
      />
      <ContactCard
        icon={<PhoneCall aria-hidden="true" />}
        label="Call us on"
        value="02240666444"
      />
      <ContactCard
        icon={<Clock3 aria-hidden="true" />}
        label="Timing"
        value="9am to 9pm"
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-soft bg-background p-3 dark:bg-black">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-brand-brown">
        {label}
      </p>
      <p className="mt-1 font-black text-brand-navy dark:text-white">
        {value}
      </p>
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
      {open ? (
        <div className="border-t border-border-soft px-5 py-5">{children}</div>
      ) : null}
    </section>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="flex items-center gap-2 text-sm font-black text-brand-navy dark:text-white">
        <span className="text-brand-blue dark:text-brand-sand [&>svg]:size-4">
          {icon}
        </span>
        {label}
      </span>
      {children}
    </label>
  );
}

function ContactCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg bg-surface px-5 py-4 dark:bg-white/[0.05]">
      <span className="text-brand-blue dark:text-brand-sand [&>svg]:size-5">
        {icon}
      </span>
      <span>
        <span className="block text-sm font-semibold text-foreground-muted">
          {label}
        </span>
        <span className="block text-xl font-black text-brand-navy dark:text-white">
          {value}
        </span>
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

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPositiveInteger(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 50;
}

const fieldClassName =
  "min-h-12 w-full rounded-lg border border-border-soft bg-background px-4 text-sm font-semibold text-brand-navy outline-none transition placeholder:text-foreground-muted focus:border-brand-blue focus:ring-2 focus:ring-brand-sky dark:border-white/15 dark:bg-white/10 dark:text-white dark:placeholder:text-white/60 dark:focus:border-brand-sand dark:focus:ring-brand-sand/40";

const primaryButtonClassName =
  "inline-flex min-h-12 items-center justify-center rounded-lg bg-brand-blue px-5 text-sm font-black uppercase tracking-widest text-white shadow-[0_14px_30px_rgb(7_23_57/0.22)] transition hover:bg-brand-navy active:bg-brand-navy dark:bg-brand-sand dark:text-brand-navy dark:hover:bg-brand-sand/90 dark:active:bg-brand-sand/85";
