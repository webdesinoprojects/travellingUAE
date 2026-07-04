import "server-only";

import { createHash } from "node:crypto";

import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/server/supabase/client";

import { airhubJsonRequest } from "./client";
import { getAirhubConfig } from "./config";
import {
  AIRHUB_ENDPOINTS,
  type AirhubPublicPlan,
  decideAirhubPlanFetch,
  buildPlanInformationRequest,
  buildPublicPlanDto,
  isValidAirhubPlanInformationResponse,
  normalizeAirhubCountryCode,
  parsePlanInformationResponse,
} from "./contracts";
import { resolveAirhubPlanLookupCountryCode } from "./countries";
import { AIRHUB_PLAN_FETCH_UNAVAILABLE_MESSAGE, AirhubError } from "./errors";

export type AirhubPlanListing = {
  countryCode: string;
  status: "ok" | "disabled";
  source: "cache" | "provider" | "disabled";
  plans: AirhubPublicPlan[];
};

type PlanCacheRow = {
  plans: unknown;
};

export async function getAirhubPlansForCountry(
  countryCode: string,
): Promise<AirhubPlanListing> {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  const planLookupCountryCode = await resolveAirhubPlanLookupCountryCode(
    normalizedCountryCode,
  );
  const config = getAirhubConfig();
  const requestHash = buildPlanRequestHash({
    partnerCode: config.partnerCode,
    flag: 5,
    countryCode: planLookupCountryCode,
  });

  const cached = await readPlanCache(requestHash);
  const decision = decideAirhubPlanFetch({
    enabled: config.enabled,
    hasCachedPlans: Boolean(cached),
  });

  if (decision.kind === "cache" && cached) {
    return {
      countryCode: normalizedCountryCode,
      status: "ok",
      source: "cache",
      plans: cached,
    };
  }

  if (decision.kind === "disabled") {
    return {
      countryCode: normalizedCountryCode,
      status: "disabled",
      source: "disabled",
      plans: [],
    };
  }

  const body = buildPlanInformationRequest({
    partnerCode: config.partnerCode,
    flag: 5,
    countryCode: planLookupCountryCode,
  });
  const response = await airhubJsonRequest<unknown>(AIRHUB_ENDPOINTS.planInformation, {
    method: "POST",
    body,
    errorCode: "airhub_plan_fetch_failed",
  });

  if (!isValidAirhubPlanInformationResponse(response)) {
    logInvalidAirhubPlanResponse(body, response);

    throw new AirhubError(
      "airhub_plan_fetch_failed",
      AIRHUB_PLAN_FETCH_UNAVAILABLE_MESSAGE,
      502,
    );
  }

  const plans = parsePlanInformationResponse(response).map(buildPublicPlanDto);
  await writePlanCache({
    requestHash,
    countryCode: normalizedCountryCode,
    flag: 5,
    plans,
    ttlSeconds: config.planCacheTtlSeconds,
  });

  return {
    countryCode: normalizedCountryCode,
    status: "ok",
    source: "provider",
    plans,
  };
}

export async function findAirhubPlan(
  countryCode: string,
  planCode: string,
): Promise<AirhubPublicPlan | null> {
  const listing = await getAirhubPlansForCountry(countryCode);
  const normalizedPlanCode = planCode.trim();

  return (
    listing.plans.find((plan) => plan.planCode === normalizedPlanCode) ?? null
  );
}

export function buildPlanRequestHash(input: {
  partnerCode: number;
  flag: number;
  countryCode: string;
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        provider: "airhub",
        endpoint: AIRHUB_ENDPOINTS.planInformation,
        partnerCode: input.partnerCode,
        flag: input.flag,
        countryCode: input.countryCode.toLowerCase(),
      }),
    )
    .digest("hex");
}

function normalizeCountryCode(countryCode: string) {
  const normalized = normalizeAirhubCountryCode(countryCode);
  if (!normalized) {
    throw new Error("Invalid country code");
  }
  return normalized;
}

function logInvalidAirhubPlanResponse(body: unknown, response: unknown) {
  const requestBody = isRecord(body) ? body : {};

  console.error("[airhub.plan.fetch.failed]", {
    endpoint: AIRHUB_ENDPOINTS.planInformation,
    partnerCodePresent: requestBody.partnerCode != null,
    flag: typeof requestBody.flag === "number" ? requestBody.flag : null,
    countryCode:
      typeof requestBody.countryCode === "string" ? requestBody.countryCode : null,
    httpStatus: 200,
    providerSnippet: safeProviderSnippet(response),
    requestId: null,
  });
}

function safeProviderSnippet(response: unknown) {
  if (!isRecord(response)) {
    return null;
  }

  const message =
    readRecordString(response, "message") ??
    readRecordString(response, "error") ??
    readRecordString(response, "title");
  const jsonSnippet = JSON.stringify(response);

  return sanitizeProviderSnippet(message ? `${message} ${jsonSnippet}` : jsonSnippet);
}

function sanitizeProviderSnippet(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/"token"\s*:\s*"[^"]+"/gi, '"token":"[redacted]"')
    .replace(/"password"\s*:\s*"[^"]+"/gi, '"password":"[redacted]"')
    .replace(/"userName"\s*:\s*"[^"]+"/gi, '"userName":"[redacted]"')
    .slice(0, 500);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readRecordString(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "string" ? value : null;
}

async function readPlanCache(
  requestHash: string,
): Promise<AirhubPublicPlan[] | null> {
  if (!hasSupabaseAdminEnv()) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("airhub_plan_cache")
    .select("plans")
    .eq("request_hash", requestHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = data as PlanCacheRow | null;
  return row ? parseCachedPublicPlans(row.plans) : null;
}

async function writePlanCache(input: {
  requestHash: string;
  countryCode: string;
  flag: number;
  plans: AirhubPublicPlan[];
  ttlSeconds: number;
}) {
  if (!hasSupabaseAdminEnv()) {
    return;
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.ttlSeconds * 1000);
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("airhub_plan_cache").upsert(
    {
      request_hash: input.requestHash,
      country_code: input.countryCode,
      flag: input.flag,
      plans: input.plans,
      fetched_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    },
    { onConflict: "request_hash" },
  );

  if (error) {
    throw error;
  }
}

function parseCachedPublicPlans(value: unknown): AirhubPublicPlan[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const record = item as Record<string, unknown>;
    const planCode = readString(record.planCode);
    if (!planCode) {
      return [];
    }

    return [
      {
        planCode,
        planName: readString(record.planName),
        planType: readString(record.planType),
        countryName: readString(record.countryName),
        countryCode: readString(record.countryCode),
        currency: readString(record.currency),
        price: readNumber(record.price),
        dataUnit: readString(record.dataUnit),
        validity: readString(record.validity),
        validityType: readString(record.validityType),
        capacity: readString(record.capacity),
        connectivity: readString(record.connectivity),
        networkOperator: readString(record.networkOperator),
        countriesCovered: readString(record.countriesCovered),
        travelDateRequirement: readString(record.travelDateRequirement),
        additionalInfo: readString(record.additionalInfo),
        subscription: readBoolean(record.subscription),
        subscriptionPeriod: readString(record.subscriptionPeriod),
        phoneNumber: readBoolean(record.phoneNumber),
      },
    ];
  });
}

function readString(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return null;
}
