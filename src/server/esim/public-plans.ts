import "server-only";

import {
  indexControlsByPlanCode,
  toVisiblePublicPlans,
} from "@/server/admin/esim-visibility-helpers";
import {
  getAirhubPlansForCountry,
  type AirhubPlanListing,
} from "@/server/providers/airhub/plans";
import type { AirhubPublicPlan } from "@/server/providers/airhub/contracts";

import { readPlanControls } from "./plan-controls";
import {
  applyPricingToPlan,
  stripInternalPricing,
  type PricedPlan,
} from "./pricing-helpers";
import { readActivePricingRules } from "./pricing-rules";

export type PricedAirhubPublicPlan = PricedPlan<AirhubPublicPlan>;

export type PricedAirhubPlanListing = Omit<AirhubPlanListing, "plans"> & {
  plans: PricedAirhubPublicPlan[];
};

/**
 * Public plan listing that respects admin visibility. Wraps the raw
 * provider/cache fetch and drops hidden plans (and orders featured-first). The
 * returned plans are public DTOs with final customer prices only. Pricing rule,
 * supplier, and markup fields stay server-only.
 *
 * Every public entry point (country page, plans API, checkout) uses THIS instead
 * of getAirhubPlansForCountry so hidden plans never reach customers.
 */
export async function getVisibleAirhubPlansForCountry(
  countryCode: string,
): Promise<AirhubPlanListing> {
  const listing = await getVisiblePricedAirhubPlansForCountry(countryCode);

  return {
    ...listing,
    plans: listing.plans.map(stripInternalPricing),
  };
}

export async function getVisiblePricedAirhubPlansForCountry(
  countryCode: string,
): Promise<PricedAirhubPlanListing> {
  const listing = await getAirhubPlansForCountry(countryCode);

  if (listing.status !== "ok" || listing.plans.length === 0) {
    return { ...listing, plans: [] };
  }

  const controls = await readPlanControls(listing.countryCode);
  const index = indexControlsByPlanCode(controls);
  const visiblePlans =
    controls.length === 0 ? listing.plans : toVisiblePublicPlans(listing.plans, index);
  const pricingRules = await readActivePricingRules();

  return {
    ...listing,
    plans: visiblePlans.map((plan) =>
      applyPricingToPlan({
        plan,
        countryCode: listing.countryCode,
        rules: pricingRules,
      }),
    ),
  };
}
