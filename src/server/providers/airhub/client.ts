import "server-only";

import {
  AIRHUB_ENDPOINTS,
  buildBearerHeaders,
  buildLoginRequest,
  normalizeBaseUrl,
  parseLoginToken,
} from "./contracts";
import {
  assertAirhubCredentials,
  assertAirhubEnabled,
  getAirhubConfig,
  type AirhubConfig,
} from "./config";
import { AirhubError } from "./errors";

type TokenCache = {
  token: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

export async function getAirhubToken(
  config: AirhubConfig = getAirhubConfig(),
): Promise<string> {
  assertAirhubEnabled(config);
  assertAirhubCredentials(config);

  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 5000) {
    return tokenCache.token;
  }

  const response = await fetch(
    new URL(AIRHUB_ENDPOINTS.login, normalizeBaseUrl(config.baseUrl)),
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        buildLoginRequest({
          userName: config.username!,
          password: config.password!,
        }),
      ),
      cache: "no-store",
    },
  ).catch((error: unknown) => {
    throw new AirhubError(
      "airhub_auth_failed",
      error instanceof Error ? error.message : "Airhub auth failed.",
      502,
    );
  });

  const payload = await response.json().catch(() => null);
  const token = parseLoginToken(payload);

  if (!response.ok || !token) {
    throw new AirhubError("airhub_auth_failed", "Airhub auth failed.", 502);
  }

  tokenCache = {
    token,
    expiresAt: now + config.tokenTtlSeconds * 1000,
  };

  return token;
}

export async function airhubJsonRequest<T>(
  endpoint: string,
  {
    method = "POST",
    body,
    errorCode = "airhub_plan_fetch_failed",
  }: {
    method?: "GET" | "POST";
    body?: unknown;
    errorCode?:
      | "airhub_plan_fetch_failed"
      | "airhub_country_fetch_failed"
      | "airhub_wallet_failed"
      | "airhub_purchase_failed";
  } = {},
): Promise<T> {
  const config = getAirhubConfig();
  const token = await getAirhubToken(config);
  const response = await fetch(new URL(endpoint, normalizeBaseUrl(config.baseUrl)), {
    method,
    headers: buildBearerHeaders(token),
    body: body == null ? undefined : JSON.stringify(body),
    cache: "no-store",
  }).catch((error: unknown) => {
    logAirhubPlanFailure({
      endpoint,
      body,
      httpStatus: null,
      providerSnippet:
        error instanceof Error ? sanitizeProviderSnippet(error.message) : null,
      requestId: null,
      enabled: errorCode === "airhub_plan_fetch_failed",
    });

    throw new AirhubError(
      errorCode,
      error instanceof Error ? error.message : "Airhub request failed.",
      502,
    );
  });

  const rawText = await response.text().catch(() => "");
  const payload = parseJsonPayload(rawText);
  if (!response.ok) {
    logAirhubPlanFailure({
      endpoint,
      body,
      httpStatus: response.status,
      providerSnippet: safeProviderSnippet(payload, rawText),
      requestId: readAirhubRequestId(response),
      enabled: errorCode === "airhub_plan_fetch_failed",
    });

    throw new AirhubError(errorCode, "Airhub request failed.", response.status || 502);
  }

  return payload as T;
}

export function clearAirhubTokenCacheForTests() {
  tokenCache = null;
}

function parseJsonPayload(rawText: string): unknown {
  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

function logAirhubPlanFailure(input: {
  endpoint: string;
  body: unknown;
  httpStatus: number | null;
  providerSnippet: string | null;
  requestId: string | null;
  enabled: boolean;
}) {
  if (!input.enabled) {
    return;
  }

  const requestBody = isRecord(input.body) ? input.body : {};

  console.error("[airhub.plan.fetch.failed]", {
    endpoint: input.endpoint,
    partnerCodePresent: requestBody.partnerCode != null,
    flag: typeof requestBody.flag === "number" ? requestBody.flag : null,
    countryCode:
      typeof requestBody.countryCode === "string" ? requestBody.countryCode : null,
    httpStatus: input.httpStatus,
    providerSnippet: input.providerSnippet,
    requestId: input.requestId,
  });
}

function safeProviderSnippet(payload: unknown, rawText: string) {
  if (isRecord(payload)) {
    const jsonSnippet = JSON.stringify(payload);
    const message = readString(payload, "message") ?? readString(payload, "error") ?? readString(payload, "title");

    return sanitizeProviderSnippet(message ? `${message} ${jsonSnippet}` : jsonSnippet);
  }

  return sanitizeProviderSnippet(rawText);
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

function readAirhubRequestId(response: Response) {
  return (
    response.headers.get("x-request-id") ??
    response.headers.get("request-id") ??
    response.headers.get("x-correlation-id") ??
    response.headers.get("cf-ray") ??
    null
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "string" ? value : null;
}
