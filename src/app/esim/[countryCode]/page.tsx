import { ArrowLeft, WifiOff } from "lucide-react";
import Link from "next/link";

import { PaginatedPlanGrid } from "@/components/esim/PaginatedPlanGrid";
import type {
  AirhubPublicCountry,
  AirhubPublicPlan,
} from "@/server/providers/airhub/contracts";
import { getLocalAirhubCountryByCode } from "@/server/providers/airhub/countries";
import { isAirhubError } from "@/server/providers/airhub/errors";
import {
  buildAirhubCountryPlanPageModel,
  type AirhubCountryPlanPageModel,
} from "@/server/providers/airhub/page-model";
import { getVisibleAirhubPlansForCountry } from "@/server/esim/public-plans";

export const dynamic = "force-dynamic";

export default async function EsimCountryPage({
  params,
}: {
  params: Promise<{ countryCode: string }>;
}) {
  const { countryCode } = await params;
  let country: AirhubPublicCountry | null = null;
  let plans: AirhubPublicPlan[] = [];
  let planStatus: "ok" | "disabled" | "fetch_failed" = "ok";

  try {
    country = await getLocalAirhubCountryByCode(countryCode);
  } catch {
    console.error("[esim.country.lookup]", {
      code: "country_lookup_failed",
      routeCountryCode: countryCode,
    });
  }

  if (country) {
    console.info("[esim.country.lookup]", {
      countryCode: country.isoCode,
      countryName: country.name,
    });

    try {
      const listing = await getVisibleAirhubPlansForCountry(country.isoCode);
      plans = listing.plans;
      planStatus = listing.status === "disabled" ? "disabled" : "ok";
    } catch (error) {
      planStatus = "fetch_failed";
      logSafePlanFetchError(error, country.isoCode, country.name);
    }
  }

  const pageModel = buildAirhubCountryPlanPageModel({
    routeCountryCode: countryCode,
    country,
    plans,
    planStatus,
  });
  const displayCountryCode = pageModel.countryCode ?? countryCode.toUpperCase();
  const displayCountryName = pageModel.countryName ?? displayCountryCode;

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
            eSIM plans for {displayCountryName}
          </h1>
          {pageModel.countryName ? (
            <p className="mt-3 text-sm font-bold text-brand-navy/55 dark:text-white/55">
              {displayCountryCode}
            </p>
          ) : null}
        </div>
      </header>

      <section className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-6">
        {pageModel.state === "ready" ? (
          <PaginatedPlanGrid
            plans={pageModel.plans}
            countryCode={displayCountryCode}
          />
        ) : (
          <PlanEmptyState state={pageModel.state} />
        )}
      </section>
    </main>
  );
}

function PlanEmptyState({ state }: { state: AirhubCountryPlanPageModel["state"] }) {
  const copy = getEmptyStateCopy(state);

  return (
    <div className="rounded-lg border border-border-soft bg-surface p-8">
      <WifiOff className="size-10 text-brand-blue" aria-hidden="true" />
      <h2 className="mt-4 text-2xl font-black">{copy.title}</h2>
      <p className="mt-2 max-w-2xl text-brand-navy/60 dark:text-white/60">
        {copy.message}
      </p>
    </div>
  );
}

function getEmptyStateCopy(state: AirhubCountryPlanPageModel["state"]) {
  switch (state) {
    case "country_not_available":
      return {
        title: "Country not available",
        message: "This eSIM destination is not available right now.",
      };
    case "fetch_failed":
      return {
        title: "No plans available right now",
        message: "Plan fetching failed. Please try again later.",
      };
    case "disabled":
      return {
        title: "No plans available right now",
        message: "Plan fetching is disabled. Cached plans will appear here once available.",
      };
    case "empty":
    case "ready":
    default:
      return {
        title: "No plans available right now",
        message: "No eSIM plans were returned for this country.",
      };
  }
}

function logSafePlanFetchError(
  error: unknown,
  countryCode: string,
  countryName: string,
) {
  if (isAirhubError(error)) {
    console.error("[esim.country.plans]", {
      code: error.code,
      status: error.status,
      countryCode,
      countryName,
    });
    return;
  }

  console.error("[esim.country.plans]", {
    code: "unexpected_plan_fetch_error",
    countryCode,
    countryName,
  });
}
