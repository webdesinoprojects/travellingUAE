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
import { AirhubError } from "./errors";

const COUNTRY_CACHE_TTL_MS = 5 * 60 * 1000;

type CountryRow = {
  iso_code: string;
  name: string;
  region_name: string | null;
  flag_url: string | null;
  global_flag_url: string | null;
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
  const normalizedQuery = normalizeSearch(query);

  const filtered = normalizedQuery
    ? countries.filter((country) =>
        [country.name, country.isoCode, country.regionName]
          .filter(Boolean)
          .some((value) => normalizeSearch(value).includes(normalizedQuery)),
      )
    : countries;

  return filtered.slice(0, Math.min(Math.max(limit, 1), 250));
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
    .select("iso_code,name,region_name,flag_url,global_flag_url")
    .eq("iso_code", normalizedCountryCode)
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
    .select("iso_code,name,region_name,flag_url,global_flag_url")
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

function normalizeSearch(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function toPublicCountry(row: CountryRow): AirhubPublicCountry {
  return {
    isoCode: row.iso_code,
    name: row.name,
    regionName: row.region_name,
    flagUrl: row.flag_url,
    globalFlagUrl: row.global_flag_url,
  };
}
