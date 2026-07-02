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
    throw new AirhubError(
      errorCode,
      error instanceof Error ? error.message : "Airhub request failed.",
      502,
    );
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AirhubError(errorCode, "Airhub request failed.", 502);
  }

  return payload as T;
}

export function clearAirhubTokenCacheForTests() {
  tokenCache = null;
}
