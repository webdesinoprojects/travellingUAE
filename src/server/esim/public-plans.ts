import "server-only";

import {
  indexControlsByPlanCode,
  toVisiblePublicPlans,
} from "@/server/admin/esim-visibility-helpers";
import {
  getAirhubPlansForCountry,
  type AirhubPlanListing,
} from "@/server/providers/airhub/plans";

import { readPlanControls } from "./plan-controls";

/**
 * Public plan listing that respects admin visibility. Wraps the raw
 * provider/cache fetch and drops hidden plans (and orders featured-first). The
 * returned plans are the original public DTOs — no admin fields are attached.
 *
 * Every public entry point (country page, plans API, checkout) uses THIS instead
 * of getAirhubPlansForCountry so hidden plans never reach customers.
 */
export async function getVisibleAirhubPlansForCountry(
  countryCode: string,
): Promise<AirhubPlanListing> {
  const listing = await getAirhubPlansForCountry(countryCode);

  if (listing.status !== "ok" || listing.plans.length === 0) {
    return listing;
  }

  const controls = await readPlanControls(listing.countryCode);
  if (controls.length === 0) {
    return listing;
  }

  const index = indexControlsByPlanCode(controls);
  return { ...listing, plans: toVisiblePublicPlans(listing.plans, index) };
}
