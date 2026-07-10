/**
 * Pure helpers for the homepage eSIM promo section.
 *
 * No IO, no `server-only`, only type-only + pure imports — safe to import
 * directly from `node --test`. The server-only DAL (esim-promo.ts) reads
 * Supabase cache/admin data and delegates every derivation here.
 *
 * These helpers NEVER call the Airhub provider and never surface internal
 * fields (request_hash, provider hashes, admin notes, disabled reasons,
 * pricing rule ids, supplier prices). Only the customer-facing promo DTO
 * leaves this module.
 */

import {
  indexControlsByPlanCode,
  toVisiblePublicPlans,
  type PlanControlRow,
} from "../admin/esim-visibility-helpers.ts";
import {
  applyPricingToPlan,
  type EsimPricingRuleInput,
} from "../esim/pricing-helpers.ts";
import { extractPlanFeatures } from "../providers/airhub/plan-display.ts";
import type { AirhubPublicPlan } from "../providers/airhub/contracts.ts";

/** Maximum promo cards shown on the homepage. */
export const PROMO_MAX_CARDS = 6;

/**
 * Curated fallback order. These fill any remaining slots after the admin's own
 * featured countries, and are the full list when nothing is featured. Admins
 * change what appears by featuring countries in the eSIM admin (is_featured +
 * sort_order); this constant is only the default backfill.
 */
export const PROMO_COUNTRY_ORDER = ["AE", "SA", "IN", "UK", "TR", "SG"] as const;

export type PromoCountryCode = (typeof PROMO_COUNTRY_ORDER)[number];

/**
 * Build the ordered, de-duplicated candidate code list: admin-featured countries
 * first (in the order given), then the curated fill list for any codes not
 * already present. De-dupes case-insensitively by raw code; the DAL resolves and
 * de-dupes again by canonical ISO (e.g. UK/GB) and caps the final count.
 */
export function buildPromoCandidateCodes(featuredCodes: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const code of [...featuredCodes, ...PROMO_COUNTRY_ORDER]) {
    const normalized = code.trim().toUpperCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    ordered.push(normalized);
  }

  return ordered;
}

/** Static, provider-free display names used for fallback cards (no fake price). */
export const PROMO_FALLBACK_NAMES: Record<PromoCountryCode, string> = {
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  IN: "India",
  UK: "United Kingdom",
  TR: "Turkey",
  SG: "Singapore",
};

export type EsimPromoCard = {
  countryCode: string;
  countryName: string;
  flagUrl: string | null;
  /** Present only when cached visible plans yield a real price. Never faked. */
  startingPriceLabel?: string;
  /** Present only when the cheapest plan exposes a real data amount. */
  dataLabel?: string;
  /** Present only when the cheapest plan exposes a real validity. */
  validityLabel?: string;
  href: string;
};

export type EsimPromoContent = {
  eyebrow: string;
  title: string;
  subtitle: string;
  cards: EsimPromoCard[];
  ctaHref: string;
  ctaLabel: string;
};

export const ESIM_PROMO_COPY = {
  eyebrow: "Travel connectivity",
  title: "Stay connected anywhere",
  subtitle:
    "Browse popular eSIM plans for your next trip without waiting for a physical SIM.",
  ctaHref: "/esim",
  ctaLabel: "Browse all eSIM destinations",
} as const;

/** Build the /esim/{code} link for a promo country. */
export function buildPromoHref(countryCode: string): string {
  return `/esim/${countryCode.trim().toUpperCase()}`;
}

/**
 * Derived (safe) promo details from a country's cached plans. Everything is
 * optional: a missing/empty cache simply yields no price/data/validity, never a
 * placeholder value.
 */
export type PromoPlanDerivation = {
  startingPriceLabel?: string;
  dataLabel?: string;
  validityLabel?: string;
};

/**
 * Compute the starting price + data/validity labels from cached plans only.
 *
 * Pipeline: drop admin-hidden plans (airhub_plan_controls.is_visible=false) ->
 * apply active pricing rules -> keep plans with a real positive final price ->
 * pick the cheapest -> format its price and read its (real-field-only) data +
 * validity labels. Returns an empty object when nothing qualifies.
 */
export function derivePromoPlanDetails(input: {
  countryCode: string;
  plans: AirhubPublicPlan[];
  controls: PlanControlRow[];
  pricingRules: EsimPricingRuleInput[];
}): PromoPlanDerivation {
  if (!Array.isArray(input.plans) || input.plans.length === 0) {
    return {};
  }

  const controlIndex = indexControlsByPlanCode(input.controls);
  const visiblePlans =
    input.controls.length === 0
      ? input.plans
      : toVisiblePublicPlans(input.plans, controlIndex);

  if (visiblePlans.length === 0) {
    return {};
  }

  const priced = visiblePlans
    .map((plan) =>
      applyPricingToPlan({
        plan,
        countryCode: input.countryCode,
        rules: input.pricingRules,
      }),
    )
    .filter(
      (plan) =>
        typeof plan.price === "number" &&
        Number.isFinite(plan.price) &&
        plan.price > 0,
    );

  if (priced.length === 0) {
    return {};
  }

  const cheapest = priced.reduce((min, plan) =>
    (plan.price as number) < (min.price as number) ? plan : min,
  );

  const features = extractPlanFeatures(cheapest);
  const derivation: PromoPlanDerivation = {
    startingPriceLabel: formatStartingPriceLabel(
      cheapest.price as number,
      cheapest.currency,
    ),
  };
  if (features.dataLabel) derivation.dataLabel = features.dataLabel;
  if (features.validityLabel) derivation.validityLabel = features.validityLabel;

  return derivation;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
};

/** Format "From $4.39" / "From 21.59 AED". Never invents a currency. */
export function formatStartingPriceLabel(
  amount: number,
  currency: string | null,
): string {
  const value = amount.toFixed(2);
  const code = currency?.trim().toUpperCase();

  if (!code) {
    return `From ${value}`;
  }

  const symbol = CURRENCY_SYMBOLS[code];
  return symbol ? `From ${symbol}${value}` : `From ${value} ${code}`;
}

/**
 * Static fallback cards (no price/data/validity claims) used when Supabase or
 * the cache is unavailable, or when no promo country resolved from the DB.
 */
export function buildFallbackPromoCards(): EsimPromoCard[] {
  return PROMO_COUNTRY_ORDER.map((code) => ({
    countryCode: code,
    countryName: PROMO_FALLBACK_NAMES[code],
    flagUrl: null,
    href: buildPromoHref(code),
  }));
}

/** Assemble the full promo content wrapper around a card list. */
export function buildPromoContent(cards: EsimPromoCard[]): EsimPromoContent {
  return {
    eyebrow: ESIM_PROMO_COPY.eyebrow,
    title: ESIM_PROMO_COPY.title,
    subtitle: ESIM_PROMO_COPY.subtitle,
    cards,
    ctaHref: ESIM_PROMO_COPY.ctaHref,
    ctaLabel: ESIM_PROMO_COPY.ctaLabel,
  };
}
