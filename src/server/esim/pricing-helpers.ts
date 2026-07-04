/**
 * Pure helpers for eSIM pricing rules.
 *
 * No IO and no `server-only`; safe for direct node --test. Public DTO helpers
 * strip the internal `pricing` object before any plan reaches customer code.
 */

export type EsimPricingScope = "global" | "country" | "plan";
export type EsimRoundingMode = "none" | "nearest_0_99" | "nearest_0_49" | "whole";
export type EsimPricingSource = EsimPricingScope | "none";

export type EsimPricingRuleInput = {
  id: string;
  scope: EsimPricingScope;
  provider: string;
  countryCode: string | null;
  planCode: string | null;
  markupPercent: number;
  markupFixed: number;
  minMargin: number;
  roundingMode: EsimRoundingMode;
  isActive: boolean;
};

export type EsimAppliedPricing = {
  supplierPrice: number | null;
  supplierCurrency: string | null;
  finalPrice: number | null;
  finalCurrency: string | null;
  markupAmount: number | null;
  pricingRuleId: string | null;
  pricingSource: EsimPricingSource;
};

export type PricedPlan<T> = T & {
  pricing: EsimAppliedPricing;
};

type PlanLike = {
  planCode: string;
  price: number | null;
  currency: string | null;
};

export function resolvePricingRule(input: {
  rules: EsimPricingRuleInput[];
  countryCode: string;
  planCode: string;
}): EsimPricingRuleInput | null {
  const countryCode = input.countryCode.trim().toUpperCase();
  const planCode = input.planCode.trim().toLowerCase();
  const activeRules = input.rules.filter((rule) => rule.isActive);

  return (
    activeRules.find(
      (rule) =>
        rule.scope === "plan" &&
        rule.countryCode?.toUpperCase() === countryCode &&
        rule.planCode?.toLowerCase() === planCode,
    ) ??
    activeRules.find(
      (rule) => rule.scope === "country" && rule.countryCode?.toUpperCase() === countryCode,
    ) ??
    activeRules.find((rule) => rule.scope === "global") ??
    null
  );
}

export function applyPricingToPlan<T extends PlanLike>(input: {
  plan: T;
  countryCode: string;
  rules: EsimPricingRuleInput[];
}): PricedPlan<T> {
  const rule = resolvePricingRule({
    rules: input.rules,
    countryCode: input.countryCode,
    planCode: input.plan.planCode,
  });
  const pricing = applyPricingRule({
    supplierPrice: input.plan.price,
    supplierCurrency: input.plan.currency,
    rule,
  });

  return {
    ...input.plan,
    price: pricing.finalPrice,
    currency: pricing.finalCurrency,
    pricing,
  };
}

export function applyPricingRule(input: {
  supplierPrice: number | null;
  supplierCurrency: string | null;
  rule: EsimPricingRuleInput | null;
}): EsimAppliedPricing {
  if (input.supplierPrice == null || !Number.isFinite(input.supplierPrice)) {
    return {
      supplierPrice: null,
      supplierCurrency: normalizeCurrency(input.supplierCurrency),
      finalPrice: null,
      finalCurrency: normalizeCurrency(input.supplierCurrency),
      markupAmount: null,
      pricingRuleId: input.rule?.id ?? null,
      pricingSource: input.rule?.scope ?? "none",
    };
  }

  const supplierPrice = roundMoney(input.supplierPrice);
  const currency = normalizeCurrency(input.supplierCurrency);

  if (!input.rule) {
    return {
      supplierPrice,
      supplierCurrency: currency,
      finalPrice: supplierPrice,
      finalCurrency: currency,
      markupAmount: 0,
      pricingRuleId: null,
      pricingSource: "none",
    };
  }

  const percentMarkup = supplierPrice * (clampNonNegative(input.rule.markupPercent) / 100);
  const fixedMarkup = clampNonNegative(input.rule.markupFixed);
  const minMargin = clampNonNegative(input.rule.minMargin);
  const rawMarkup = percentMarkup + fixedMarkup;
  const margin = Math.max(rawMarkup, minMargin);
  const roundedFinal = applyRounding(supplierPrice + margin, input.rule.roundingMode);

  return {
    supplierPrice,
    supplierCurrency: currency,
    finalPrice: roundedFinal,
    finalCurrency: currency,
    markupAmount: roundMoney(roundedFinal - supplierPrice),
    pricingRuleId: input.rule.id,
    pricingSource: input.rule.scope,
  };
}

export function stripInternalPricing<T extends { pricing?: EsimAppliedPricing }>(
  plan: T,
): Omit<T, "pricing"> {
  const publicPlan = { ...plan } as Omit<T, "pricing"> & {
    pricing?: EsimAppliedPricing;
  };
  delete publicPlan.pricing;
  return publicPlan;
}

export function applyRounding(value: number, mode: EsimRoundingMode): number {
  switch (mode) {
    case "nearest_0_99":
      return centsToMoney(roundUpToEndingCents(value, [99]));
    case "nearest_0_49":
      return centsToMoney(roundUpToEndingCents(value, [49, 99]));
    case "whole":
      return centsToMoney(Math.ceil(toCeilCents(value) / 100) * 100);
    case "none":
    default:
      return roundMoney(value);
  }
}

export function isEsimRoundingMode(value: string): value is EsimRoundingMode {
  return (
    value === "none" ||
    value === "nearest_0_99" ||
    value === "nearest_0_49" ||
    value === "whole"
  );
}

function roundUpToEndingCents(value: number, endings: number[]): number {
  const cents = toCeilCents(value);
  const dollars = Math.floor(cents / 100);
  const sortedEndings = [...endings].sort((a, b) => a - b);

  for (const ending of sortedEndings) {
    const candidate = dollars * 100 + ending;
    if (candidate >= cents) {
      return candidate;
    }
  }

  return (dollars + 1) * 100 + sortedEndings[0];
}

function roundMoney(value: number): number {
  return centsToMoney(Math.round((value + Number.EPSILON) * 100));
}

function toCeilCents(value: number): number {
  return Math.ceil((value + Number.EPSILON) * 100 - 1e-9);
}

function centsToMoney(cents: number): number {
  return cents / 100;
}

function clampNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function normalizeCurrency(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}
