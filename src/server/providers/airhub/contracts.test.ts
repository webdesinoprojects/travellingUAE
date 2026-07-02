import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildBearerHeaders,
  buildEsimStripeMetadata,
  buildLoginRequest,
  buildPlanInformationRequest,
  buildPublicOrderDto,
  buildPublicPlanDto,
  buildPurchaseSimRequest,
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
