import "server-only";

import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/server/supabase/client";
import {
  getEsimCountryIdentity,
  isUkEsimCountryIdentity,
  preferUkControlSource,
} from "@/lib/esim-country-identity";

import { airhubJsonRequest } from "./client";
import {
  AIRHUB_ENDPOINTS,
  type AirhubCountrySyncPayload,
  type AirhubCountryRegionItem,
  type AirhubPublicCountry,
  buildAirhubPlanRequestCountryCode,
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
  is_visible: boolean;
  is_featured: boolean;
  sort_order: number;
};

type PlanLookupCountryRow = {
  airhub_code: string | null;
  name: string | null;
  raw: unknown;
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
  const columns =
    "iso_code,name,region_name,flag_url,global_flag_url,display_name_override,is_visible,is_featured,sort_order";
  let query = supabase
    .from("airhub_countries")
    .select(columns);

  query =
    isUkEsimCountryIdentity({ isoCode: normalizedCountryCode })
      ? query.in("iso_code", ["UK", "GB"])
      : query.eq("iso_code", normalizedCountryCode);

  const { data, error } = await query.limit(2);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as CountryRow[];
  const row = selectCountryRowForPublicCode(rows, normalizedCountryCode);
  if (!row || !row.is_visible) return null;

  return toPublicCountry(row);
}

export async function resolveAirhubPlanLookupCountryCode(
  countryCode: string,
): Promise<string> {
  const normalizedCountryCode = normalizeAirhubCountryCode(countryCode);

  if (!normalizedCountryCode) {
    throw new Error("Invalid country code");
  }

  const confirmed = buildAirhubPlanRequestCountryCode({
    countryCode: normalizedCountryCode,
  });
  if (confirmed !== normalizedCountryCode) {
    return confirmed;
  }

  if (!hasSupabaseAdminEnv()) {
    return confirmed;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("airhub_countries")
    .select("airhub_code,name,raw")
    .eq("iso_code", normalizedCountryCode)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = data as PlanLookupCountryRow | null;
  return buildAirhubPlanRequestCountryCode({
    countryCode: normalizedCountryCode,
    airhubCode: row?.airhub_code ?? readRawCountryCode(row?.raw),
    countryName: row?.name ?? null,
  });
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
    .select(
      "iso_code,name,region_name,flag_url,global_flag_url,display_name_override,is_visible,is_featured,sort_order",
    )
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .limit(400);

  if (error) {
    throw error;
  }

  const countries = buildPublicCountries((data ?? []) as CountryRow[]);

  countryCache = {
    expiresAt: now + COUNTRY_CACHE_TTL_MS,
    countries,
  };

  return countries;
}

function toPublicCountry(row: CountryRow): AirhubPublicCountry {
  const identity = getEsimCountryIdentity({
    isoCode: row.iso_code,
    providerName: row.name,
    displayNameOverride: row.display_name_override,
  });

  return {
    isoCode: identity.isoCode,
    name: identity.displayName,
    regionName: row.region_name,
    flagUrl: row.flag_url,
    globalFlagUrl: row.global_flag_url,
    aliases: identity.aliases.length ? identity.aliases : undefined,
  };
}

function buildPublicCountries(rows: CountryRow[]): AirhubPublicCountry[] {
  const decorated: Array<{ country: AirhubPublicCountry; source: CountryRow }> = [];
  let ukSource: CountryRow | null = null;

  for (const row of rows) {
    if (isUkEsimCountryIdentity({ isoCode: row.iso_code, name: row.name })) {
      if (
        preferUkControlSource({
          candidateIsoCode: row.iso_code,
          currentIsoCode: ukSource?.iso_code ?? null,
        })
      ) {
        ukSource = row;
      }
      continue;
    }

    if (row.is_visible) {
      decorated.push({ country: toPublicCountry(row), source: row });
    }
  }

  if (ukSource?.is_visible) {
    decorated.push({ country: toPublicCountry(ukSource), source: ukSource });
  }

  decorated.sort(comparePublicCountryEntries);
  return decorated.map((entry) => entry.country);
}

function selectCountryRowForPublicCode(
  rows: CountryRow[],
  normalizedCountryCode: string,
): CountryRow | null {
  if (isUkEsimCountryIdentity({ isoCode: normalizedCountryCode })) {
    let selected: CountryRow | null = null;
    for (const row of rows) {
      if (!isUkEsimCountryIdentity({ isoCode: row.iso_code, name: row.name })) continue;
      if (
        preferUkControlSource({
          candidateIsoCode: row.iso_code,
          currentIsoCode: selected?.iso_code ?? null,
        })
      ) {
        selected = row;
      }
    }
    return selected;
  }

  return rows.find((item) => item.iso_code === normalizedCountryCode) ?? null;
}

function comparePublicCountryEntries(
  a: { country: AirhubPublicCountry; source: CountryRow },
  b: { country: AirhubPublicCountry; source: CountryRow },
) {
  if (a.source.is_featured !== b.source.is_featured) {
    return Number(b.source.is_featured) - Number(a.source.is_featured);
  }
  if (a.source.sort_order !== b.source.sort_order) {
    return a.source.sort_order - b.source.sort_order;
  }
  return a.country.name.localeCompare(b.country.name);
}

function readRawCountryCode(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const value = (raw as Record<string, unknown>).code;
  if (value == null || value === "") return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}
