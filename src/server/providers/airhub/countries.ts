import "server-only";

import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/server/supabase/client";

import { airhubJsonRequest } from "./client";
import {
  AIRHUB_ENDPOINTS,
  type AirhubCountryRegionItem,
  type AirhubPublicCountry,
  parseCountryRegionResponse,
} from "./contracts";

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

export async function fetchAirhubCountryRegionDetail(
  flag: 1 | 2,
): Promise<AirhubCountryRegionItem[]> {
  const endpoint = `${AIRHUB_ENDPOINTS.countryRegionDetail}?flag=${flag}`;
  const response = await airhubJsonRequest<unknown>(endpoint, {
    method: "GET",
    errorCode: "airhub_country_fetch_failed",
  });

  return parseCountryRegionResponse(response);
}

export async function syncAirhubCountriesFromProvider(): Promise<{
  upserted: number;
}> {
  const countries = await fetchAirhubCountryRegionDetail(2);

  if (!hasSupabaseAdminEnv()) {
    throw new Error("Supabase admin environment is not configured");
  }

  const supabase = getSupabaseAdminClient();
  const rows = countries.map((country) => ({
    iso_code: country.code.toUpperCase(),
    name: country.name,
    airhub_code: country.code,
    flag_url: country.flag ?? null,
    raw: country.raw,
    synced_at: new Date().toISOString(),
  }));

  if (rows.length === 0) {
    return { upserted: 0 };
  }

  const { error } = await supabase
    .from("airhub_countries")
    .upsert(rows, { onConflict: "iso_code" });

  if (error) {
    throw error;
  }

  countryCache = null;
  return { upserted: rows.length };
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

  const countries = ((data ?? []) as CountryRow[]).map((row) => ({
    isoCode: row.iso_code,
    name: row.name,
    regionName: row.region_name,
    flagUrl: row.flag_url,
    globalFlagUrl: row.global_flag_url,
  }));

  countryCache = {
    expiresAt: now + COUNTRY_CACHE_TTL_MS,
    countries,
  };

  return countries;
}

function normalizeSearch(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}
