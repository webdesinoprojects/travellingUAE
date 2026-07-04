import { test } from "node:test";
import assert from "node:assert/strict";

import {
  AIRHUB_DEFAULT_TEST_PLAN_CODE,
  AIRHUB_ENDPOINTS,
  buildActivationCodeRequest,
  buildAirhubCountrySyncPayload,
  buildAirhubCountrySyncPayloadFromItems,
  buildAirhubCountryUpsertRows,
  buildAirhubPlanRequestCountryCode,
  buildBearerHeaders,
  buildEsimStripeMetadata,
  buildLoginRequest,
  buildPlanInformationRequest,
  buildPublicOrderDto,
  buildPublicPlanDto,
  buildPurchaseSimRequest,
  decideAirhubPlanFetch,
  decideAirhubPurchaseStart,
  decidePurchaseOutcomeStatus,
  isValidAirhubPlanInformationResponse,
  parsePurchaseSimResponse,
  normalizeAirhubCountryCode,
  parseCountryRegionResponse,
  parseLoginToken,
  parsePlanInformationResponse,
} from "./contracts.ts";
import { AirhubError, toSafeAirhubPlanFetchFailure } from "./errors.ts";
import {
  generateAirhubUniqueOrderId,
  hashAirhubLookupToken,
} from "./order-ids.ts";
import { buildAirhubCountryPlanPageModel } from "./page-model.ts";
import {
  getCountryFlagDisplay,
  getSafeAirhubFlagUrl,
} from "../../../components/esim/country-flag.ts";

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

test("GetPlanInformation flag 5 body includes live-required multiplecountrycode", () => {
  const body = buildPlanInformationRequest({
    partnerCode: 89508211,
    flag: 5,
    countryCode: "USA",
  });

  assert.deepEqual(body, {
    partnerCode: 89508211,
    flag: 5,
    countryCode: "USA",
    multiplecountrycode: ["USA"],
  });
});

test("Airhub plan country resolver keeps IN, maps UK to UK, and maps US to USA", () => {
  assert.equal(normalizeAirhubCountryCode("in"), "IN");
  assert.equal(buildAirhubPlanRequestCountryCode({ countryCode: "IN" }), "IN");
  assert.equal(buildAirhubPlanRequestCountryCode({ countryCode: "UK" }), "UK");
  assert.equal(buildAirhubPlanRequestCountryCode({ countryCode: "GB" }), "UK");
  assert.equal(buildAirhubPlanRequestCountryCode({ countryCode: "US" }), "USA");
  assert.equal(
    buildAirhubPlanRequestCountryCode({
      countryCode: "DE",
      airhubCode: "DEU",
      countryName: "Germany",
    }),
    "DEU",
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

test("country card uses flag image when flag_url exists", () => {
  assert.deepEqual(
    getCountryFlagDisplay({
      isoCode: "IN",
      countryName: "India",
      flagUrl: "https://www.airhubapp.jp/assets/flags/India.svg",
    }),
    {
      kind: "image",
      src: "https://www.airhubapp.jp/assets/flags/India.svg",
      alt: "India flag",
    },
  );
});

test("country card falls back to ISO badge when flag_url is missing", () => {
  assert.deepEqual(
    getCountryFlagDisplay({
      isoCode: "IN",
      countryName: "India",
      flagUrl: null,
    }),
    { kind: "badge", label: "IN" },
  );
});

test("country card falls back to ISO badge after flag image error", () => {
  assert.deepEqual(
    getCountryFlagDisplay({
      isoCode: "AX",
      countryName: "Aland Islands",
      flagUrl: "https://www.airhubapp.jp/assets/flags/Aland Islands.svg",
      imageFailed: true,
    }),
    { kind: "badge", label: "AX" },
  );
});

test("Airhub flag URL with spaces is encoded safely", () => {
  assert.equal(
    getSafeAirhubFlagUrl("https://www.airhubapp.jp/assets/flags/Aland Islands.svg"),
    "https://www.airhubapp.jp/assets/flags/Aland%20Islands.svg",
  );
});

test("empty country response stays empty; no handwritten fallback becomes real data", () => {
  assert.deepEqual(parseCountryRegionResponse({ countryregiondetail: [] }), []);
  assert.deepEqual(buildAirhubCountryUpsertRows([], "2026-07-02T00:00:00.000Z"), []);
});

test("duplicate country codes are deduped before upsert", () => {
  const payload = buildAirhubCountrySyncPayload(
    {
      countryregiondetail: [
        { name: "Aland Islands", code: "AX" },
        {
          name: "Aland Islands",
          code: "AX",
          flag: "https://www.airhubapp.com/assets/flags/Aland.svg",
        },
      ],
    },
    "2026-07-02T00:00:00.000Z",
  );

  assert.equal(payload.received, 2);
  assert.equal(payload.valid, 2);
  assert.equal(payload.duplicatesDropped, 1);
  assert.equal(payload.rows.length, 1);
  assert.deepEqual(payload.rows[0], {
    iso_code: "AX",
    name: "Aland Islands",
    airhub_code: "AX",
    flag_url: "https://www.airhubapp.com/assets/flags/Aland.svg",
    raw: {
      name: "Aland Islands",
      code: "AX",
      flag: "https://www.airhubapp.com/assets/flags/Aland.svg",
    },
    synced_at: "2026-07-02T00:00:00.000Z",
  });
});

test("lower and upper case country codes normalize to uppercase", () => {
  const payload = buildAirhubCountrySyncPayload(
    {
      countryregiondetail: [
        { name: "United Kingdom", code: " uk " },
        { name: "United Kingdom", code: "UK" },
      ],
    },
    "2026-07-02T00:00:00.000Z",
  );

  assert.equal(payload.rows.length, 1);
  assert.equal(payload.rows[0].iso_code, "UK");
  assert.equal(payload.rows[0].airhub_code, "UK");
  assert.equal(payload.duplicatesDropped, 1);
});

test("Airhub USA country code is stored as public US with provider code USA", () => {
  const payload = buildAirhubCountrySyncPayload(
    {
      countryregiondetail: [{ name: "United States", code: "USA" }],
    },
    "2026-07-02T00:00:00.000Z",
  );

  assert.deepEqual(payload.rows[0], {
    iso_code: "US",
    name: "United States",
    airhub_code: "USA",
    flag_url: null,
    raw: { name: "United States", code: "USA" },
    synced_at: "2026-07-02T00:00:00.000Z",
  });
});

test("Airhub GB/Wales country anomaly keeps the GB control row", () => {
  const payload = buildAirhubCountrySyncPayload(
    {
      countryregiondetail: [{ name: "Wales", code: "GB" }],
    },
    "2026-07-02T00:00:00.000Z",
  );

  assert.deepEqual(payload.rows[0], {
    iso_code: "GB",
    name: "Wales",
    airhub_code: "GB",
    flag_url: null,
    raw: { name: "Wales", code: "GB" },
    synced_at: "2026-07-02T00:00:00.000Z",
  });
});

test("Airhub UK country sync does not duplicate UK when GB control row exists", () => {
  const payload = buildAirhubCountrySyncPayload(
    {
      countryregiondetail: [
        { name: "Wales", code: "GB" },
        { name: "United Kingdom", code: "UK" },
      ],
    },
    "2026-07-02T00:00:00.000Z",
  );

  assert.deepEqual(
    payload.rows.map((row) => row.iso_code),
    ["GB"],
  );
  assert.equal(payload.duplicatesDropped, 1);
});

test("missing country code or name rows are skipped", () => {
  const payload = buildAirhubCountrySyncPayload(
    {
      countryregiondetail: [
        { name: "", code: "AA" },
        { name: "Blank code", code: "" },
        { name: "Only valid", code: "OV" },
      ],
    },
    "2026-07-02T00:00:00.000Z",
  );

  assert.equal(payload.received, 3);
  assert.equal(payload.valid, 1);
  assert.equal(payload.duplicatesDropped, 0);
  assert.deepEqual(
    payload.rows.map((row) => row.iso_code),
    ["OV"],
  );
});

test("duplicate stats are calculated after invalid rows are skipped", () => {
  const payload = buildAirhubCountrySyncPayloadFromItems(
    [
      { name: "India", code: "in", raw: { name: "India", code: "in" } },
      { name: "India Republic", code: "IN", raw: { name: "India Republic", code: "IN" } },
      { name: "", code: "AE", raw: { name: "", code: "AE" } },
      { name: "United Arab Emirates", code: "ae", raw: { name: "United Arab Emirates", code: "ae" } },
    ],
    "2026-07-02T00:00:00.000Z",
  );

  assert.equal(payload.received, 4);
  assert.equal(payload.valid, 3);
  assert.equal(payload.duplicatesDropped, 1);
  assert.deepEqual(
    payload.rows.map((row) => [row.iso_code, row.name]),
    [
      ["IN", "India Republic"],
      ["AE", "United Arab Emirates"],
    ],
  );
});

test("PurchaseSim request sends unique_order_id", () => {
  assert.deepEqual(
    buildPurchaseSimRequest({
      partnerCode: 89508211,
      planCode: AIRHUB_DEFAULT_TEST_PLAN_CODE,
      travelDate: "2026-07-05",
      uniqueOrderId: "airhub_unique_1",
    }),
    {
      partnerCode: 89508211,
      planCode: AIRHUB_DEFAULT_TEST_PLAN_CODE,
      travelDate: "2026-07-05",
      unique_order_id: "airhub_unique_1",
    },
  );
});

test("GetActivationCode request uses Airhub orderid array shape", () => {
  assert.deepEqual(
    buildActivationCodeRequest({
      partnerCode: 89508211,
      orderIds: ["12713137", " 12711895 ", ""],
    }),
    {
      partnerCode: 89508211,
      orderid: ["12713137", "12711895"],
    },
  );
});

test("default Airhub test plan code is the confirmed UK 1 MB plan", () => {
  assert.equal(AIRHUB_DEFAULT_TEST_PLAN_CODE, "2116296");
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

test("/esim/in page model normalizes to IN and renders a safe empty state", () => {
  const model = buildAirhubCountryPlanPageModel({
    routeCountryCode: "in",
    country: {
      isoCode: "IN",
      name: "India",
      regionName: null,
      flagUrl: null,
      globalFlagUrl: null,
    },
    plans: [],
    planStatus: "ok",
  });

  assert.equal(model.countryCode, "IN");
  assert.equal(model.countryName, "India");
  assert.equal(model.state, "empty");
});

test("missing Airhub country produces safe country-not-available page state", () => {
  const model = buildAirhubCountryPlanPageModel({
    routeCountryCode: "zz",
    country: null,
    plans: [],
    planStatus: "ok",
  });

  assert.equal(model.countryCode, "ZZ");
  assert.equal(model.countryName, null);
  assert.equal(model.state, "country_not_available");
});

test("Airhub plan fetch failure produces safe page state", () => {
  const model = buildAirhubCountryPlanPageModel({
    routeCountryCode: "IN",
    country: {
      isoCode: "IN",
      name: "India",
      regionName: null,
      flagUrl: null,
      globalFlagUrl: null,
    },
    plans: [],
    planStatus: "fetch_failed",
  });

  assert.equal(model.state, "fetch_failed");
  assert.deepEqual(model.plans, []);
});

test("public plan API can return safe JSON for provider 502", () => {
  assert.deepEqual(
    toSafeAirhubPlanFetchFailure(
      new AirhubError("airhub_plan_fetch_failed", "Airhub request failed.", 502),
    ),
    {
      ok: false,
      code: "airhub_plan_fetch_failed",
      message: "Plan fetching is temporarily unavailable.",
      status: 502,
    },
  );
});

test("empty Airhub plan response is valid and produces no plans", () => {
  const response = { isSuccess: true, data: [] };

  assert.equal(isValidAirhubPlanInformationResponse(response), true);
  assert.deepEqual(parsePlanInformationResponse(response), []);
});

test("invalid Airhub plan shape is not valid and does not throw while parsing", () => {
  const response = { isSuccess: true, message: "Successful" };

  assert.equal(isValidAirhubPlanInformationResponse(response), false);
  assert.deepEqual(parsePlanInformationResponse(response), []);
});

test("plan and country endpoints are separate from PurchaseSim", () => {
  assert.equal(AIRHUB_ENDPOINTS.countryRegionDetail, "/api/ESIM/Getcountry_regiondetail");
  assert.equal(AIRHUB_ENDPOINTS.planInformation, "/api/ESIM/GetPlanInformation");
  assert.equal(AIRHUB_ENDPOINTS.purchaseSim, "/api/ESIM/PurhaseSim");
  assert.equal(AIRHUB_ENDPOINTS.activationCode, "/api/ESIM/GetActivationCode");
  assert.notEqual(AIRHUB_ENDPOINTS.planInformation, AIRHUB_ENDPOINTS.purchaseSim);
  assert.notEqual(AIRHUB_ENDPOINTS.countryRegionDetail, AIRHUB_ENDPOINTS.purchaseSim);
});

test("purchase is disabled unless explicitly enabled", () => {
  assert.deepEqual(
    decideAirhubPurchaseStart({
      purchaseEnabled: false,
      testPurchaseOnly: true,
      allowNonTestPlanPurchase: false,
      testPlanCode: AIRHUB_DEFAULT_TEST_PLAN_CODE,
      planCode: AIRHUB_DEFAULT_TEST_PLAN_CODE,
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
      testPlanCode: AIRHUB_DEFAULT_TEST_PLAN_CODE,
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
      testPlanCode: AIRHUB_DEFAULT_TEST_PLAN_CODE,
      planCode: AIRHUB_DEFAULT_TEST_PLAN_CODE,
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
      planCode: AIRHUB_DEFAULT_TEST_PLAN_CODE,
      countryCode: "GB",
    }),
    {
      charge_type: "esim_airhub",
      internal_order_id: "order-id",
      plan_code: AIRHUB_DEFAULT_TEST_PLAN_CODE,
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
      testPlanCode: AIRHUB_DEFAULT_TEST_PLAN_CODE,
      planCode: AIRHUB_DEFAULT_TEST_PLAN_CODE,
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
      provider_order_id: "12713137",
      plan_code: AIRHUB_DEFAULT_TEST_PLAN_CODE,
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
        planCode: AIRHUB_DEFAULT_TEST_PLAN_CODE,
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
  assert.equal(dto.planCode, AIRHUB_DEFAULT_TEST_PLAN_CODE);
});

// ---- Phase 3A: PurchaseSim (guarded, test-plan-only) ----------------------

test("PurchaseSim endpoint keeps the exact Airhub spelling", () => {
  assert.equal(AIRHUB_ENDPOINTS.purchaseSim, "/api/ESIM/PurhaseSim");
});

test("default test plan code is 2116296", () => {
  assert.equal(AIRHUB_DEFAULT_TEST_PLAN_CODE, "2116296");
});

test("buildPurchaseSimRequest uses unique_order_id (UK test plan 2116296)", () => {
  const body = buildPurchaseSimRequest({
    partnerCode: 89508211,
    planCode: "2116296",
    uniqueOrderId: "uoid-123",
    travelDate: "2026-08-01",
  });
  assert.deepEqual(body, {
    partnerCode: 89508211,
    planCode: "2116296",
    unique_order_id: "uoid-123",
    travelDate: "2026-08-01",
  });

  // travelDate is omitted when absent (never invented).
  const noDate = buildPurchaseSimRequest({
    partnerCode: 89508211,
    planCode: "2116296",
    uniqueOrderId: "uoid-123",
  });
  assert.equal("travelDate" in noDate, false);
  assert.equal(noDate.unique_order_id, "uoid-123");
});

test("decideAirhubPurchaseStart: disabled flag prevents any provider call", () => {
  const decision = decideAirhubPurchaseStart({
    purchaseEnabled: false,
    testPurchaseOnly: true,
    allowNonTestPlanPurchase: false,
    testPlanCode: "2116296",
    planCode: "2116296",
    status: "paid",
    hasActivationCode: false,
  });
  assert.equal(decision.kind, "disabled");
});

test("decideAirhubPurchaseStart: test-only guard blocks non-test plan", () => {
  const decision = decideAirhubPurchaseStart({
    purchaseEnabled: true,
    testPurchaseOnly: true,
    allowNonTestPlanPurchase: false,
    testPlanCode: "2116296",
    planCode: "9999999",
    status: "paid",
    hasActivationCode: false,
  });
  assert.equal(decision.kind, "blocked_plan");
});

test("decideAirhubPurchaseStart: allows the test plan when enabled", () => {
  const decision = decideAirhubPurchaseStart({
    purchaseEnabled: true,
    testPurchaseOnly: true,
    allowNonTestPlanPurchase: false,
    testPlanCode: "2116296",
    planCode: "2116296",
    status: "paid",
    hasActivationCode: false,
  });
  assert.equal(decision.kind, "ready");
});

test("decideAirhubPurchaseStart: skips already fulfilled / started orders", () => {
  assert.equal(
    decideAirhubPurchaseStart({
      purchaseEnabled: true,
      testPurchaseOnly: true,
      allowNonTestPlanPurchase: false,
      testPlanCode: "2116296",
      planCode: "2116296",
      status: "paid",
      hasActivationCode: true,
    }).kind,
    "skip_existing",
  );
  assert.equal(
    decideAirhubPurchaseStart({
      purchaseEnabled: true,
      testPurchaseOnly: true,
      allowNonTestPlanPurchase: false,
      testPlanCode: "2116296",
      planCode: "2116296",
      status: "purchase_started",
      hasActivationCode: false,
    }).kind,
    "skip_existing",
  );
});

test("parsePurchaseSimResponse extracts a provider order id defensively", () => {
  const parsed = parsePurchaseSimResponse({ status: "success", data: { orderid: "12713137" } });
  assert.equal(parsed.classification, "success");
  assert.equal(parsed.providerOrderId, "12713137");
});

test("parsePurchaseSimResponse extracts activation and SIM fields defensively", () => {
  const parsed = parsePurchaseSimResponse({
    success: true,
    data: [
      {
        orderId: "12713137",
        activationCode: "ACT-123",
        LPA: "LPA:1$smdp$match",
        APN: "internet",
        simID: "SIM-123",
        simPIN: "0000",
        qrPayload: "QR-PAYLOAD",
      },
    ],
  });

  assert.equal(parsed.classification, "success");
  assert.equal(parsed.providerOrderId, "12713137");
  assert.equal(parsed.activationCode, "ACT-123");
  assert.equal(parsed.lpaCode, "LPA:1$smdp$match");
  assert.equal(parsed.apn, "internet");
  assert.equal(parsed.simId, "SIM-123");
  assert.equal(parsed.simPin, "0000");
  assert.equal(parsed.qrPayload, "QR-PAYLOAD");
});

test("parsePurchaseSimResponse classifies explicit failure without an order id", () => {
  const parsed = parsePurchaseSimResponse({ success: false, error: "insufficient_balance" });
  assert.equal(parsed.classification, "failed");
  assert.equal(parsed.errorCode, "insufficient_balance");
  assert.equal(parsed.providerOrderId, null);
});

test("parsePurchaseSimResponse classifies explicit failure even with an order id", () => {
  const parsed = parsePurchaseSimResponse({
    success: false,
    data: { orderid: "12713137", error: "insufficient_balance" },
  });
  assert.equal(parsed.classification, "failed");
  assert.equal(parsed.providerOrderId, "12713137");
  assert.equal(decidePurchaseOutcomeStatus(parsed).status, "purchase_failed");
});

test("parsePurchaseSimResponse never throws on unknown shapes", () => {
  assert.equal(parsePurchaseSimResponse(null).classification, "unknown");
  assert.equal(parsePurchaseSimResponse("nope").classification, "unknown");
  assert.equal(parsePurchaseSimResponse({}).classification, "unknown");
});

test("decidePurchaseOutcomeStatus never fakes fulfilled", () => {
  // failed -> purchase_failed
  assert.equal(
    decidePurchaseOutcomeStatus(parsePurchaseSimResponse({ error: "declined" })).status,
    "purchase_failed",
  );
  // success + order id but no activation -> pending_review (awaiting activation)
  assert.deepEqual(
    decidePurchaseOutcomeStatus(parsePurchaseSimResponse({ status: "success", orderid: "111" })),
    { status: "pending_review", reason: "awaiting_activation" },
  );
  // success + order id + activation -> fulfilled
  assert.equal(
    decidePurchaseOutcomeStatus(
      parsePurchaseSimResponse({ status: "success", orderid: "111", activation_code: "LPA:1$x$y" }),
    ).status,
    "fulfilled",
  );
  // success-looking but missing order id -> pending_review
  assert.deepEqual(
    decidePurchaseOutcomeStatus(parsePurchaseSimResponse({ success: true })),
    { status: "pending_review", reason: "missing_provider_order_id" },
  );
  // unknown -> pending_review
  assert.equal(decidePurchaseOutcomeStatus(parsePurchaseSimResponse({})).status, "pending_review");
});
