"use client";

import {
  Info,
  PhoneCall,
  RefreshCw,
  Router,
  Signal,
  Sparkles,
  Wifi,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { extractPlanFeatures } from "@/server/providers/airhub/plan-display";
import type { AirhubPublicPlan } from "@/server/providers/airhub/contracts";

type Tab = "overview" | "features" | "more";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "features", label: "Features" },
  { id: "more", label: "More information" },
];

/**
 * Airhub-dashboard-style plan details modal. Every value shown comes straight
 * from the real AirhubPublicPlan/plan-display fields - nothing here invents a
 * plan tier, network generation, APN, or compatibility claim that Airhub did
 * not actually return. All provider description text is rendered as plain
 * React text nodes (never dangerouslySetInnerHTML), so raw markup can never
 * reach the page.
 */
export function PlanDetailsModal({
  plan,
  countryCode,
  onClose,
}: {
  plan: AirhubPublicPlan;
  countryCode: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const features = extractPlanFeatures(plan);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const price =
    plan.price != null && plan.currency
      ? `${plan.currency.toUpperCase()} ${plan.price.toLocaleString("en", { maximumFractionDigits: 2 })}`
      : null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-brand-navy/50 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${plan.countryName ?? countryCode} eSIM plan details`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border-soft bg-surface shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="relative shrink-0 bg-brand-navy px-5 pb-5 pt-6 text-white dark:bg-black">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close plan details"
            className="absolute right-4 top-4 grid size-9 place-items-center rounded-lg text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
          <div className="grid size-10 place-items-center rounded-full bg-white/10">
            <Wifi className="size-5" aria-hidden="true" />
          </div>
          <h2 className="mt-3 pr-10 text-lg font-black break-words">
            {plan.countryName ?? countryCode} eSIM plan
          </h2>
          <p className="mt-1 truncate text-sm font-semibold text-white/70">
            {plan.planName ?? plan.planCode}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {features.dataLabel ? <StatPill label="Data" value={features.dataLabel} /> : null}
            {features.validityLabel ? <StatPill label="Validity" value={features.validityLabel} /> : null}
            {features.countriesCovered ? (
              <StatPill label="Coverage" value={features.countriesCovered} />
            ) : null}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 gap-1 border-b border-border-soft bg-surface px-3 pt-3">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-current={tab === item.id ? "true" : undefined}
              className={[
                "min-h-10 flex-1 rounded-t-lg px-2 text-xs font-black transition sm:text-sm",
                tab === item.id
                  ? "border border-b-0 border-border-soft bg-white text-brand-navy dark:bg-black dark:text-white"
                  : "text-brand-navy/50 hover:text-brand-navy dark:text-white/50 dark:hover:text-white",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {tab === "overview" ? <OverviewTab features={features} /> : null}
          {tab === "features" ? <FeaturesTab features={features} /> : null}
          {tab === "more" ? <MoreInfoTab features={features} /> : null}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border-soft bg-surface p-4">
          <Link
            href={`/esim/checkout?countryCode=${encodeURIComponent(countryCode)}&planCode=${encodeURIComponent(plan.planCode)}`}
            aria-disabled={!price}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-brand-blue px-5 text-sm font-extrabold text-white transition hover:bg-brand-navy aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:bg-brand-sand dark:text-brand-navy"
          >
            {price ? `Select plan - ${price}` : "Plan unavailable"}
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-white/10 px-2 py-2 text-center">
      <p className="truncate text-sm font-black">{value}</p>
      <p className="text-[11px] font-bold uppercase tracking-wide text-white/60">{label}</p>
    </div>
  );
}

function OverviewTab({ features }: { features: ReturnType<typeof extractPlanFeatures> }) {
  const rows: Array<{ icon: typeof Signal; label: string; value: string }> = [];
  if (features.coverage) rows.push({ icon: Signal, label: "Plan coverage", value: features.coverage });
  if (features.operator) rows.push({ icon: Router, label: "Operator", value: features.operator });
  if (features.travelDateRequirement) {
    rows.push({ icon: Info, label: "Travel date requirement", value: features.travelDateRequirement });
  }
  rows.push({ icon: Sparkles, label: "Plan code", value: features.planCode });

  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <InfoRow key={row.label} icon={row.icon} label={row.label} value={row.value} />
      ))}
    </div>
  );
}

function FeaturesTab({ features }: { features: ReturnType<typeof extractPlanFeatures> }) {
  const rows: Array<{ icon: typeof PhoneCall; label: string; value: string }> = [];
  if (features.includesCalls != null) {
    rows.push({
      icon: PhoneCall,
      label: "Calls & text",
      value: features.includesCalls ? "Included with this plan" : "Data only (no calls/SMS)",
    });
  }
  if (features.renewalAvailable != null) {
    rows.push({
      icon: RefreshCw,
      label: "Renewal",
      value: features.renewalAvailable ? "Renewal available" : "One-time plan (no renewal)",
    });
  }

  if (rows.length === 0) {
    return (
      <EmptyNote text="No additional plan features were returned by the provider for this plan." />
    );
  }

  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <InfoRow key={row.label} icon={row.icon} label={row.label} value={row.value} />
      ))}
    </div>
  );
}

function MoreInfoTab({ features }: { features: ReturnType<typeof extractPlanFeatures> }) {
  const { description } = features;

  if (description.sections.length === 0 && !description.plainText) {
    return <EmptyNote text="The provider did not return package details for this plan." />;
  }

  if (description.sections.length === 0) {
    return (
      <p className="text-sm font-semibold leading-6 text-brand-navy/75 dark:text-white/75">
        {description.plainText}
      </p>
    );
  }

  return (
    <div className="grid gap-5">
      {description.sections.map((section, index) => (
        <div key={`${section.heading ?? "section"}-${index}`}>
          {section.heading ? (
            <h3 className="text-sm font-black text-brand-navy dark:text-white">{section.heading}</h3>
          ) : null}
          <ul className="mt-2 grid gap-1.5">
            {section.items.map((item, itemIndex) => (
              <li
                key={itemIndex}
                className="flex items-start gap-2 text-sm font-semibold leading-6 text-brand-navy/75 dark:text-white/75"
              >
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-blue dark:bg-brand-sand" />
                <span className="min-w-0 break-words">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Signal;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border-soft bg-white p-3 dark:bg-white/[0.04]">
      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-navy text-white dark:bg-brand-sand dark:text-brand-navy">
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-wide text-brand-navy/50 dark:text-white/50">
          {label}
        </p>
        <p className="mt-0.5 break-words text-sm font-bold text-brand-navy dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed border-border-soft bg-white/60 p-4 text-sm font-semibold text-brand-navy/60 dark:bg-white/[0.04] dark:text-white/60">
      {text}
    </p>
  );
}
