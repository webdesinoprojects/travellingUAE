import { ArrowLeft, CreditCard } from "lucide-react";
import Link from "next/link";

import { EsimCheckoutForm } from "@/components/esim/EsimCheckoutForm";
import { getAirhubPlansForCountry } from "@/server/providers/airhub/plans";

export const dynamic = "force-dynamic";

export default async function EsimCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ countryCode?: string; planCode?: string }>;
}) {
  const { countryCode, planCode } = await searchParams;
  const normalizedCountryCode = countryCode?.trim().toUpperCase();
  const normalizedPlanCode = planCode?.trim();
  const listing = normalizedCountryCode
    ? await getAirhubPlansForCountry(normalizedCountryCode)
    : null;
  const plan =
    listing?.plans.find((item) => item.planCode === normalizedPlanCode) ?? null;

  return (
    <main className="min-h-screen bg-background pb-20 pt-32 text-brand-navy dark:text-white">
      <section className="mx-auto grid w-full max-w-[1120px] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div>
          <Link
            href={normalizedCountryCode ? `/esim/${normalizedCountryCode.toLowerCase()}` : "/esim"}
            className="inline-flex items-center gap-2 text-sm font-black text-brand-blue"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to plans
          </Link>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.16em] text-brand-blue dark:text-brand-sand">
            eSIM checkout
          </p>
          <h1 className="mt-2 font-serif text-4xl font-semibold sm:text-5xl">
            Complete your eSIM payment
          </h1>

          {plan ? (
            <div className="mt-8 rounded-lg border border-border-soft bg-surface p-5 shadow-sm">
              <div className="flex items-center gap-2 text-lg font-black">
                <CreditCard className="size-5 text-brand-blue" aria-hidden="true" />
                Order summary
              </div>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <SummaryItem label="Plan" value={plan.planName ?? plan.planCode} />
                <SummaryItem label="Country" value={plan.countryName ?? normalizedCountryCode ?? ""} />
                <SummaryItem label="Plan code" value={plan.planCode} />
                <SummaryItem
                  label="Amount"
                  value={
                    plan.price != null && plan.currency
                      ? `${plan.currency} ${plan.price.toLocaleString("en", {
                          maximumFractionDigits: 2,
                        })}`
                      : "Unavailable"
                  }
                />
              </dl>
            </div>
          ) : (
            <div className="mt-8 rounded-lg border border-border-soft bg-surface p-8">
              <h2 className="text-2xl font-black">Plan unavailable</h2>
              <p className="mt-2 text-brand-navy/60 dark:text-white/60">
                Choose an eSIM plan again to continue checkout.
              </p>
            </div>
          )}
        </div>

        {plan && normalizedCountryCode ? (
          <EsimCheckoutForm plan={plan} countryCode={normalizedCountryCode} />
        ) : null}
      </section>
    </main>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-soft bg-white p-4 dark:bg-surface-muted">
      <dt className="text-xs font-black uppercase text-brand-navy/45 dark:text-white/45">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-bold">{value}</dd>
    </div>
  );
}
