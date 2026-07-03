import "server-only";

import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/server/supabase/client";

import { airhubJsonRequest } from "./client";
import {
  AIRHUB_ENDPOINTS,
  type AirhubCountrySyncPayload,
  type AirhubCountryRegionItem,
  type AirhubPublicCountry,
  buildAirhubCountrySyncPayload,
  normalizeAirhubCountryCode,
  parseCountryRegionResponse,
} from "./contracts";
import { rankPublicCountries } from "@/server/admin/esim-visibility-helpers";

import { AirhubError } from "./errors";

const COUNTRY_CACHE_TTL_MS = 5 * 60 * 1000;

type CountryRow = {
  iso_code: string;
  name: string;
  region_name: string | null;
  flag_url: string | null;
  global_flag_url: string | null;
  display_name_override: string | null;
};

let countryCache:
  | {
      expiresAt: number;
      countries: AirhubPublicCountry[];
    }
  | null = null;

export async function getLocalAirhubCountries({
  query,
  limit = 80,
}: {
  query?: string | null;
  limit?: number;
} = {}): Promise<AirhubPublicCountry[]> {
  const countries = await readAllLocalCountries();
  // Relevance ranking: exact ISO > exact name > startsWith > includes > region.
  const ranked = rankPublicCountries(countries, query ?? "");

  return ranked.slice(0, Math.min(Math.max(limit, 1), 250));
}

export async function getLocalAirhubCountryByCode(
  countryCode: string,
): Promise<AirhubPublicCountry | null> {
  const normalizedCountryCode = normalizeAirhubCountryCode(countryCode);

  if (!normalizedCountryCode || !hasSupabaseAdminEnv()) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("airhub_countries")
    .select("iso_code,name,region_name,flag_url,global_flag_url,display_name_override")
    .eq("iso_code", normalizedCountryCode)
    // Hidden countries are treated as not found for the public flow.
    .eq("is_visible", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = data as CountryRow | null;
  return row ? toPublicCountry(row) : null;
}

export async function fetchAirhubCountryRegionDetail(
  flag: 1 | 2,
): Promise<AirhubCountryRegionItem[]> {
  const response = await fetchAirhubCountryRegionDetailResponse(flag);

  return parseCountryRegionResponse(response);
}

export async function syncAirhubCountriesFromProvider(): Promise<
  Omit<AirhubCountrySyncPayload, "rows"> & { upserted: number }
> {
  const response = await fetchAirhubCountryRegionDetailResponse(2);
  const payload = buildAirhubCountrySyncPayload(
    response,
    new Date().toISOString(),
  );

  if (payload.rows.length === 0) {
    throw new AirhubError(
      "airhub_country_fetch_failed",
      "Airhub country sync returned no valid countries.",
      502,
    );
  }

  if (!hasSupabaseAdminEnv()) {
    throw new Error("Supabase admin environment is not configured");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("airhub_countries")
    .upsert(payload.rows, { onConflict: "iso_code" });

  if (error) {
    throw error;
  }

  countryCache = null;
  return {
    received: payload.received,
    valid: payload.valid,
    duplicatesDropped: payload.duplicatesDropped,
    upserted: payload.rows.length,
  };
}

async function fetchAirhubCountryRegionDetailResponse(flag: 1 | 2) {
  const endpoint = `${AIRHUB_ENDPOINTS.countryRegionDetail}?flag=${flag}`;

  return airhubJsonRequest<unknown>(endpoint, {
    method: "GET",
    errorCode: "airhub_country_fetch_failed",
  });
}

export function clearAirhubCountryCacheForTests() {
  countryCache = null;
}

/**
 * Invalidate the in-process public country cache so admin visibility/feature/
 * override changes surface on the public flow without waiting for the TTL. Best
 * effort across instances: on multi-instance/serverless deployments each instance
 * clears its own copy and the TTL bounds any residual staleness.
 */
export function clearAirhubCountryCache() {
  countryCache = null;
}

async function readAllLocalCountries(): Promise<AirhubPublicCountry[]> {
  if (!hasSupabaseAdminEnv()) {
    return [];
  }

  const now = Date.now();
  if (countryCache && countryCache.expiresAt > now) {
    return countryCache.countries;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("airhub_countries")
    .select("iso_code,name,region_name,flag_url,global_flag_url,display_name_override")
    // Only admin-visible countries; featured first, then admin sort order, then name.
    .eq("is_visible", true)
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .limit(400);

  if (error) {
    throw error;
  }

  const countries = ((data ?? []) as CountryRow[]).map(toPublicCountry);

  countryCache = {
    expiresAt: now + COUNTRY_CACHE_TTL_MS,
    countries,
  };

  return countries;
}

function toPublicCountry(row: CountryRow): AirhubPublicCountry {
  const override =
    typeof row.display_name_override === "string" ? row.display_name_override.trim() : "";
  return {
    isoCode: row.iso_code,
    // Public pages show the admin display-name override when set.
    name: override || row.name,
    regionName: row.region_name,
    flagUrl: row.flag_url,
    globalFlagUrl: row.global_flag_url,
  };
}
