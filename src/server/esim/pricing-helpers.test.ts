import { test } from "node:test";
import assert from "node:assert/strict";

import {
  applyPricingToPlan,
  applyRounding,
  resolvePricingRule,
  stripInternalPricing,
  type EsimPricingRuleInput,
} from "./pricing-helpers.ts";

test("pricing precedence is plan then country then global", () => {
  const rules = [
    rule("global-1", "global", null, null, { markupFixed: 1 }),
    rule("country-1", "country", "US", null, { markupFixed: 2 }),
    rule("plan-1", "plan", "US", "PLAN-A", { markupFixed: 3 }),
  ];

  assert.equal(resolvePricingRule({ rules, countryCode: "US", planCode: "PLAN-A" })?.id, "plan-1");
  assert.equal(resolvePricingRule({ rules, countryCode: "US", planCode: "OTHER" })?.id, "country-1");
  assert.equal(resolvePricingRule({ rules, countryCode: "FR", planCode: "OTHER" })?.id, "global-1");
});

test("percent markup is added to supplier price", () => {
  const plan = pricePlan([rule("global-1", "global", null, null, { markupPercent: 10 })]);

  assert.equal(plan.price, 11);
  assert.equal(plan.pricing.supplierPrice, 10);
  assert.equal(plan.pricing.markupAmount, 1);
  assert.equal(plan.pricing.pricingSource, "global");
});

test("fixed markup is added to supplier price", () => {
  const plan = pricePlan([rule("country-1", "country", "US", null, { markupFixed: 2.5 })]);

  assert.equal(plan.price, 12.5);
  assert.equal(plan.pricing.markupAmount, 2.5);
});

test("min margin raises final price when markup is too small", () => {
  const plan = pricePlan([
    rule("country-1", "country", "US", null, { markupFixed: 1, minMargin: 4 }),
  ]);

  assert.equal(plan.price, 14);
  assert.equal(plan.pricing.markupAmount, 4);
});

test("rounding none keeps two decimals", () => {
  const plan = applyPricingToPlan({
    plan: { planCode: "PLAN-A", price: 12.34, currency: "usd" },
    countryCode: "US",
    rules: [rule("global-1", "global", null, null, { markupPercent: 10 })],
  });

  assert.equal(plan.price, 13.57);
  assert.equal(plan.currency, "USD");
});

test("rounding nearest .99 rounds up", () => {
  assert.equal(applyRounding(10.01, "nearest_0_99"), 10.99);
  assert.equal(applyRounding(10.99, "nearest_0_99"), 10.99);
  assert.equal(applyRounding(11, "nearest_0_99"), 11.99);
});

test("no rule returns supplier price unchanged", () => {
  const plan = pricePlan([]);

  assert.equal(plan.price, 10);
  assert.equal(plan.pricing.markupAmount, 0);
  assert.equal(plan.pricing.pricingSource, "none");
});

test("public DTO strips internal pricing rule fields", () => {
  const plan = pricePlan([rule("plan-secret", "plan", "US", "PLAN-A", { markupFixed: 2 })]);
  const publicPlan = stripInternalPricing(plan);
  const serialized = JSON.stringify(publicPlan);

  assert.deepEqual(Object.keys(publicPlan).sort(), ["currency", "planCode", "price"]);
  assert.equal(serialized.includes("plan-secret"), false);
  assert.equal(serialized.includes("pricingRuleId"), false);
  assert.equal(serialized.includes("markupAmount"), false);
  assert.equal(serialized.includes("supplierPrice"), false);
});

function pricePlan(rules: EsimPricingRuleInput[]) {
  return applyPricingToPlan({
    plan: { planCode: "PLAN-A", price: 10, currency: "USD" },
    countryCode: "US",
    rules,
  });
}

function rule(
  id: string,
  scope: EsimPricingRuleInput["scope"],
  countryCode: string | null,
  planCode: string | null,
  overrides: Partial<EsimPricingRuleInput>,
): EsimPricingRuleInput {
  return {
    id,
    scope,
    provider: "airhub",
    countryCode,
    planCode,
    markupPercent: 0,
    markupFixed: 0,
    minMargin: 0,
    roundingMode: "none",
    isActive: true,
    ...overrides,
  };
}
