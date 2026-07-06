import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_PLAN_FILTER_QUERY,
  derivePlanValidityDays,
  filterAndSortPlans,
  getAvailablePlanOperators,
  isDefaultPlanFilterQuery,
  type PlanFilterQuery,
} from "./plan-search.ts";
import type { AirhubPublicPlan } from "./contracts.ts";

// Fixtures shaped like the real live payload (AZ/UK/IN samples).
const PLAN_AZ: AirhubPublicPlan = {
  planCode: "1034453",
  planName: "Azerbaijan 4GB 30days",
  planType: "Local",
  countryName: "Azerbaijan",
  countryCode: null,
  currency: "USD",
  price: 12,
  dataUnit: null,
  validity: null,
  validityType: "Days",
  capacity: "4",
  connectivity: "Local",
  networkOperator: "Bakcell",
  countriesCovered: null,
  travelDateRequirement: "No Need",
  additionalInfo: "<p>Package Details:</p><ul><li>4GB High-speed data</li></ul>",
  subscription: true,
  subscriptionPeriod: null,
  phoneNumber: false,
};

const PLAN_UK_CALLS: AirhubPublicPlan = {
  ...PLAN_AZ,
  planCode: "2431581",
  planName: "UK 50GB Data with Calls 30Days",
  countryName: "UK",
  networkOperator: "EE",
  price: 27.53,
  capacity: "50",
  phoneNumber: true,
};

const PLAN_IN_ONE_TIME: AirhubPublicPlan = {
  ...PLAN_AZ,
  planCode: "9869",
  planName: "India 7GB 15Days",
  countryName: "India",
  networkOperator: "Vodafone",
  price: 14.52,
  capacity: "7",
  subscription: false,
};

const PLAN_MYSTERY: AirhubPublicPlan = {
  ...PLAN_AZ,
  planCode: "0000",
  planName: "Mystery Plan",
  countryName: "Nowhere",
  networkOperator: null,
  price: 5,
  capacity: "2",
  validityType: null,
  subscription: null,
  phoneNumber: null,
};

const ALL_PLANS = [PLAN_AZ, PLAN_UK_CALLS, PLAN_IN_ONE_TIME, PLAN_MYSTERY];

function query(patch: Partial<PlanFilterQuery>): PlanFilterQuery {
  return { ...DEFAULT_PLAN_FILTER_QUERY, ...patch };
}

function codes(plans: AirhubPublicPlan[]): string[] {
  return plans.map((plan) => plan.planCode);
}

test("search matches planName, countryName, and networkOperator only (case-insensitive)", () => {
  assert.deepEqual(codes(filterAndSortPlans(ALL_PLANS, query({ search: "bakcell" }))), ["1034453"]);
  assert.deepEqual(codes(filterAndSortPlans(ALL_PLANS, query({ search: "UK" }))), ["2431581"]);
  assert.deepEqual(codes(filterAndSortPlans(ALL_PLANS, query({ search: "india" }))), ["9869"]);
  assert.deepEqual(codes(filterAndSortPlans(ALL_PLANS, query({ search: "nope-not-found" }))), []);
});

test("phoneNumber filter: data only vs voice + data (null never matches either)", () => {
  const dataOnly = filterAndSortPlans(ALL_PLANS, query({ phoneFilter: "data_only" }));
  assert.deepEqual(codes(dataOnly).sort(), ["1034453", "9869"].sort());

  const voiceData = filterAndSortPlans(ALL_PLANS, query({ phoneFilter: "voice_data" }));
  assert.deepEqual(codes(voiceData), ["2431581"]);

  // The mystery plan (phoneNumber: null) must not appear in either filter.
  assert.equal(dataOnly.some((p) => p.planCode === "0000"), false);
  assert.equal(voiceData.some((p) => p.planCode === "0000"), false);
});

test("subscription filter: renewal available vs one-time (null never matches either)", () => {
  const available = filterAndSortPlans(ALL_PLANS, query({ renewalFilter: "available" }));
  assert.deepEqual(codes(available).sort(), ["1034453", "2431581"].sort());

  const oneTime = filterAndSortPlans(ALL_PLANS, query({ renewalFilter: "one_time" }));
  assert.deepEqual(codes(oneTime), ["9869"]);

  assert.equal(available.some((p) => p.planCode === "0000"), false);
  assert.equal(oneTime.some((p) => p.planCode === "0000"), false);
});

test("operator filter matches an exact real operator value", () => {
  assert.deepEqual(codes(filterAndSortPlans(ALL_PLANS, query({ operator: "EE" }))), ["2431581"]);
  assert.equal(filterAndSortPlans(ALL_PLANS, query({ operator: "all" })).length, 4);
});

test("getAvailablePlanOperators returns unique, sorted, real operators only", () => {
  assert.deepEqual(getAvailablePlanOperators(ALL_PLANS), ["Bakcell", "EE", "Vodafone"]);
  assert.deepEqual(getAvailablePlanOperators([PLAN_MYSTERY]), []);
});

test("sort by price low-high / high-low", () => {
  assert.deepEqual(codes(filterAndSortPlans(ALL_PLANS, query({ sort: "price_asc" }))), [
    "0000", // 5
    "1034453", // 12
    "9869", // 14.52
    "2431581", // 27.53
  ]);
  assert.deepEqual(codes(filterAndSortPlans(ALL_PLANS, query({ sort: "price_desc" }))), [
    "2431581",
    "9869",
    "1034453",
    "0000",
  ]);
});

test("sort by data capacity low-high / high-low", () => {
  assert.deepEqual(codes(filterAndSortPlans(ALL_PLANS, query({ sort: "capacity_asc" }))), [
    "0000", // 2
    "1034453", // 4
    "9869", // 7
    "2431581", // 50
  ]);
  assert.deepEqual(codes(filterAndSortPlans(ALL_PLANS, query({ sort: "capacity_desc" }))), [
    "2431581",
    "9869",
    "1034453",
    "0000",
  ]);
});

test("derivePlanValidityDays safely derives from planName, never guesses", () => {
  assert.equal(derivePlanValidityDays(PLAN_AZ), 30); // "30days" + validityType "Days"
  assert.equal(derivePlanValidityDays(PLAN_IN_ONE_TIME), 15); // "15Days"
  assert.equal(derivePlanValidityDays(PLAN_MYSTERY), null); // validityType missing -> not guessed
});

test("sort by validity: unconfirmed validity always sinks to the end, both directions", () => {
  // AZ and UK both derive to 30 days (tie -> original array order); India 15; Mystery unconfirmed.
  assert.deepEqual(codes(filterAndSortPlans(ALL_PLANS, query({ sort: "validity_asc" }))), [
    "9869", // 15
    "1034453", // 30 (tie, appears before UK in original order)
    "2431581", // 30
    "0000", // unconfirmed -> last
  ]);
  assert.deepEqual(codes(filterAndSortPlans(ALL_PLANS, query({ sort: "validity_desc" }))), [
    "1034453", // 30 (tie, original order)
    "2431581", // 30
    "9869", // 15
    "0000", // unconfirmed -> still last, even descending
  ]);
});

test("isDefaultPlanFilterQuery", () => {
  assert.equal(isDefaultPlanFilterQuery(DEFAULT_PLAN_FILTER_QUERY), true);
  assert.equal(isDefaultPlanFilterQuery(query({ search: "x" })), false);
  assert.equal(isDefaultPlanFilterQuery(query({ sort: "price_asc" })), false);
});

test("filters and sort compose together", () => {
  const result = filterAndSortPlans(
    ALL_PLANS,
    query({ renewalFilter: "available", sort: "price_desc" }),
  );
  assert.deepEqual(codes(result), ["2431581", "1034453"]);
});
