import type {
  AirhubPublicCountry,
  AirhubPublicPlan,
} from "./contracts.ts";
import { normalizeAirhubCountryCode } from "./contracts.ts";

export type AirhubCountryPlanPageModel = {
  countryCode: string | null;
  countryName: string | null;
  plans: AirhubPublicPlan[];
  state:
    | "ready"
    | "country_not_available"
    | "disabled"
    | "fetch_failed"
    | "empty";
};

export function buildAirhubCountryPlanPageModel(input: {
  routeCountryCode: string;
  country: AirhubPublicCountry | null;
  plans: AirhubPublicPlan[];
  planStatus: "ok" | "disabled" | "fetch_failed";
}): AirhubCountryPlanPageModel {
  const countryCode = normalizeAirhubCountryCode(input.routeCountryCode);

  if (!countryCode || !input.country) {
    return {
      countryCode,
      countryName: null,
      plans: [],
      state: "country_not_available",
    };
  }

  if (input.planStatus === "fetch_failed") {
    return {
      countryCode,
      countryName: input.country.name,
      plans: [],
      state: "fetch_failed",
    };
  }

  if (input.planStatus === "disabled") {
    return {
      countryCode,
      countryName: input.country.name,
      plans: [],
      state: "disabled",
    };
  }

  if (input.plans.length === 0) {
    return {
      countryCode,
      countryName: input.country.name,
      plans: [],
      state: "empty",
    };
  }

  return {
    countryCode,
    countryName: input.country.name,
    plans: input.plans,
    state: "ready",
  };
}
