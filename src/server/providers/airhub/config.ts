import "server-only";

import { AirhubError } from "./errors";

export type AirhubConfig = {
  enabled: boolean;
  purchaseEnabled: boolean;
  baseUrl: string;
  username: string | null;
  password: string | null;
  partnerCode: number;
  testPlanCode: string;
  planCacheTtlSeconds: number;
  tokenTtlSeconds: number;
  testPurchaseOnly: boolean;
  allowNonTestPlanPurchase: boolean;
};

export function getAirhubConfig(): AirhubConfig {
  return {
    enabled: readBooleanEnv("AIRHUB_ENABLED", false),
    purchaseEnabled: readBooleanEnv("AIRHUB_PURCHASE_ENABLED", false),
    baseUrl: (process.env.AIRHUB_BASE_URL ?? "https://api.airhubapp.com").replace(/\/$/, ""),
    username: readOptionalEnv("AIRHUB_USERNAME"),
    password: readOptionalEnv("AIRHUB_PASSWORD"),
    partnerCode: readIntegerEnv("AIRHUB_PARTNER_CODE", 89508211),
    testPlanCode: process.env.AIRHUB_TEST_PLAN_CODE?.trim() || "22237541",
    planCacheTtlSeconds: readIntegerEnv("AIRHUB_PLAN_CACHE_TTL_SECONDS", 1800),
    tokenTtlSeconds: readIntegerEnv("AIRHUB_TOKEN_TTL_SECONDS", 900),
    testPurchaseOnly: readBooleanEnv("AIRHUB_TEST_PURCHASE_ONLY", true),
    allowNonTestPlanPurchase: readBooleanEnv(
      "AIRHUB_ALLOW_NON_TEST_PLAN_PURCHASE",
      false,
    ),
  };
}

export function assertAirhubEnabled(config = getAirhubConfig()) {
  if (!config.enabled) {
    throw new AirhubError(
      "airhub_disabled",
      "Airhub eSIM service is disabled.",
      503,
    );
  }
}

export function assertAirhubCredentials(config = getAirhubConfig()) {
  if (!config.username || !config.password) {
    throw new AirhubError(
      "airhub_auth_failed",
      "Airhub credentials are not configured.",
      503,
    );
  }
}

function readOptionalEnv(key: string): string | null {
  const value = process.env[key]?.trim();
  return value || null;
}

function readIntegerEnv(key: string, fallback: number): number {
  const value = Number(process.env[key]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function readBooleanEnv(key: string, fallback: boolean): boolean {
  const value = process.env[key]?.trim().toLowerCase();
  if (!value) return fallback;
  return value === "1" || value === "true" || value === "yes";
}
