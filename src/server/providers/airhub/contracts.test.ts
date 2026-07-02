import { test } from "node:test";
import assert from "node:assert/strict";

import {
  AIRHUB_ENDPOINTS,
  buildAirhubCountryUpsertRows,
  buildBearerHeaders,
  buildEsimStripeMetadata,
  buildLoginRequest,
  buildPlanInformationRequest,
  buildPublicOrderDto,
  buildPublicPlanDto,
  buildPurchaseSimRequest,
  decideAirhubPlanFetch,
  decideAirhubPurchaseStart,
  parseCountryRegionResponse,
  parseLoginToken,
  parsePlanInformationResponse,
} from "./contracts.ts";
import {
  generateAirhubUniqueOrderId,
  hashAirhubLookupToken,
} from "./order-ids.ts";

test("login request uses Airhub userName/password fields", () => {
  assert.deepEqual(
    buildLoginRequest({ userName: "partner-user", password: "secret" }),
    { userName: "partner-user", password: "secret" },
  );
});

test("login token parser reads top-level token", () => {
  assert.equal(
    parseLoginToken({
      isSuccess: true,
      data: { partnerCode: "89508211" },
      token: "top-level-token",
    }),
    "top-level-token",
  );
});

test("bearer headers inject Authorization without exposing credentials", () => {
  assert.deepEqual(buildBearerHeaders("abc123"), {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: "Bearer abc123",
  });
});

test("GetPlanInformation request uses partnerCode, flag, and countryCode", () => {
  assert.deepEqual(
    buildPlanInformationRequest({
      partnerCode: 89508211,
      flag: 5,
      countryCode: "us",
    }),
    { partnerCode: 89508211, flag: 5, countryCode: "us" },
  );
});

test("country/region parser maps countryregiondetail items", () => {
  assert.deepEqual(
    parseCountryRegionResponse({
      isSuccess: true,
      countryregiondetail: [
        {
          name: "Albania",
          code: "AL",
          flag: "https://www.airhubapp.com/assets/flags/Albania.svg",
        },
      ],
    }).map(({ name, code, flag }) => ({ name, code, flag })),
    [
      {
        name: "Albania",
        code: "AL",
        flag: "https://www.airhubapp.com/assets/flags/Albania.svg",
      },
    ],
  );
});

test("country upsert payload maps Airhub name/code/flag correctly", () => {
  const [country] = parseCountryRegionResponse({
    isSuccess: true,
    message: "Successful",
    countryregiondetail: [
      {
        name: "Albania",
        code: "AL",
        flag: "https://www.airhubapp.com/assets/flags/Albania.svg",
      },
    ],
  });

  assert.deepEqual(buildAirhubCountryUpsertRows([country], "2026-07-02T00:00:00.000Z"), [
    {
      iso_code: "AL",
      name: "Albania",
      airhub_code: "AL",
      flag_url: "https://www.airhubapp.com/assets/flags/Albania.svg",
      raw: {
        name: "Albania",
        code: "AL",
        flag: "https://www.airhubapp.com/assets/flags/Albania.svg",
      },
      synced_at: "2026-07-02T00:00:00.000Z",
    },
  ]);
});

test("empty country response stays empty; no handwritten fallback becomes real data", () => {
  assert.deepEqual(parseCountryRegionResponse({ countryregiondetail: [] }), []);
  assert.deepEqual(buildAirhubCountryUpsertRows([], "2026-07-02T00:00:00.000Z"), []);
});

test("PurchaseSim request sends unique_order_id", () => {
  assert.deepEqual(
    buildPurchaseSimRequest({
      partnerCode: 89508211,
      planCode: "22237541",
      travelDate: "2026-07-05",
      uniqueOrderId: "airhub_unique_1",
    }),
    {
      partnerCode: 89508211,
      planCode: "22237541",
      travelDate: "2026-07-05",
      unique_order_id: "airhub_unique_1",
    },
  );
});

test("plan fetch is disabled when AIRHUB_ENABLED is false and cache is empty", () => {
  assert.deepEqual(
    decideAirhubPlanFetch({ enabled: false, hasCachedPlans: false }),
    { kind: "disabled" },
  );
});

test("plan fetch uses provider path when enabled and no cache exists", () => {
  assert.deepEqual(
    decideAirhubPlanFetch({ enabled: true, hasCachedPlans: false }),
    { kind: "provider" },
  );
});

test("plan parser uses Airhub response fields without inventing plans", () => {
  const plans = parsePlanInformationResponse({
    isSuccess: true,
    data: [
      {
        planCode: "292455",
        planName: "Sample Airhub Plan",
        countryName: "United States",
        currency: "USD",
        price: 10.5,
        dataUnit: "GB",
        validity: "7 Days",
        network_operator: "T-Mobile",
      },
    ],
  }).map(buildPublicPlanDto);

  assert.deepEqual(plans, [
    {
      planCode: "292455",
      planName: "Sample Airhub Plan",
      planType: null,
      countryName: "United States",
      countryCode: null,
      currency: "USD",
      price: 10.5,
      dataUnit: "GB",
      validity: "7 Days",
      validityType: null,
      capacity: null,
      connectivity: null,
      networkOperator: "T-Mobile",
      countriesCovered: null,
      travelDateRequirement: null,
      additionalInfo: null,
      subscription: null,
      subscriptionPeriod: null,
      phoneNumber: null,
    },
  ]);
});

test("plan and country endpoints are separate from PurchaseSim", () => {
  assert.equal(AIRHUB_ENDPOINTS.countryRegionDetail, "/api/ESIM/Getcountry_regiondetail");
  assert.equal(AIRHUB_ENDPOINTS.planInformation, "/api/ESIM/GetPlanInformation");
  assert.notEqual(AIRHUB_ENDPOINTS.planInformation, AIRHUB_ENDPOINTS.purchaseSim);
  assert.notEqual(AIRHUB_ENDPOINTS.countryRegionDetail, AIRHUB_ENDPOINTS.purchaseSim);
});

test("purchase is disabled unless explicitly enabled", () => {
  assert.deepEqual(
    decideAirhubPurchaseStart({
      purchaseEnabled: false,
      testPurchaseOnly: true,
      allowNonTestPlanPurchase: false,
      testPlanCode: "22237541",
      planCode: "22237541",
      status: "paid",
      hasActivationCode: false,
    }),
    { kind: "disabled", code: "airhub_purchase_disabled" },
  );
});

test("default test allowlist only permits the Airhub test plan", () => {
  assert.deepEqual(
    decideAirhubPurchaseStart({
      purchaseEnabled: true,
      testPurchaseOnly: true,
      allowNonTestPlanPurchase: false,
      testPlanCode: "22237541",
      planCode: "999999",
      status: "paid",
      hasActivationCode: false,
    }),
    { kind: "blocked_plan", code: "airhub_purchase_disabled" },
  );

  assert.deepEqual(
    decideAirhubPurchaseStart({
      purchaseEnabled: true,
      testPurchaseOnly: true,
      allowNonTestPlanPurchase: false,
      testPlanCode: "22237541",
      planCode: "22237541",
      status: "paid",
      hasActivationCode: false,
    }),
    { kind: "ready" },
  );
});

test("server unique_order_id helper generates Airhub-scoped IDs", () => {
  const first = generateAirhubUniqueOrderId();
  const second = generateAirhubUniqueOrderId();

  assert.match(first, /^airhub_\d+_[a-f0-9]{16}$/);
  assert.match(second, /^airhub_\d+_[a-f0-9]{16}$/);
  assert.notEqual(first, second);
});

test("Stripe metadata is isolated to eSIM charge type", () => {
  assert.deepEqual(
    buildEsimStripeMetadata({
      orderId: "order-id",
      planCode: "22237541",
      countryCode: "GB",
    }),
    {
      charge_type: "esim_airhub",
      internal_order_id: "order-id",
      plan_code: "22237541",
      country_code: "GB",
    },
  );
});

test("duplicate purchase-start decision skips already started rows", () => {
  assert.deepEqual(
    decideAirhubPurchaseStart({
      purchaseEnabled: true,
      testPurchaseOnly: true,
      allowNonTestPlanPurchase: false,
      testPlanCode: "22237541",
      planCode: "22237541",
      status: "purchase_started",
      hasActivationCode: false,
    }),
    { kind: "skip_existing", reason: "already_started" },
  );
});

test("public order DTO maps activation payload only after valid lookup", () => {
  assert.deepEqual(
    buildPublicOrderDto({
      public_reference: "ESIM-1",
      status: "fulfilled",
      guest_email: "user@example.com",
      plan_code: "22237541",
      plan_name: "UK 1 MB Plan",
      country_code: "GB",
      country_name: "United Kingdom",
      price: 1,
      currency: "USD",
      travel_date: "2026-07-05",
      activation_code: "LPA:payload",
      apn: "plus",
      sim_id: "sim",
      sim_pin: "",
      qr_payload: "LPA:payload",
    }).qrPayload,
    "LPA:payload",
  );
});

test("lookup token hashing is deterministic and not the raw token", () => {
  const token = "customer-order-token";

  assert.equal(hashAirhubLookupToken(token), hashAirhubLookupToken(token));
  assert.notEqual(hashAirhubLookupToken(token), token);
});

test("public plan DTO strips raw provider payload", () => {
  const [plan] = parsePlanInformationResponse({
    data: [
      {
        planCode: "22237541",
        planName: "UK 1 MB Plan",
        price: 1,
        currency: "USD",
        token: "must-not-leak",
      },
    ],
  });
  const dto = buildPublicPlanDto(plan);

  assert.equal("raw" in dto, false);
  assert.equal("token" in dto, false);
  assert.equal(dto.planCode, "22237541");
});
