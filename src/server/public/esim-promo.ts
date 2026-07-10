import "server-only";

import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/server/supabase/client";
import { getLocalAirhubCountryByCode } from "@/server/providers/airhub/countries";
import { readPlanControls } from "@/server/esim/plan-controls";
import { readActivePricingRules } from "@/server/esim/pricing-rules";
import type { PlanControlRow } from "@/server/admin/esim-visibility-helpers";
import type {
  AirhubPublicCountry,
  AirhubPublicPlan,
} from "@/server/providers/airhub/contracts";

import {
  PROMO_MAX_CARDS,
  buildFallbackPromoCards,
  buildPromoCandidateCodes,
  buildPromoContent,
  buildPromoHref,
  derivePromoPlanDetails,
  type EsimPromoCard,
  type EsimPromoContent,
} from "./esim-promo-helpers";

/**
 * Homepage eSIM promo data source.
 *
 * CACHE-ONLY: reads exclusively from Supabase (airhub_countries,
 * airhub_plan_cache, airhub_plan_controls, esim_pricing_rules) and admin-set
 * flags. It NEVER calls the Airhub provider — there is no import of the Airhub
 * client / getAirhubPlansForCountry here, so a cache miss yields no price rather
 * than a live fetch. On any failure it degrades to static fallback cards so the
 * homepage always renders.
 */

type PlanCacheRow = {
  country_code: string | null;
  plans: unknown;
};

export async function getEsimPromoContent(): Promise<EsimPromoContent> {
  if (!hasSupabaseAdminEnv()) {
    return buildPromoContent(buildFallbackPromoCards());
  }

  try {
    const cards = await buildPromoCardsFromCache();
    // If nothing resolved (fresh env, all hidden), show curated fallback.
    return buildPromoContent(cards.length > 0 ? cards : buildFallbackPromoCards());
  } catch (error) {
    console.error("[home.esim.promo]", {
      code: "promo_build_failed",
      message: error instanceof Error ? error.message : "unknown",
    });
    return buildPromoContent(buildFallbackPromoCards());
  }
}

async function buildPromoCardsFromCache(): Promise<EsimPromoCard[]> {
  // 1. Admin picks which countries appear by featuring them (airhub_countries.
  //    is_featured + sort_order). Featured countries come first; the curated
  //    list backfills any remaining slots. Nothing featured => curated list.
  const featuredCodes = await readFeaturedVisibleCountryCodes();
  const candidateCodes = buildPromoCandidateCodes(featuredCodes);

  // 2. Resolve each candidate from admin-controlled data. This already respects
  //    airhub_countries.is_visible (returns null when hidden/missing) and yields
  //    the display name + flag + canonical ISO code. De-dupe by canonical ISO
  //    (handles UK/GB) and cap at the promo card limit.
  const resolved = await Promise.all(
    candidateCodes.map(async (code) => {
      const country = await getLocalAirhubCountryByCode(code).catch(() => null);
      return { promoCode: code, country };
    }),
  );

  const visible: Array<{ promoCode: string; country: AirhubPublicCountry }> = [];
  const seenIso = new Set<string>();
  for (const entry of resolved) {
    if (!entry.country) continue;
    const iso = entry.country.isoCode.toUpperCase();
    if (seenIso.has(iso)) continue;
    seenIso.add(iso);
    visible.push({ promoCode: entry.promoCode, country: entry.country });
    if (visible.length >= PROMO_MAX_CARDS) break;
  }

  if (visible.length === 0) {
    return [];
  }

  // 3. Load cached plans, plan controls and pricing rules once (cache-only).
  const planCacheCodes = new Set<string>();
  for (const entry of visible) {
    planCacheCodes.add(entry.country.isoCode.toUpperCase());
    planCacheCodes.add(entry.promoCode.toUpperCase());
  }

  const [plansByCountry, controls, pricingRules] = await Promise.all([
    readCachedPlansByCountry([...planCacheCodes]),
    readPlanControls(),
    readActivePricingRules(),
  ]);

  const controlsByCountry = groupControlsByCountry(controls);

  // 4. Build one card per visible country, in the resolved order.
  return visible.map((entry) => {
    const countryCode = entry.country.isoCode.toUpperCase();
    const plans =
      plansByCountry.get(countryCode) ??
      plansByCountry.get(entry.promoCode.toUpperCase()) ??
      [];
    const countryControls = controlsByCountry.get(countryCode) ?? [];

    const details = derivePromoPlanDetails({
      countryCode,
      plans,
      controls: countryControls,
      pricingRules,
    });

    const card: EsimPromoCard = {
      countryCode,
      countryName: entry.country.name,
      flagUrl: entry.country.flagUrl ?? entry.country.globalFlagUrl ?? null,
      href: buildPromoHref(countryCode),
    };
    if (details.startingPriceLabel) card.startingPriceLabel = details.startingPriceLabel;
    if (details.dataLabel) card.dataLabel = details.dataLabel;
    if (details.validityLabel) card.validityLabel = details.validityLabel;

    return card;
  });
}

/**
 * Read the admin-featured, visible country ISO codes (cache/admin data only),
 * ordered by sort_order then name — the admin's chosen promo countries. Reads a
 * generous number so canonical de-duplication + the card cap can be applied
 * upstream. Never reads plan/pricing internals.
 */
async function readFeaturedVisibleCountryCodes(): Promise<string[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("airhub_countries")
    .select("iso_code")
    .eq("is_featured", true)
    .eq("is_visible", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .limit(24);

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{ iso_code: string | null }>)
    .map((row) => row.iso_code?.trim().toUpperCase())
    .filter((code): code is string => Boolean(code));
}

/**
 * Read non-expired cached plans for the given country codes and group them by
 * upper-cased country_code. Merges rows per country and de-dupes by planCode.
 * Reads only the JSONB `plans` payload — never request_hash or other internals.
 */
async function readCachedPlansByCountry(
  countryCodes: string[],
): Promise<Map<string, AirhubPublicPlan[]>> {
  const result = new Map<string, AirhubPublicPlan[]>();
  if (countryCodes.length === 0) {
    return result;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("airhub_plan_cache")
    .select("country_code,plans")
    .in("country_code", countryCodes)
    .gt("expires_at", new Date().toISOString());

  if (error) {
    throw error;
  }

  for (const row of (data ?? []) as PlanCacheRow[]) {
    const code = row.country_code?.trim().toUpperCase();
    if (!code) continue;

    const existing = result.get(code) ?? [];
    const seen = new Set(existing.map((plan) => plan.planCode));
    for (const plan of coercePlans(row.plans)) {
      if (seen.has(plan.planCode)) continue;
      seen.add(plan.planCode);
      existing.push(plan);
    }
    result.set(code, existing);
  }

  return result;
}

function groupControlsByCountry(
  controls: PlanControlRow[],
): Map<string, PlanControlRow[]> {
  const map = new Map<string, PlanControlRow[]>();
  for (const control of controls) {
    const code = control.country_code?.trim().toUpperCase();
    if (!code) continue;
    const list = map.get(code) ?? [];
    list.push(control);
    map.set(code, list);
  }
  return map;
}

/**
 * Defensive coercion of the cached JSONB plans array into AirhubPublicPlan[].
 * Only surfaces the public plan fields (no raw provider payload). Skips entries
 * without a usable planCode.
 */
function coercePlans(raw: unknown): AirhubPublicPlan[] {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const planCode = readString(record.planCode);
    if (!planCode) return [];

    return [
      {
        planCode,
        planName: readString(record.planName),
        planType: readString(record.planType),
        countryName: readString(record.countryName),
        countryCode: readString(record.countryCode),
        currency: readString(record.currency),
        price: readNumber(record.price),
        dataUnit: readString(record.dataUnit),
        validity: readString(record.validity),
        validityType: readString(record.validityType),
        capacity: readString(record.capacity),
        connectivity: readString(record.connectivity),
        networkOperator: readString(record.networkOperator),
        countriesCovered: readString(record.countriesCovered),
        travelDateRequirement: readString(record.travelDateRequirement),
        additionalInfo: readString(record.additionalInfo),
        subscription: readBoolean(record.subscription),
        subscriptionPeriod: readString(record.subscriptionPeriod),
        phoneNumber: readBoolean(record.phoneNumber),
      },
    ];
  });
}

function readString(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return null;
}
