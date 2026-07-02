import { ArrowLeft, WifiOff } from "lucide-react";
import Link from "next/link";

import { PlanCard } from "@/components/esim/PlanCard";
import { getAirhubPlansForCountry } from "@/server/providers/airhub/plans";

export const dynamic = "force-dynamic";

export default async function EsimCountryPage({
  params,
}: {
  params: Promise<{ countryCode: string }>;
}) {
  const { countryCode } = await params;
  const listing = await getAirhubPlansForCountry(countryCode);
  const displayCountryCode = listing.countryCode.toUpperCase();

  return (
    <main className="min-h-screen bg-background pb-20 pt-32 text-brand-navy dark:text-white">
      <header className="border-y border-border-soft bg-surface">
        <div className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-6">
          <Link
            href="/esim"
            className="inline-flex items-center gap-2 text-sm font-black text-brand-blue"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to countries
          </Link>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-brand-blue dark:text-brand-sand">
            Country eSIM plans
          </p>
          <h1 className="mt-2 font-serif text-4xl font-semibold sm:text-5xl">
            eSIM plans for {displayCountryCode}
          </h1>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-[1180px] gap-5 px-4 py-8 sm:px-6 lg:grid-cols-3">
        {listing.plans.length ? (
          listing.plans.map((plan) => (
            <PlanCard
              key={plan.planCode}
              plan={plan}
              countryCode={displayCountryCode}
            />
          ))
        ) : (
          <div className="rounded-lg border border-border-soft bg-surface p-8 lg:col-span-3">
            <WifiOff className="size-10 text-brand-blue" aria-hidden="true" />
            <h2 className="mt-4 text-2xl font-black">No plans available</h2>
            <p className="mt-2 max-w-2xl text-brand-navy/60 dark:text-white/60">
              {listing.status === "disabled"
                ? "Airhub plan fetching is disabled. Cached plans will appear here once available."
                : "No eSIM plans were returned for this country."}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
