"use client";

import {
  BadgeCheck,
  ChevronRight,
  Clock3,
  FileCheck2,
  ShieldCheck,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { ReactNode } from "react";
import type { VisaDestination, VisaPageContent } from "@/data/visa";
import { VisaContactStack } from "@/components/visa/VisaLeadTools";

type VisaDetailViewProps = {
  page: VisaPageContent;
  destination: VisaDestination;
};

const detailNav = [
  { href: "#visa-types", label: "Types Of Visas" },
  { href: "#documents", label: "Documents" },
  { href: "#process", label: "Process" },
  { href: "#why-us", label: "Why Choose Us" },
  { href: "#sample-visa", label: "Sample Visa" },
  { href: "#faqs", label: "FAQs" },
  { href: "#visit-us", label: "Visit Us" },
];

export function VisaDetailView({ page, destination }: VisaDetailViewProps) {
  const [modal, setModal] = useState<"process" | "sample" | null>(null);

  return (
    <main className="min-h-screen bg-background pb-20 text-foreground">
      <section className="relative isolate overflow-hidden">
        <div className="relative min-h-[520px]">
          <Image
            src={destination.image}
            alt={destination.alt}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(255_250_242/0.98)_0%,rgb(255_250_242/0.86)_38%,rgb(255_250_242/0.24)_70%,rgb(7_23_57/0.2)_100%)] dark:bg-[linear-gradient(90deg,rgb(0_0_0/0.96)_0%,rgb(0_0_0/0.78)_42%,rgb(7_23_57/0.35)_100%)]" />
          <div className="section-shell relative z-10 flex min-h-[520px] flex-col justify-center gap-9 pb-12 pt-32">
            <nav
              aria-label="Breadcrumb"
              className="flex flex-wrap items-center gap-2 text-sm font-semibold text-brand-navy/78 dark:text-white/78"
            >
              <Link href="/" className="transition hover:text-brand-blue">
                Home
              </Link>
              <ChevronRight aria-hidden="true" className="size-4" />
              <Link
                href={`/${page.slug}`}
                className="transition hover:text-brand-blue"
              >
                Visa
              </Link>
              <ChevronRight aria-hidden="true" className="size-4" />
              <span className="text-brand-blue dark:text-brand-sand">
                {destination.name} Visa
              </span>
            </nav>
            <div className="max-w-3xl">
              <h1 className="font-serif text-4xl font-black text-brand-navy sm:text-6xl dark:text-white">
                {destination.detailTitle}
              </h1>
              <div className="mt-7 inline-flex max-w-full items-center gap-3 rounded-r-full bg-brand-blue px-5 py-3 text-sm font-black text-white shadow-lg dark:text-brand-navy">
                <BadgeCheck
                  aria-hidden="true"
                  className="size-5 text-brand-sand dark:text-brand-navy"
                />
                {destination.approvalText}
              </div>
              <div className="mt-7 grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
                <HeroMetric label="Processing time" value={destination.processingTime} />
                <HeroMetric label="Starting from" value={destination.startingFrom} />
              </div>
              <div className="mt-7 inline-flex items-center gap-3 rounded-full bg-brand-navy px-5 py-3 text-sm font-black text-white shadow-lg dark:bg-brand-sand dark:text-brand-navy">
                <ShieldCheck aria-hidden="true" className="size-5" />
                {destination.agentBadge}
              </div>
            </div>
          </div>
        </div>
      </section>

      <nav className="sticky top-0 z-30 overflow-x-auto border-y border-border-soft bg-brand-sky/82 backdrop-blur-xl dark:bg-brand-navy/88">
        <div className="section-shell flex min-w-max gap-2 py-3">
          {detailNav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-lg px-4 py-2 text-sm font-black text-brand-navy transition hover:bg-white dark:text-white dark:hover:bg-white/10"
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>

      <section className="section-shell grid gap-8 pt-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-12">
          <section className="grid gap-4 rounded-lg border border-border-soft bg-surface p-5 dark:bg-white/[0.04]">
            {destination.overview.map((paragraph) => (
              <p
                key={paragraph}
                className="text-base font-semibold leading-7 text-foreground-muted"
              >
                {paragraph}
              </p>
            ))}
          </section>

          <section id="visa-types" className="scroll-mt-28">
            <div className="mb-6 rounded-full bg-[linear-gradient(90deg,#d9c5ff,#2fa8e8,#8277ee)] px-6 py-4 text-center text-lg font-black text-white shadow-lg">
              Guaranteed document review before submission
            </div>
            <h2 className="font-serif text-3xl font-black text-brand-navy dark:text-white">
              Types of {destination.name} Visas
            </h2>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {destination.visaTypes.map((visaType) => (
                <article
                  key={visaType.title}
                  className="overflow-hidden rounded-lg border border-border-soft bg-surface shadow-[0_16px_45px_rgb(7_23_57/0.08)] dark:bg-white/[0.04]"
                >
                  <div className="bg-brand-sky px-4 py-3 dark:bg-brand-blue/40">
                    <h3 className="text-lg font-black text-brand-navy dark:text-white">
                      {visaType.title}
                    </h3>
                    {visaType.popular ? (
                      <span className="mt-2 inline-block bg-brand-blue px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-white">
                        Popular
                      </span>
                    ) : null}
                  </div>
                  <dl className="grid gap-3 p-4 text-sm font-semibold">
                    <VisaTypeRow label="Processing time" value={visaType.processingTime} />
                    <VisaTypeRow label="Stay period" value={visaType.stayPeriod} />
                    <VisaTypeRow label="Validity" value={visaType.validity} />
                    <VisaTypeRow label="Entry" value={visaType.entry} />
                    <VisaTypeRow label="Fees" value={visaType.fee} strong />
                  </dl>
                </article>
              ))}
            </div>
          </section>

          <section id="documents" className="scroll-mt-28">
            <h2 className="font-serif text-3xl font-black text-brand-navy dark:text-white">
              Documents Required for {destination.name} Visa
            </h2>
            <div className="mt-5 grid gap-4">
              {destination.documents.map((group) => (
                <details
                  key={group.title}
                  className="rounded-lg border border-border-soft bg-brand-sand/58 p-5 dark:bg-white/[0.05]"
                  open
                >
                  <summary className="cursor-pointer text-lg font-black text-brand-navy dark:text-white">
                    {group.title}
                  </summary>
                  <ul className="mt-4 grid gap-3 text-sm font-semibold text-foreground-muted">
                    {group.items.map((item) => (
                      <li key={item} className="flex gap-3">
                        <FileCheck2
                          aria-hidden="true"
                          className="mt-0.5 size-4 shrink-0 text-brand-blue dark:text-brand-sand"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </section>

          <section id="process" className="scroll-mt-28">
            <div className="grid gap-4 md:grid-cols-2">
              <ActionStrip
                title={`Detailed ${destination.name} Visa process & Requirements`}
                action="How to apply"
                onClick={() => setModal("process")}
              />
              <div id="sample-visa" className="scroll-mt-28">
                <ActionStrip
                  title={`View ${destination.name} Sample Visa Copy`}
                  action="View sample"
                  onClick={() => setModal("sample")}
                />
              </div>
            </div>
            <div className="mt-10 rounded-lg bg-brand-brown/72 p-6 text-brand-navy shadow-inner">
              <h2 className="text-center font-serif text-2xl font-black">
                Applying for {destination.name} Visa Online through us is simple
              </h2>
              <ol className="mt-8 grid gap-6 md:grid-cols-4">
                {destination.processSteps.map((step, index) => (
                  <li key={step.title} className="relative text-center">
                    <span className="mx-auto grid size-12 place-items-center rounded-full bg-white text-lg font-black shadow-lg">
                      {index + 1}
                    </span>
                    <h3 className="mt-4 font-black">{step.title}</h3>
                    <p className="mt-2 text-sm font-semibold leading-6">
                      {step.description}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section id="why-us" className="scroll-mt-28">
            <h2 className="font-serif text-3xl font-black text-brand-navy dark:text-white">
              Why Choose Fly Time
            </h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {destination.whyChooseUs.map((item) => (
                <div
                  key={item}
                  className="rounded-lg border border-border-soft bg-surface p-5 font-bold text-brand-navy dark:bg-white/[0.04] dark:text-white"
                >
                  <BadgeCheck
                    aria-hidden="true"
                    className="mb-3 size-5 text-brand-blue dark:text-brand-sand"
                  />
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section id="faqs" className="scroll-mt-28">
            <h2 className="font-serif text-3xl font-black text-brand-navy dark:text-white">
              {destination.name} Visa FAQs
            </h2>
            <div className="mt-5 grid gap-3">
              {destination.faqs.map((faq) => (
                <details
                  key={faq.question}
                  className="rounded-lg border border-border-soft bg-brand-sky/60 p-5 dark:bg-white/[0.05]"
                >
                  <summary className="cursor-pointer font-black text-brand-navy dark:text-white">
                    {faq.question}
                  </summary>
                  <p className="mt-3 text-sm font-semibold leading-6 text-foreground-muted">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </section>

          <InfoSection
            id="visit-us"
            title="Visit Us"
            icon={<Clock3 aria-hidden="true" />}
            text={destination.visitUsNote}
          />
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <VisaContactStack destination={destination} />
        </aside>
      </section>

      {modal ? (
        <VisaModal
          type={modal}
          destination={destination}
          onClose={() => setModal(null)}
        />
      ) : null}
    </main>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-brand-navy/75 dark:text-white/70">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black text-brand-navy dark:text-white">
        {value}
      </p>
    </div>
  );
}

function VisaTypeRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-foreground-muted">{label}:</dt>
      <dd
        className={
          strong
            ? "text-xl font-black text-brand-blue dark:text-brand-sand"
            : "text-right text-brand-navy dark:text-white"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function ActionStrip({
  title,
  action,
  onClick,
}: {
  title: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-full min-h-24 w-full items-center justify-between gap-4 rounded-lg border border-border-soft bg-brand-navy px-5 py-4 text-left font-black text-white shadow-[0_18px_42px_rgb(7_23_57/0.22)] transition hover:-translate-y-0.5 hover:bg-brand-blue dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/[0.1]"
    >
      <span className="min-w-0 flex-1 text-sm font-extrabold leading-snug sm:text-base">
        {title}
      </span>
      <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-brand-sand px-4 py-2 text-xs font-black uppercase tracking-widest text-brand-navy shadow-sm transition group-hover:bg-white">
        {action}
      </span>
    </button>
  );
}

function InfoSection({
  id,
  title,
  icon,
  text,
}: {
  id: string;
  title: string;
  icon: ReactNode;
  text: string;
}) {
  return (
    <section id={id} className="scroll-mt-28 rounded-lg border border-border-soft bg-surface p-6 dark:bg-white/[0.04]">
      <div className="flex items-center gap-3">
        <span className="text-brand-blue dark:text-brand-sand [&>svg]:size-5">
          {icon}
        </span>
        <h2 className="font-serif text-3xl font-black text-brand-navy dark:text-white">
          {title}
        </h2>
      </div>
      <p className="mt-4 text-sm font-semibold leading-7 text-foreground-muted">
        {text}
      </p>
    </section>
  );
}

function VisaModal({
  type,
  destination,
  onClose,
}: {
  type: "process" | "sample";
  destination: VisaDestination;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/68 p-4 backdrop-blur-sm">
      <section className="relative max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-surface p-5 shadow-[0_24px_80px_rgb(0_0_0/0.34)] dark:bg-brand-navy">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-brand-navy text-white dark:bg-white dark:text-brand-navy"
          aria-label="Close modal"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
        {type === "process" ? (
          <ProcessGraphic destination={destination} />
        ) : (
          <SampleVisaGraphic destination={destination} />
        )}
      </section>
    </div>
  );
}

function ProcessGraphic({ destination }: { destination: VisaDestination }) {
  return (
    <div className="rounded-lg bg-[linear-gradient(135deg,#c2e8ff,#77e4ca,#f2d19d)] p-8 text-center text-brand-navy">
      <p className="text-sm font-black uppercase tracking-[0.18em]">
        Easy steps to get your
      </p>
      <h2 className="mt-2 font-serif text-4xl font-black">
        {destination.name} Visa
      </h2>
      <ol className="mx-auto mt-8 grid max-w-md gap-5 text-left">
        {destination.processSteps.slice(0, 3).map((step, index) => (
          <li
            key={step.title}
            className="grid grid-cols-[56px_1fr] items-center gap-4 rounded-lg bg-white/65 p-4 shadow"
          >
            <span className="grid size-12 place-items-center rounded-full bg-brand-navy text-xl font-black text-white">
              {index + 1}
            </span>
            <span>
              <span className="block font-black">{step.title}</span>
              <span className="block text-sm font-semibold">
                {step.description}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-8 rounded-lg bg-brand-blue px-5 py-4 text-lg font-black uppercase text-white">
        Apply now
      </p>
    </div>
  );
}

function SampleVisaGraphic({ destination }: { destination: VisaDestination }) {
  return (
    <div className="rounded-lg bg-white p-7 text-brand-navy">
      <div className="flex items-start justify-between gap-6 border-b border-brand-navy/15 pb-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-blue">
            Sample only
          </p>
          <h2 className="mt-2 font-serif text-3xl font-black">
            {destination.name} eVisa
          </h2>
        </div>
        <span className="rounded-full bg-brand-sky px-4 py-2 text-sm font-black">
          {destination.countryCode}
        </span>
      </div>
      <div className="mt-6 grid gap-4">
        {[
          "Entry Permit No",
          "Date and Place of Issue",
          "Full Name",
          "Nationality",
          "Passport No",
          "Allowed to Enter",
        ].map((label) => (
          <div key={label} className="grid grid-cols-[160px_1fr] gap-4">
            <span className="text-sm font-black">{label}</span>
            <span className="h-5 rounded bg-brand-navy/12" />
          </div>
        ))}
      </div>
      <div className="mt-10 rounded-lg border border-dashed border-brand-blue/50 bg-brand-sky/45 p-5 text-center text-sm font-black uppercase tracking-[0.14em] text-brand-blue">
        Placeholder visa sample. Real sample image will be CMS-managed later.
      </div>
    </div>
  );
}
