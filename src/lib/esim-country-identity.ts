export const UK_ESIM_PUBLIC_CODE = "UK";
export const UK_ESIM_DISPLAY_NAME = "United Kingdom";
export const UK_ESIM_ALIASES = [
  "UK",
  "GB",
  "United Kingdom",
  "Great Britain",
  "Wales",
] as const;

export type EsimCountryIdentity = {
  isoCode: string;
  displayName: string;
  aliases: string[];
  isUkIdentity: boolean;
};

export type EsimCountrySearchRecord = {
  isoCode: string;
  name?: string;
  displayName?: string;
  providerName?: string;
  regionName?: string | null;
  aliases?: readonly string[] | null;
};

export function getEsimCountryIdentity(input: {
  isoCode: string;
  providerName: string;
  displayNameOverride?: string | null;
}): EsimCountryIdentity {
  const isUkIdentity = isUkEsimCountryIdentity({
    isoCode: input.isoCode,
    name: input.providerName,
  });
  const override = normalizeText(input.displayNameOverride);

  return {
    isoCode: isUkIdentity ? UK_ESIM_PUBLIC_CODE : normalizeCode(input.isoCode),
    displayName: override || (isUkIdentity ? UK_ESIM_DISPLAY_NAME : input.providerName),
    aliases: isUkIdentity ? [...UK_ESIM_ALIASES] : [],
    isUkIdentity,
  };
}

export function isUkEsimCountryIdentity(input: {
  isoCode?: string | null;
  airhubCode?: string | null;
  name?: string | null;
}) {
  const isoCode = normalizeCode(input.isoCode);
  const airhubCode = normalizeCode(input.airhubCode);
  const name = normalizeSearch(input.name);

  return (
    isoCode === "UK" ||
    isoCode === "GB" ||
    airhubCode === "UK" ||
    airhubCode === "GB" ||
    name === "wales" ||
    name === "united kingdom" ||
    name === "great britain"
  );
}

export function preferUkControlSource(input: {
  candidateIsoCode: string;
  currentIsoCode: string | null;
}) {
  const candidate = normalizeCode(input.candidateIsoCode);
  const current = input.currentIsoCode ? normalizeCode(input.currentIsoCode) : null;

  if (!current) return true;
  if (candidate === "GB" && current !== "GB") return true;
  if (current === "GB" && candidate !== "GB") return false;
  return false;
}

export function chooseCanonicalUkCountrySource<T extends { isoCode: string }>(
  sources: readonly T[],
): T | null {
  let selected: T | null = null;

  for (const source of sources) {
    if (
      preferUkControlSource({
        candidateIsoCode: source.isoCode,
        currentIsoCode: selected?.isoCode ?? null,
      })
    ) {
      selected = source;
    }
  }

  return selected;
}

export function rankEsimCountriesForSearch<T extends EsimCountrySearchRecord>(
  countries: T[],
  rawQuery: string,
): T[] {
  const query = normalizeSearch(rawQuery);
  if (!query) return countries;

  const scored: Array<{ country: T; index: number; score: number }> = [];
  countries.forEach((country, index) => {
    const score = scoreEsimCountrySearch(country, query);
    if (score != null) {
      scored.push({ country, index, score });
    }
  });

  scored.sort((a, b) => (a.score !== b.score ? a.score - b.score : a.index - b.index));
  return scored.map((entry) => entry.country);
}

export function getEsimCountrySearchValues(country: EsimCountrySearchRecord): string[] {
  return uniqueNonEmpty([
    country.isoCode,
    country.name,
    country.displayName,
    country.providerName,
    country.regionName,
    ...(country.aliases ?? []),
  ]);
}

function scoreEsimCountrySearch(
  country: EsimCountrySearchRecord,
  normalizedQuery: string,
): number | null {
  const isoCode = normalizeSearch(country.isoCode);
  const primaryName = normalizeSearch(country.name ?? country.displayName);
  const displayName = normalizeSearch(country.displayName);
  const providerName = normalizeSearch(country.providerName);
  const regionName = normalizeSearch(country.regionName);
  const aliases = (country.aliases ?? []).map(normalizeSearch).filter(Boolean);

  if (isoCode === normalizedQuery || aliases.some((alias) => alias === normalizedQuery)) {
    return 0;
  }
  if (primaryName === normalizedQuery || displayName === normalizedQuery) {
    return 1;
  }
  if (
    primaryName.startsWith(normalizedQuery) ||
    displayName.startsWith(normalizedQuery) ||
    aliases.some((alias) => alias.startsWith(normalizedQuery))
  ) {
    return 2;
  }
  if (isoCode.startsWith(normalizedQuery)) {
    return 3;
  }
  if (
    primaryName.includes(normalizedQuery) ||
    displayName.includes(normalizedQuery) ||
    aliases.some((alias) => alias.includes(normalizedQuery))
  ) {
    return 4;
  }
  if (regionName && regionName.includes(normalizedQuery)) {
    return 5;
  }
  if (providerName && providerName.includes(normalizedQuery)) {
    return 6;
  }

  return null;
}

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function normalizeCode(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

function normalizeSearch(value: string | null | undefined) {
  return normalizeText(value).toLowerCase();
}

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = normalizeText(value);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }

  return output;
}
