import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PROMO_COUNTRY_ORDER,
  buildFallbackPromoCards,
  buildPromoCandidateCodes,
  buildPromoHref,
  derivePromoPlanDetails,
  formatStartingPriceLabel,
} from "./esim-promo-helpers.ts";
import type { PlanControlRow } from "@/server/admin/esim-visibility-helpers";
import type { EsimPricingRuleInput } from "@/server/esim/pricing-helpers";
import type { AirhubPublicPlan } from "@/server/providers/airhub/contracts";

function plan(overrides: Partial<AirhubPublicPlan>): AirhubPublicPlan {
  return {
    planCode: "PC",
    planName: null,
    planType: null,
    countryName: null,
    countryCode: null,
    currency: "USD",
    price: null,
    dataUnit: null,
    validity: null,
    validityType: null,
    capacity: null,
    connectivity: null,
    networkOperator: null,
    countriesCovered: null,
    travelDateRequirement: null,
    additionalInfo: null,
    subscription: null,
    subscriptionPeriod: null,
    phoneNumber: null,
    ...overrides,
  };
}

test("buildFallbackPromoCards returns all six curated countries, no price/data/validity", () => {
  const cards = buildFallbackPromoCards();
  assert.equal(cards.length, PROMO_COUNTRY_ORDER.length);
  assert.deepEqual(
    cards.map((c) => c.countryCode),
    [...PROMO_COUNTRY_ORDER],
  );
  for (const card of cards) {
    assert.equal(card.flagUrl, null);
    assert.equal(card.startingPriceLabel, undefined);
    assert.equal(card.dataLabel, undefined);
    assert.equal(card.validityLabel, undefined);
    assert.equal(card.href, `/esim/${card.countryCode}`);
  }
});

test("buildPromoCandidateCodes puts admin-featured countries first, then curated fill", () => {
  assert.deepEqual(buildPromoCandidateCodes(["SG", "JP", "US"]), [
    // Featured first (SG moves up, de-duped from the curated list)...
    "SG",
    "JP",
    "US",
    // ...then the remaining curated fill in order.
    "AE",
    "SA",
    "IN",
    "UK",
    "TR",
  ]);
});

test("buildPromoCandidateCodes falls back to the curated list when nothing is featured", () => {
  assert.deepEqual(buildPromoCandidateCodes([]), [...PROMO_COUNTRY_ORDER]);
});

test("buildPromoHref upper-cases the code", () => {
  assert.equal(buildPromoHref("ae"), "/esim/AE");
  assert.equal(buildPromoHref(" sg "), "/esim/SG");
});

test("formatStartingPriceLabel uses symbols for known currencies, code otherwise", () => {
  assert.equal(formatStartingPriceLabel(4.39, "USD"), "From $4.39");
  assert.equal(formatStartingPriceLabel(3, "GBP"), "From £3.00");
  assert.equal(formatStartingPriceLabel(21.59, "AED"), "From 21.59 AED");
  assert.equal(formatStartingPriceLabel(5, null), "From 5.00");
});

test("derivePromoPlanDetails returns nothing when there are no plans", () => {
  assert.deepEqual(
    derivePromoPlanDetails({ countryCode: "AE", plans: [], controls: [], pricingRules: [] }),
    {},
  );
});

test("derivePromoPlanDetails computes the cheapest visible price + labels", () => {
  const plans = [
    plan({ planCode: "a", price: 9.99, planName: "UAE 10GB 30days", capacity: "10", validityType: "Days" }),
    plan({ planCode: "b", price: 4.5, planName: "UAE 4GB 30days", capacity: "4", validityType: "Days" }),
  ];
  const result = derivePromoPlanDetails({
    countryCode: "AE",
    plans,
    controls: [],
    pricingRules: [],
  });
  assert.equal(result.startingPriceLabel, "From $4.50");
  assert.equal(result.dataLabel, "4 GB");
  assert.equal(result.validityLabel, "30 Days");
});

test("derivePromoPlanDetails drops admin-hidden plans before pricing", () => {
  const plans = [
    plan({ planCode: "cheap-hidden", price: 1.0 }),
    plan({ planCode: "visible", price: 6.0 }),
  ];
  const controls: PlanControlRow[] = [
    {
      country_code: "AE",
      plan_code: "cheap-hidden",
      is_visible: false,
      is_featured: false,
      sort_order: 0,
      disabled_reason: null,
      admin_note: null,
    },
  ];
  const result = derivePromoPlanDetails({ countryCode: "AE", plans, controls, pricingRules: [] });
  // The $1.00 plan is hidden, so the starting price is the visible $6.00 plan.
  assert.equal(result.startingPriceLabel, "From $6.00");
});

test("derivePromoPlanDetails applies active pricing rules to the starting price", () => {
  const plans = [plan({ planCode: "a", price: 10 })];
  const pricingRules: EsimPricingRuleInput[] = [
    {
      id: "r1",
      scope: "global",
      provider: "airhub",
      countryCode: null,
      planCode: null,
      markupPercent: 20,
      markupFixed: 0,
      minMargin: 0,
      roundingMode: "none",
      isActive: true,
    },
  ];
  const result = derivePromoPlanDetails({ countryCode: "AE", plans, controls: [], pricingRules });
  // 10 + 20% = 12.00 final customer price.
  assert.equal(result.startingPriceLabel, "From $12.00");
});

test("derivePromoPlanDetails ignores plans without a usable price", () => {
  const plans = [
    plan({ planCode: "a", price: null }),
    plan({ planCode: "b", price: 0 }),
  ];
  assert.deepEqual(
    derivePromoPlanDetails({ countryCode: "AE", plans, controls: [], pricingRules: [] }),
    {},
  );
});
