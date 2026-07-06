"use client";

import { ArrowRight, BadgeCheck, CalendarDays, Info, Wifi } from "lucide-react";
import Link from "next/link";

import { extractPlanFeatures } from "@/server/providers/airhub/plan-display";
import type { AirhubPublicPlan } from "@/server/providers/airhub/contracts";

export function PlanCard({
  plan,
  countryCode,
  onViewDetails,
}: {
  plan: AirhubPublicPlan;
  countryCode: string;
  onViewDetails: (plan: AirhubPublicPlan) => void;
}) {
  const features = extractPlanFeatures(plan);
  const price =
    plan.price != null && plan.currency
      ? `${plan.currency.toUpperCase()} ${plan.price.toLocaleString("en", {
          maximumFractionDigits: 2,
        })}`
      : "Price unavailable";

  return (
    <article className="flex min-h-full flex-col rounded-lg border border-border-soft bg-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {features.coverage ? (
            <p className="text-xs font-black uppercase text-brand-blue">{features.coverage}</p>
          ) : null}
          <h2 className="mt-2 text-xl font-black break-words">{plan.planName ?? plan.planCode}</h2>
        </div>
        {features.includesCalls ? (
          <span className="shrink-0 rounded-md bg-brand-sky px-2.5 py-1 text-xs font-black text-brand-navy">
            Calls
          </span>
        ) : null}
      </div>

      <dl className="mt-5 grid gap-3 text-sm font-semibold text-brand-navy/68 dark:text-white/68">
        {features.dataLabel ? (
          <div className="flex items-center gap-2">
            <Wifi className="size-4 shrink-0 text-brand-blue" aria-hidden="true" />
            <span className="min-w-0 break-words">{features.dataLabel}</span>
          </div>
        ) : null}
        {features.validityLabel ? (
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 shrink-0 text-brand-blue" aria-hidden="true" />
            <span className="min-w-0 break-words">{features.validityLabel}</span>
          </div>
        ) : null}
        {features.operator ? (
          <div className="flex items-center gap-2">
            <BadgeCheck className="size-4 shrink-0 text-brand-blue" aria-hidden="true" />
            <span className="min-w-0 break-words">{features.operator}</span>
          </div>
        ) : null}
      </dl>

      <div className="mt-auto grid gap-3 pt-6">
        <div>
          <span className="block text-xs font-bold uppercase text-brand-navy/50 dark:text-white/50">
            From
          </span>
          <span className="text-2xl font-black">{price}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onViewDetails(plan)}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-border-soft bg-white px-3 text-sm font-extrabold text-brand-navy transition hover:bg-[#fffaf2] dark:bg-white/10 dark:text-white dark:hover:bg-white/[0.14]"
          >
            <Info className="size-4 shrink-0" aria-hidden="true" />
            Details
          </button>
          <Link
            href={`/esim/checkout?countryCode=${encodeURIComponent(countryCode)}&planCode=${encodeURIComponent(plan.planCode)}`}
            aria-disabled={!plan.price || !plan.currency}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-brand-blue px-3 text-sm font-extrabold text-white transition hover:bg-brand-navy aria-disabled:pointer-events-none aria-disabled:opacity-50"
          >
            Select
            <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
