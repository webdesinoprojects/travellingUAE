export const AIRHUB_ENDPOINTS = {
  login: "/api/Authentication/UserLogin",
  planInformation: "/api/ESIM/GetPlanInformation",
  purchaseSim: "/api/ESIM/PurhaseSim",
  activationCode: "/api/ESIM/GetActivationCode",
  wallet: "/api/ESIM/GetWallet",
  individualWallet: "/api/ESIM/get_wallet_invidual",
  orderDetail: "/api/ESIM/GetOrderDetail",
  countryRegionDetail: "/api/ESIM/Getcountry_regiondetail",
  countryWiseFlag: "/api/ESIM/Get_country_wise_flag",
  renewInsert: "/api/Renew/InsertRenew",
  renewData: "/api/Renew/GetRenewData",
} as const;

export const AIRHUB_DEFAULT_TEST_PLAN_CODE = "2116296";

export type UnknownRecord = Record<string, unknown>;

export type AirhubLoginRequest = {
  userName: string;
  password: string;
};

export type AirhubPlanInformationRequest = {
  partnerCode: number;
  flag: number;
  countryCode?: string;
  multiplecountrycode?: string[];
};

export type AirhubPurchaseSimRequest = {
  partnerCode: number;
  planCode: string;
  travelDate?: string;
  unique_order_id: string;
};

export type AirhubActivationCodeRequest = {
  partnerCode: number;
  orderid: string[];
};

export type AirhubCountryRegionItem = {
  name: string;
  code: string;
  flag?: string | null;
  raw: UnknownRecord;
};

export type AirhubCountryUpsertRow = {
  iso_code: string;
  name: string;
  airhub_code: string;
  flag_url: string | null;
  raw: UnknownRecord;
  synced_at: string;
};

export type AirhubCountrySyncPayload = {
  received: number;
  valid: number;
  duplicatesDropped: number;
  rows: AirhubCountryUpsertRow[];
};

export type AirhubPlan = {
  planCode: string;
  planName: string | null;
  planType: string | null;
  countryName: string | null;
  countryCode: string | null;
  currency: string | null;
  price: number | null;
  dataUnit: string | null;
  validity: string | null;
  validityType: string | null;
  capacity: string | null;
  connectivity: string | null;
  networkOperator: string | null;
  countriesCovered: string | null;
  travelDateRequirement: string | null;
  additionalInfo: string | null;
  subscription: boolean | null;
  subscriptionPeriod: string | null;
  phoneNumber: boolean | null;
  raw: UnknownRecord;
};

export type AirhubPublicPlan = {
  planCode: string;
  planName: string | null;
  planType: string | null;
  countryName: string | null;
  countryCode: string | null;
  currency: string | null;
  price: number | null;
  dataUnit: string | null;
  validity: string | null;
  validityType: string | null;
  capacity: string | null;
  connectivity: string | null;
  networkOperator: string | null;
  countriesCovered: string | null;
  travelDateRequirement: string | null;
  additionalInfo: string | null;
  subscription: boolean | null;
  subscriptionPeriod: string | null;
  phoneNumber: boolean | null;
};

export type AirhubPublicCountry = {
  isoCode: string;
  name: string;
  regionName: string | null;
  flagUrl: string | null;
  globalFlagUrl: string | null;
};

export type AirhubPlanFetchDecision =
  | { kind: "cache" }
  | { kind: "disabled" }
  | { kind: "provider" };

export type AirhubPublicOrder = {
  publicReference: string;
  status: string;
  guestEmail: string;
  planCode: string;
  planName: string | null;
  countryCode: string | null;
  countryName: string | null;
  price: number | null;
  currency: string | null;
  travelDate: string | null;
  activationCode: string | null;
  apn: string | null;
  simId: string | null;
  simPin: string | null;
  qrPayload: string | null;
};

export type PurchaseDecision =
  | { kind: "skip_existing"; reason: "already_fulfilled" | "already_started" }
  | { kind: "disabled"; code: "airhub_purchase_disabled" }
  | { kind: "blocked_plan"; code: "airhub_purchase_disabled" }
  | { kind: "ready" };

export function buildLoginRequest(input: {
  userName: string;
  password: string;
}): AirhubLoginRequest {
  return {
    userName: input.userName,
    password: input.password,
  };
}

export function parseLoginToken(response: unknown): string | null {
  if (!isRecord(response)) return null;
  return readString(response, "token");
}

export function buildBearerHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export function buildPlanInformationRequest(input: {
  partnerCode: number;
  flag: number;
  countryCode?: string | null;
}): AirhubPlanInformationRequest {
  const body: AirhubPlanInformationRequest = {
    partnerCode: input.partnerCode,
    flag: input.flag,
  };

  if (input.countryCode) {
    body.countryCode = input.countryCode;
    body.multiplecountrycode = [input.countryCode];
  }

  return body;
}

export function buildPurchaseSimRequest(input: {
  partnerCode: number;
  planCode: string;
  travelDate?: string | null;
  uniqueOrderId: string;
}): AirhubPurchaseSimRequest {
  const body: AirhubPurchaseSimRequest = {
    partnerCode: input.partnerCode,
    planCode: input.planCode,
    unique_order_id: input.uniqueOrderId,
  };

  if (input.travelDate) {
    body.travelDate = input.travelDate;
  }

  return body;
}

export function buildActivationCodeRequest(input: {
  partnerCode: number;
  orderIds: string[];
}): AirhubActivationCodeRequest {
  return {
    partnerCode: input.partnerCode,
    orderid: input.orderIds.map((orderId) => orderId.trim()).filter(Boolean),
  };
}

export function buildCountryRegionUrl(baseUrl: string, flag: 1 | 2): string {
  const url = new URL(AIRHUB_ENDPOINTS.countryRegionDetail, normalizeBaseUrl(baseUrl));
  url.searchParams.set("flag", String(flag));
  return url.toString();
}

export function buildCountryWiseFlagUrl(baseUrl: string, countryCode: string): string {
  const url = new URL(AIRHUB_ENDPOINTS.countryWiseFlag, normalizeBaseUrl(baseUrl));
  url.searchParams.set("countryCode", countryCode);
  return url.toString();
}

export function parseCountryRegionResponse(response: unknown): AirhubCountryRegionItem[] {
  return readCountryRegionRecords(response).flatMap((item) => {
    const name = readString(item, "name");
    const code = readString(item, "code");
    if (!name || !code) return [];

    return [
      {
        name,
        code,
        flag: readString(item, "flag"),
        raw: item,
      },
    ];
  });
}

export function buildAirhubCountryUpsertRows(
  countries: AirhubCountryRegionItem[],
  syncedAt: string,
): AirhubCountryUpsertRow[] {
  return buildAirhubCountrySyncPayloadFromItems(countries, syncedAt).rows;
}

export function buildAirhubCountrySyncPayload(
  response: unknown,
  syncedAt: string,
): AirhubCountrySyncPayload {
  return buildAirhubCountrySyncPayloadFromItems(
    readCountryRegionRecords(response).map((item) => ({
      name: readString(item, "name") ?? "",
      code: readString(item, "code") ?? "",
      flag: readString(item, "flag"),
      raw: item,
    })),
    syncedAt,
  );
}

export function buildAirhubCountrySyncPayloadFromItems(
  countries: AirhubCountryRegionItem[],
  syncedAt: string,
): AirhubCountrySyncPayload {
  const rowsByIsoCode = new Map<string, AirhubCountryUpsertRow>();
  let valid = 0;

  for (const country of countries) {
    const isoCode = normalizeCountryCode(country.code);
    const airhubCode = normalizeProviderCountryIdentifier(country.code);
    const name = normalizeRequiredString(country.name);

    if (!isoCode || !airhubCode || !name) {
      continue;
    }

    valid += 1;
    const row: AirhubCountryUpsertRow = {
      iso_code: isoCode,
      name,
      airhub_code: airhubCode,
      flag_url: normalizeOptionalString(country.flag),
      raw: country.raw,
      synced_at: syncedAt,
    };
    const existing = rowsByIsoCode.get(isoCode);

    if (!existing || isBetterCountryUpsertRow(row, existing)) {
      rowsByIsoCode.set(isoCode, row);
    }
  }

  const rows = Array.from(rowsByIsoCode.values());

  return {
    received: countries.length,
    valid,
    duplicatesDropped: valid - rows.length,
    rows,
  };
}

export function parsePlanInformationResponse(response: unknown): AirhubPlan[] {
  return extractPlanRecords(response).flatMap((item) => {
    const planCode = readString(item, "planCode");
    if (!planCode) return [];

    return [
      {
        planCode,
        planName: readString(item, "planName"),
        planType: readString(item, "planType"),
        countryName: readString(item, "countryName"),
        countryCode: readString(item, "countryCode"),
        currency: readString(item, "currency"),
        price: readNumber(item, "price"),
        dataUnit: readString(item, "dataUnit"),
        validity: readString(item, "validity"),
        validityType: readString(item, "validityType"),
        capacity: readString(item, "capacity"),
        connectivity: readString(item, "connectivity"),
        networkOperator: readString(item, "network_operator"),
        countriesCovered: readString(item, "countries_covered"),
        travelDateRequirement: readString(item, "travel_date"),
        additionalInfo: readString(item, "additionalInfo"),
        subscription: readBoolean(item, "subscription"),
        subscriptionPeriod: readString(item, "subscriptionPeriod"),
        phoneNumber: readBoolean(item, "phoneNumber"),
        raw: item,
      },
    ];
  });
}

export function isValidAirhubPlanInformationResponse(response: unknown): boolean {
  if (Array.isArray(response)) {
    return true;
  }

  if (!isRecord(response)) {
    return false;
  }

  if (readString(response, "planCode")) {
    return true;
  }

  for (const key of ["data", "plans", "items", "result"]) {
    const value = response[key];

    if (Array.isArray(value)) {
      return true;
    }
  }

  return Object.values(response).some(
    (value) =>
      Array.isArray(value) &&
      value.some((item) => isRecord(item) && readString(item, "planCode")),
  );
}

export function normalizeAirhubCountryCode(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

export function buildAirhubPlanRequestCountryCode(input: {
  countryCode: string;
  airhubCode?: string | null;
  countryName?: string | null;
}): string {
  const routeCountryCode = input.countryCode.trim().toUpperCase();
  const confirmed = resolveConfirmedAirhubCountryCode(routeCountryCode);
  if (confirmed) {
    return confirmed;
  }

  const providerCode = normalizeProviderCountryIdentifier(input.airhubCode);
  if (providerCode) {
    return providerCode;
  }

  const providerName = normalizeProviderCountryIdentifier(input.countryName);
  if (providerName && /^[A-Z]{2,3}$/.test(providerName)) {
    return providerName;
  }

  return routeCountryCode || input.countryCode.trim();
}

function resolveConfirmedAirhubCountryCode(countryCode: string): string | null {
  if (countryCode === "UK" || countryCode === "GB") return "UK";
  if (countryCode === "US") return "USA";
  return null;
}

function normalizeProviderCountryIdentifier(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return /^[a-z]{2,3}$/i.test(trimmed) ? trimmed.toUpperCase() : trimmed;
}

export function decideAirhubPlanFetch(input: {
  enabled: boolean;
  hasCachedPlans: boolean;
}): AirhubPlanFetchDecision {
  if (input.hasCachedPlans) {
    return { kind: "cache" };
  }

  return input.enabled ? { kind: "provider" } : { kind: "disabled" };
}

export function buildEsimStripeMetadata(input: {
  orderId: string;
  planCode: string;
  countryCode?: string | null;
}): Record<string, string> {
  return {
    charge_type: "esim_airhub",
    internal_order_id: input.orderId,
    plan_code: input.planCode,
    country_code: input.countryCode ?? "",
  };
}

export function buildPublicPlanDto(plan: AirhubPlan): AirhubPublicPlan {
  return {
    planCode: plan.planCode,
    planName: plan.planName,
    planType: plan.planType,
    countryName: plan.countryName,
    countryCode: plan.countryCode,
    currency: plan.currency,
    price: plan.price,
    dataUnit: plan.dataUnit,
    validity: plan.validity,
    validityType: plan.validityType,
    capacity: plan.capacity,
    connectivity: plan.connectivity,
    networkOperator: plan.networkOperator,
    countriesCovered: plan.countriesCovered,
    travelDateRequirement: plan.travelDateRequirement,
    additionalInfo: plan.additionalInfo,
    subscription: plan.subscription,
    subscriptionPeriod: plan.subscriptionPeriod,
    phoneNumber: plan.phoneNumber,
  };
}

export function decideAirhubPurchaseStart(input: {
  purchaseEnabled: boolean;
  testPurchaseOnly: boolean;
  allowNonTestPlanPurchase: boolean;
  testPlanCode: string;
  planCode: string;
  status: string;
  hasActivationCode: boolean;
}): PurchaseDecision {
  if (input.hasActivationCode || input.status === "fulfilled") {
    return { kind: "skip_existing", reason: "already_fulfilled" };
  }

  if (input.status === "purchase_started") {
    return { kind: "skip_existing", reason: "already_started" };
  }

  if (!input.purchaseEnabled) {
    return { kind: "disabled", code: "airhub_purchase_disabled" };
  }

  if (
    input.testPurchaseOnly &&
    !input.allowNonTestPlanPurchase &&
    input.planCode !== input.testPlanCode
  ) {
    return { kind: "blocked_plan", code: "airhub_purchase_disabled" };
  }

  return { kind: "ready" };
}

/**
 * Defensive parser for the PurchaseSim response.
 *
 * The exact response shape is NOT fully confirmed, so this never throws, tries a
 * range of candidate key names (and common `data`/`result` envelopes), and
 * classifies success / failed / unknown. Extraction of activation/sim fields is
 * best-effort; missing critical ids are handled by decidePurchaseOutcomeStatus.
 */
export type AirhubPurchaseParseResult = {
  classification: "success" | "failed" | "unknown";
  providerOrderId: string | null;
  activationCode: string | null;
  lpaCode: string | null;
  apn: string | null;
  simId: string | null;
  simPin: string | null;
  qrPayload: string | null;
  errorCode: string | null;
};

export function parsePurchaseSimResponse(response: unknown): AirhubPurchaseParseResult {
  const result: AirhubPurchaseParseResult = {
    classification: "unknown",
    providerOrderId: null,
    activationCode: null,
    lpaCode: null,
    apn: null,
    simId: null,
    simPin: null,
    qrPayload: null,
    errorCode: null,
  };

  if (!isRecord(response)) {
    return result;
  }

  // Some providers wrap the payload in data/result, sometimes as a single-item
  // array. Search common envelopes first, then the root.
  const sources = collectPurchasePayloadSources(response);

  result.providerOrderId = firstString(sources, [
    "orderid",
    "order_id",
    "orderId",
    "orderID",
    "airhub_order_id",
    "airhubOrderId",
    "providerOrderId",
    "provider_order_id",
    "providerId",
    "provider_id",
  ]);
  result.activationCode = firstString(sources, [
    "activation_code",
    "activationCode",
    "activationcode",
    "ActivationCode",
  ]);
  result.lpaCode = firstString(sources, ["lpa_code", "lpaCode", "lpa", "LPA"]);
  result.apn = firstString(sources, ["apn", "APN"]);
  result.simId = firstString(sources, ["sim_id", "simId", "simID", "simid", "iccid", "ICCID"]);
  result.simPin = firstString(sources, ["sim_pin", "simPin", "simPIN", "simpin", "pin", "PIN"]);
  result.qrPayload = firstString(sources, [
    "qr_payload",
    "qrPayload",
    "qrpayload",
    "qrcode",
    "qr_code",
    "qrCode",
    "qr",
  ]);
  result.errorCode = firstString(sources, [
    "error",
    "errorCode",
    "error_code",
    "errorMessage",
    "error_message",
  ]);

  const statusText = (
    firstString(sources, ["status", "message", "responseMessage", "resultMessage"]) ?? ""
  ).toLowerCase();
  const successFlag = firstBoolean(sources, ["success", "isSuccess", "is_success"]);
  const looksFailed =
    result.errorCode !== null ||
    successFlag === false ||
    /\b(fail|failed|failure|error|declin|invalid|not\s*allowed)\b/.test(statusText);
  const looksSuccess =
    successFlag === true ||
    /\b(success|ok|completed|complete|purchased)\b/.test(statusText) ||
    result.providerOrderId !== null;

  if (looksFailed) {
    result.classification = "failed";
  } else if (looksSuccess) {
    result.classification = "success";
  } else {
    result.classification = "unknown";
  }

  return result;
}

function collectPurchasePayloadSources(response: UnknownRecord): UnknownRecord[] {
  const sources: UnknownRecord[] = [];
  for (const key of ["data", "result", "order", "orders", "response"]) {
    const value = response[key];
    if (isRecord(value)) {
      sources.push(value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (isRecord(item)) sources.push(item);
      }
    }
  }
  sources.push(response);
  return sources;
}

/** Map a parsed PurchaseSim result to a safe order status. Never fakes success. */
export type EsimPurchaseOutcome = {
  status: "fulfilled" | "pending_review" | "purchase_failed";
  reason: string;
};

export function decidePurchaseOutcomeStatus(parse: AirhubPurchaseParseResult): EsimPurchaseOutcome {
  if (parse.classification === "failed") {
    return { status: "purchase_failed", reason: parse.errorCode ?? "provider_failed" };
  }

  if (parse.classification === "success") {
    if (!parse.providerOrderId) {
      // "Successful looking" but missing the critical id -> needs a human.
      return { status: "pending_review", reason: "missing_provider_order_id" };
    }
    if (parse.activationCode || parse.qrPayload) {
      return { status: "fulfilled", reason: "activation_present" };
    }
    // Order placed, but activation is fetched later (GetActivationCode phase).
    return { status: "pending_review", reason: "awaiting_activation" };
  }

  return { status: "pending_review", reason: "unknown_response" };
}

function firstString(sources: UnknownRecord[], keys: string[]): string | null {
  for (const source of sources) {
    for (const key of keys) {
      const value = readString(source, key);
      if (value) return value;
    }
  }
  return null;
}

function firstBoolean(sources: UnknownRecord[], keys: string[]): boolean | null {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "boolean") return value;
      if (typeof value === "string") {
        const lowered = value.trim().toLowerCase();
        if (lowered === "true") return true;
        if (lowered === "false") return false;
      }
    }
  }
  return null;
}

export function buildPublicOrderDto(row: {
  public_reference: string;
  status: string;
  guest_email: string;
  plan_code: string;
  plan_name: string | null;
  country_code: string | null;
  country_name: string | null;
  price: number | null;
  currency: string | null;
  travel_date: string | null;
  activation_code: string | null;
  apn: string | null;
  sim_id: string | null;
  sim_pin: string | null;
  qr_payload: string | null;
}): AirhubPublicOrder {
  return {
    publicReference: row.public_reference,
    status: row.status,
    guestEmail: row.guest_email,
    planCode: row.plan_code,
    planName: row.plan_name,
    countryCode: row.country_code,
    countryName: row.country_name,
    price: row.price,
    currency: row.currency,
    travelDate: row.travel_date,
    activationCode: row.activation_code,
    apn: row.apn,
    simId: row.sim_id,
    simPin: row.sim_pin,
    qrPayload: row.qr_payload,
  };
}

export function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

function extractPlanRecords(response: unknown): UnknownRecord[] {
  if (Array.isArray(response)) {
    return response.filter(isRecord);
  }

  if (!isRecord(response)) {
    return [];
  }

  for (const value of Object.values(response)) {
    if (
      Array.isArray(value) &&
      value.some((item) => isRecord(item) && readString(item, "planCode"))
    ) {
      return value.filter(isRecord);
    }
  }

  return readString(response, "planCode") ? [response] : [];
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(source: UnknownRecord, key: string): string | null {
  const value = source[key];
  if (value == null || value === "") return null;
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function readNumber(source: UnknownRecord, key: string): number | null {
  const value = source[key];
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/[^\d.-]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readBoolean(source: UnknownRecord, key: string): boolean | null {
  const value = source[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return null;
}

function readCountryRegionRecords(response: unknown): UnknownRecord[] {
  if (!isRecord(response) || !Array.isArray(response.countryregiondetail)) {
    return [];
  }

  return response.countryregiondetail.filter(isRecord);
}

function normalizeCountryCode(value: string | null | undefined): string | null {
  const normalized = normalizeProviderCountryIdentifier(value);
  if (!normalized) return null;
  if (normalized === "USA") return "US";
  if (normalized === "GB") return "UK";
  return normalized;
}

function normalizeRequiredString(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function isBetterCountryUpsertRow(
  candidate: AirhubCountryUpsertRow,
  existing: AirhubCountryUpsertRow,
) {
  if (candidate.flag_url && !existing.flag_url) {
    return true;
  }

  if (!candidate.flag_url && existing.flag_url) {
    return false;
  }

  return candidate.name.length > existing.name.length;
}
