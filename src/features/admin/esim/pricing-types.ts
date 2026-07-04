import type {
  EsimPricingScope,
  EsimRoundingMode,
} from "@/server/esim/pricing-helpers";

export type AdminPricingRule = {
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
  createdAt: string;
  updatedAt: string;
};

export type AdminPricingCountryOption = {
  isoCode: string;
  name: string;
};

export type AdminPricingPlanOption = {
  countryCode: string;
  planCode: string;
  planName: string | null;
  supplierPrice: number | null;
  currency: string | null;
};

export type AdminPricingPageModel = {
  rules: AdminPricingRule[];
  countries: AdminPricingCountryOption[];
  plans: AdminPricingPlanOption[];
};

export type AdminPricingRulePatch = {
  scope: EsimPricingScope;
  countryCode?: string | null;
  planCode?: string | null;
  markupPercent: number;
  markupFixed: number;
  minMargin: number;
  roundingMode: EsimRoundingMode;
  isActive: boolean;
};
