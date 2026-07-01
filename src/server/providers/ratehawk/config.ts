import "server-only";

/**
 * RateHawk / Emerging Travel Group (ETG) provider configuration.
 *
 * Server-only. Credentials are never returned from this module, never logged,
 * and must never be exposed through NEXT_PUBLIC_* variables. Only redacted
 * readiness metadata (presence flags, host, env name) leaves this file.
 *
 * Verified hosts (ETG API v3):
 * - sandbox: https://api-sandbox.worldota.net
 * - test/prod: https://api.worldota.net
 * Auth: HTTP Basic, username = KEY_ID, password = API_KEY.
 */

export type RateHawkEnv = "sandbox" | "test" | "prod";

export type RateHawkConfig = {
  env: RateHawkEnv;
  /** Host origin only, e.g. https://api.worldota.net. No path, no secrets. */
  baseUrl: string;
  keyId: string;
  apiKey: string;
};

export type RateHawkReadiness = {
  configured: boolean;
  env: RateHawkEnv;
  /** Host origin only. Safe to surface; contains no secret. */
  baseUrl: string | null;
  hasKeyId: boolean;
  hasApiKey: boolean;
  contractNumberPresent: boolean;
  /** Names of missing required env vars. Never their values. */
  missing: string[];
};

const DEFAULT_HOSTS: Record<RateHawkEnv, string> = {
  sandbox: "https://api-sandbox.worldota.net",
  test: "https://api.worldota.net",
  prod: "https://api.worldota.net",
};

const ENV_KEYS: Record<
  RateHawkEnv,
  { baseUrl: string; keyId: string; apiKey: string }
> = {
  sandbox: {
    baseUrl: "RATEHAWK_SANDBOX_BASE_URL",
    keyId: "RATEHAWK_SANDBOX_KEY_ID",
    apiKey: "RATEHAWK_SANDBOX_API_KEY",
  },
  test: {
    baseUrl: "RATEHAWK_TEST_BASE_URL",
    keyId: "RATEHAWK_TEST_KEY_ID",
    apiKey: "RATEHAWK_TEST_API_KEY",
  },
  prod: {
    baseUrl: "RATEHAWK_PROD_BASE_URL",
    keyId: "RATEHAWK_PROD_KEY_ID",
    apiKey: "RATEHAWK_PROD_API_KEY",
  },
};

export function resolveRateHawkEnv(): RateHawkEnv {
  const raw = (process.env.RATEHAWK_ENV ?? "test").trim().toLowerCase();

  if (raw === "sandbox" || raw === "test" || raw === "prod") {
    return raw;
  }

  return "test";
}

function normalizeHost(value: string | undefined, env: RateHawkEnv): string {
  const trimmed = value?.trim();

  if (!trimmed) {
    return DEFAULT_HOSTS[env];
  }

  // Keep origin only; strip any trailing slash or accidental path.
  try {
    const url = new URL(trimmed);
    return `${url.protocol}//${url.host}`;
  } catch {
    return DEFAULT_HOSTS[env];
  }
}

/**
 * Redacted readiness status for the active env. Safe to return from routes.
 */
export function getRateHawkReadiness(): RateHawkReadiness {
  const env = resolveRateHawkEnv();
  const keys = ENV_KEYS[env];
  const keyId = process.env[keys.keyId]?.trim();
  const apiKey = process.env[keys.apiKey]?.trim();
  const baseUrl = normalizeHost(process.env[keys.baseUrl], env);

  const missing: string[] = [];

  if (!keyId) {
    missing.push(keys.keyId);
  }

  if (!apiKey) {
    missing.push(keys.apiKey);
  }

  return {
    configured: Boolean(keyId && apiKey),
    env,
    baseUrl,
    hasKeyId: Boolean(keyId),
    hasApiKey: Boolean(apiKey),
    contractNumberPresent: Boolean(process.env.RATEHAWK_CONTRACT_NUMBER?.trim()),
    missing,
  };
}

export function isRateHawkConfigured(): boolean {
  return getRateHawkReadiness().configured;
}

/**
 * Payota is the ETG card-payment gateway used by the `now` payment type. It is a
 * separate host from the ETG API but authenticates with the SAME Basic
 * credentials (KEY_ID:API_KEY). Default is the documented production host; there
 * is no Payota sandbox (the `now` type is unavailable in ETG Sandbox), so `now`
 * is exercised against the ETG test key. Override only via env for staging.
 */
const PAYOTA_DEFAULT_HOST = "https://api.payota.net";

export function getPayotaBaseUrl(): string {
  const raw = process.env.RATEHAWK_PAYOTA_BASE_URL?.trim();
  if (!raw) {
    return PAYOTA_DEFAULT_HOST;
  }

  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}`;
  } catch {
    return PAYOTA_DEFAULT_HOST;
  }
}

/**
 * Resolve full credentials for the active env. Throws if not configured.
 * The returned object must stay server-side and must never be logged.
 */
export function getRateHawkConfig(): RateHawkConfig {
  const env = resolveRateHawkEnv();
  const keys = ENV_KEYS[env];
  const keyId = process.env[keys.keyId]?.trim();
  const apiKey = process.env[keys.apiKey]?.trim();

  if (!keyId || !apiKey) {
    throw new Error("RateHawk credentials are not configured");
  }

  return {
    env,
    baseUrl: normalizeHost(process.env[keys.baseUrl], env),
    keyId,
    apiKey,
  };
}
