export const AIRHUB_ENDPOINTS = {
  login: "/api/Authentication/UserLogin",
  planInformation: "/api/ESIM/GetPlanInformation",
  purchaseSim: "/api/ESIM/PurhaseSim",
  wallet: "/api/ESIM/GetWallet",
  individualWallet: "/api/ESIM/get_wallet_invidual",
  orderDetail: "/api/ESIM/GetOrderDetail",
  countryRegionDetail: "/api/ESIM/Getcountry_regiondetail",
  countryWiseFlag: "/api/ESIM/Get_country_wise_flag",
  renewInsert: "/api/Renew/InsertRenew",
  renewData: "/api/Renew/GetRenewData",
} as const;

export type UnknownRecord = Record<string, unknown>;

export type AirhubLoginRequest = {
  userName: string;
  password: string;
};

export type AirhubPlanInformationRequest = {
  partnerCode: number;
  flag: number;
  countryCode?: string;
};

export type AirhubPurchaseSimRequest = {
  partnerCode: number;
  planCode: string;
  travelDate?: string;
  unique_order_id: string;
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
  if (!isRecord(response) || !Array.isArray(response.countryregiondetail)) {
    return [];
  }

  return response.countryregiondetail.flatMap((item) => {
    if (!isRecord(item)) return [];
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
  return countries.map((country) => ({
    iso_code: country.code.toUpperCase(),
    name: country.name,
    airhub_code: country.code,
    flag_url: country.flag ?? null,
    raw: country.raw,
    synced_at: syncedAt,
  }));
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
