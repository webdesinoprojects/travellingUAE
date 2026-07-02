import { ArrowRight, BadgeCheck, CalendarDays, Wifi } from "lucide-react";
import Link from "next/link";

import type { AirhubPublicPlan } from "@/server/providers/airhub/contracts";

export function PlanCard({
  plan,
  countryCode,
}: {
  plan: AirhubPublicPlan;
  countryCode: string;
}) {
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
          <p className="text-xs font-black uppercase text-brand-blue">
            {plan.planType ?? "eSIM"}
          </p>
          <h2 className="mt-2 text-xl font-black">{plan.planName ?? plan.planCode}</h2>
        </div>
        {plan.phoneNumber ? (
          <span className="rounded-md bg-brand-sky px-2.5 py-1 text-xs font-black text-brand-navy">
            Voice
          </span>
        ) : null}
      </div>

      <dl className="mt-5 grid gap-3 text-sm font-semibold text-brand-navy/68 dark:text-white/68">
        {plan.dataUnit || plan.capacity ? (
          <div className="flex items-center gap-2">
            <Wifi className="size-4 text-brand-blue" aria-hidden="true" />
            <span>{plan.capacity ?? plan.dataUnit}</span>
          </div>
        ) : null}
        {plan.validity ? (
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-brand-blue" aria-hidden="true" />
            <span>{plan.validity}</span>
          </div>
        ) : null}
        {plan.connectivity ? (
          <div className="flex items-center gap-2">
            <BadgeCheck className="size-4 text-brand-blue" aria-hidden="true" />
            <span>{plan.connectivity}</span>
          </div>
        ) : null}
      </dl>

      {plan.additionalInfo ? (
        <p className="mt-5 line-clamp-3 text-sm font-semibold text-brand-navy/58 dark:text-white/58">
          {plan.additionalInfo}
        </p>
      ) : null}

      <div className="mt-auto flex items-end justify-between gap-4 pt-6">
        <div>
          <span className="block text-xs font-bold uppercase text-brand-navy/50 dark:text-white/50">
            From
          </span>
          <span className="text-2xl font-black">{price}</span>
        </div>
        <Link
          href={`/esim/checkout?countryCode=${encodeURIComponent(countryCode)}&planCode=${encodeURIComponent(plan.planCode)}`}
          aria-disabled={!plan.price || !plan.currency}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-blue px-4 text-sm font-extrabold text-white transition hover:bg-brand-navy aria-disabled:pointer-events-none aria-disabled:opacity-50"
        >
          Select
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
