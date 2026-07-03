import type { AirhubPublicCountry } from "@/server/providers/airhub/contracts";

export const HERO_ESIM_SUGGESTION_LIMIT = 6;

export function filterHeroEsimCountries(
  countries: AirhubPublicCountry[],
  query: string,
  limit = HERO_ESIM_SUGGESTION_LIMIT,
) {
  const normalizedQuery = normalizeSearch(query);
  const matches = normalizedQuery
    ? countries.filter((country) =>
        [country.name, country.isoCode, country.regionName]
          .filter(Boolean)
          .some((value) => normalizeSearch(value).includes(normalizedQuery)),
      )
    : countries;

  return matches.slice(0, Math.max(0, limit));
}

export function buildHeroEsimCountryHref(countryCode: string) {
  return `/esim/${countryCode.trim().toUpperCase()}`;
}

export function readHeroEsimCountriesResponse(
  payload: unknown,
): AirhubPublicCountry[] {
  const countries = readCountriesArray(payload);

  if (!countries) {
    return [];
  }

  return countries.filter(isAirhubPublicCountry);
}

function normalizeSearch(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function isAirhubPublicCountry(value: unknown): value is AirhubPublicCountry {
  return (
    isRecord(value) &&
    typeof value.isoCode === "string" &&
    typeof value.name === "string" &&
    (value.regionName === null || typeof value.regionName === "string") &&
    (value.flagUrl === null || typeof value.flagUrl === "string") &&
    (value.globalFlagUrl === null || typeof value.globalFlagUrl === "string")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readCountriesArray(payload: unknown): unknown[] | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (Array.isArray(payload.countries)) {
    return payload.countries;
  }

  if (isRecord(payload.data) && Array.isArray(payload.data.countries)) {
    return payload.data.countries;
  }

  return null;
}
