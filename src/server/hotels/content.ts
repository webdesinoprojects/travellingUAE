import "server-only";

import { logServerError } from "@/server/http/response";
import { getSupabaseAdminClient } from "@/server/supabase/client";
import type { HotelDestinationSuggestion } from "@/types/hotels";

const COUNTRY_CODE_BY_QUERY = new Map([
  ["india", "IN"],
  ["in", "IN"],
  ["uae", "AE"],
  ["u a e", "AE"],
  ["united arab emirates", "AE"],
  ["emirates", "AE"],
]);

export type LocalHotelContent = {
  hotelId: string;
  name: string;
  starRating: number | null;
  imageUrl: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
};

export async function getLocalHotelContent(
  providerId: string,
  hotelIds: string[],
  language = "en",
) {
  const uniqueIds = [...new Set(hotelIds.filter(Boolean))].slice(0, 300);
  if (uniqueIds.length === 0) return new Map<string, LocalHotelContent>();

  const result = await getSupabaseAdminClient()
    .from("provider_hotel_content")
    .select(
      "hotel_id,name,star_rating,primary_image_url,address,latitude,longitude",
    )
    .eq("provider_id", providerId)
    .eq("language", language)
    .in("hotel_id", uniqueIds);

  if (result.error) throw result.error;

  const content = new Map<string, LocalHotelContent>();
  for (const row of (result.data ?? []) as Array<Record<string, unknown>>) {
    const hotelId = typeof row.hotel_id === "string" ? row.hotel_id : "";
    const name = typeof row.name === "string" ? row.name : "";
    if (!hotelId || !name) continue;
    content.set(hotelId, {
      hotelId,
      name,
      starRating: finiteOrNull(row.star_rating),
      imageUrl: httpsUrlOrNull(row.primary_image_url),
      address: textOrNull(row.address),
      latitude: finiteOrNull(row.latitude),
      longitude: finiteOrNull(row.longitude),
    });
  }
  return content;
}

export async function getLocalHotelDestinationSuggestions(
  providerId: string,
  query: string,
  language = "en",
): Promise<HotelDestinationSuggestion[]> {
  const normalizedTerm = normalizeAutocompleteLabel(query).slice(0, 80);
  const normalizedLanguage = /^[a-z]{2}$/.test(language) ? language : "en";
  if (normalizedTerm.length < 3) return [];

  const countryCode = COUNTRY_CODE_BY_QUERY.get(normalizedTerm);
  if (countryCode) {
    const countryRows = await getCountryCodeSuggestions(
      providerId,
      normalizedLanguage,
      countryCode,
    );
    return mapAutocompleteSuggestions(countryRows, normalizedTerm).slice(0, 10);
  }

  const directRows = await getRankedAutocompleteCandidates(
    providerId,
    normalizedLanguage,
    normalizedTerm,
  );
  if (directRows.length === 0) return [];

  const countryCodes = [
    ...new Set(
      directRows
        .filter((row) => row.suggestion_type === "country")
        .map((row) => textOrNull(row.country_code))
        .filter((row): row is string => row !== null),
    ),
  ];
  const groupedRows =
    countryCodes.length > 0
      ? await getCountryGroupedSuggestions(providerId, normalizedLanguage, countryCodes)
      : [];

  return mapAutocompleteSuggestions([...directRows, ...groupedRows], normalizedTerm).slice(0, 10);
}

async function getCountryCodeSuggestions(
  providerId: string,
  language: string,
  countryCode: string,
) {
  const regions = await queryAutocompleteRows({
    providerId,
    language,
    bucket: "country_code_region",
    optional: true,
    applyFilter: (query) =>
      query
        .eq("suggestion_type", "region")
        .eq("country_code", countryCode)
        .not("region_id", "is", null)
        .order("hotel_count", { ascending: false })
        .limit(30),
  });

  const regionSuggestions = mapAutocompleteSuggestions(regions, countryCode.toLowerCase());
  if (regionSuggestions.length >= 10) return regions;

  const hotels = await queryAutocompleteRows({
    providerId,
    language,
    bucket: "country_code_hotel",
    optional: true,
    applyFilter: (query) =>
      query
        .eq("suggestion_type", "hotel")
        .eq("country_code", countryCode)
        .not("region_id", "is", null)
        .order("normalized_label", { ascending: true })
        .limit(20),
  });

  return [...regions, ...hotels];
}

async function getRankedAutocompleteCandidates(
  providerId: string,
  language: string,
  normalizedTerm: string,
) {
  const escaped = escapeLikePattern(normalizedTerm);
  const wordPrefixPattern = `% ${escaped}%`;
  const byKey = new Map<string, AutocompleteIndexRow>();

  const [placePrefixRows, hotelPrefixRows] = await Promise.all([
    queryAutocompleteRows({
      providerId,
      language,
      bucket: "prefix_place",
      optional: true,
      applyFilter: (query) =>
        query
          .in("suggestion_type", ["country", "region"])
          .like("normalized_label", `${escaped}%`)
          .limit(60),
    }),
    queryAutocompleteRows({
      providerId,
      language,
      bucket: "prefix_hotel",
      optional: true,
      applyFilter: (query) =>
        query
          .eq("suggestion_type", "hotel")
          .like("normalized_label", `${escaped}%`)
          .limit(80),
    }),
  ]);

  await addRows(byKey, placePrefixRows);
  await addRows(byKey, hotelPrefixRows);

  if (rankedRowCount(byKey) < 10) {
    await addRows(
      byKey,
      await queryTypes(
        providerId,
        language,
        ["country", "region"],
        "place_word_prefix",
        (query) => query.like("normalized_label", wordPrefixPattern).limit(30),
        true,
      ),
    );
  }

  if (rankedRowCount(byKey) < 10) {
    await addRows(
      byKey,
      await queryTypes(
        providerId,
        language,
        ["hotel"],
        "hotel_word_prefix",
        (query) => query.like("normalized_label", wordPrefixPattern).limit(60),
        true,
      ),
    );
  }

  if (normalizedTerm.length >= 4 && rankedRowCount(byKey) < 8) {
    const substringPattern = `%${escaped.replace(/\s+/g, "%")}%`;
    await addRows(
      byKey,
      await queryTypes(
        providerId,
        language,
        ["hotel"],
        "hotel_substring",
        (query) => query.like("normalized_label", substringPattern).limit(40),
        true,
      ),
    );
  }

  return [...byKey.values()];
}

async function queryTypes(
  providerId: string,
  language: string,
  types: readonly string[],
  bucket: string,
  applyFilter: (
    query: ReturnType<typeof baseAutocompleteQuery>,
  ) => ReturnType<typeof baseAutocompleteQuery>,
  optional = false,
) {
  const results: AutocompleteIndexRow[] = [];
  for (const type of types) {
    results.push(
      ...(await queryAutocompleteRows({
        providerId,
        language,
        bucket: `${bucket}_${type}`,
        optional,
        applyFilter: (query) => applyFilter(query.eq("suggestion_type", type)),
      })),
    );
  }

  return results;
}

async function queryAutocompleteRows({
  providerId,
  language,
  bucket,
  optional,
  applyFilter,
}: {
  providerId: string;
  language: string;
  bucket: string;
  optional: boolean;
  applyFilter: (
    query: ReturnType<typeof baseAutocompleteQuery>,
  ) => ReturnType<typeof baseAutocompleteQuery>;
}) {
  const result = await applyFilter(baseAutocompleteQuery(providerId, language));

  if (result.error) {
    logServerError(`hotels.autocomplete.${bucket}`, result.error);
    if (optional) return [];
    throw result.error;
  }
  return normalizeAutocompleteRows(result.data);
}

function baseAutocompleteQuery(providerId: string, language: string) {
  return getSupabaseAdminClient()
    .from("provider_hotel_autocomplete_index")
    .select("suggestion_type,label,normalized_label,country_code,region_id,hotel_id,hid,hotel_count,metadata")
    .eq("provider_id", providerId)
    .eq("language", language);
}

async function getCountryGroupedSuggestions(
  providerId: string,
  language: string,
  countryCodes: string[],
) {
  const result = await getSupabaseAdminClient()
    .from("provider_hotel_autocomplete_index")
    .select("suggestion_type,label,normalized_label,country_code,region_id,hotel_id,hid,hotel_count,metadata")
    .eq("provider_id", providerId)
    .eq("language", language)
    .in("country_code", countryCodes)
    .in("suggestion_type", ["region", "hotel"])
    .not("region_id", "is", null)
    .order("hotel_count", { ascending: false })
    .limit(50);

  if (result.error) throw result.error;
  return normalizeAutocompleteRows(result.data);
}

function addRows(
  map: Map<string, AutocompleteIndexRow>,
  rows: AutocompleteIndexRow[],
) {
  for (const row of rows) {
    const key = autocompleteRowKey(row);
    if (key && !map.has(key)) map.set(key, row);
  }
}

function rankedRowCount(rows: Map<string, AutocompleteIndexRow>) {
  let count = 0;
  for (const row of rows.values()) {
    if (positiveInteger(row.region_id) && textOrNull(row.label)) count += 1;
  }
  return count;
}

type AutocompleteIndexRow = {
  suggestion_type: string | null;
  label: string | null;
  normalized_label: string | null;
  country_code: string | null;
  region_id: number | string | null;
  hotel_id: string | null;
  hid: number | string | null;
  hotel_count: number | string | null;
  metadata: Record<string, unknown> | null;
};

function normalizeAutocompleteRows(value: unknown): AutocompleteIndexRow[] {
  return Array.isArray(value) ? (value as AutocompleteIndexRow[]) : [];
}

function mapAutocompleteSuggestions(
  rows: AutocompleteIndexRow[],
  normalizedTerm: string,
): HotelDestinationSuggestion[] {
  const seen = new Set<string>();
  const suggestions: HotelDestinationSuggestion[] = [];

  const sorted = [...rows].sort((left, right) => {
    const leftPriority = matchPriority(left, normalizedTerm);
    const rightPriority = matchPriority(right, normalizedTerm);
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    const leftTypePriority = suggestionTypePriority(left.suggestion_type);
    const rightTypePriority = suggestionTypePriority(right.suggestion_type);
    if (leftTypePriority !== rightTypePriority) return leftTypePriority - rightTypePriority;
    return numericOrZero(right.hotel_count) - numericOrZero(left.hotel_count);
  });

  for (const row of sorted) {
    const regionId = positiveInteger(row.region_id);
    const label = textOrNull(row.label);
    if (!regionId || !label) continue;

    const type = textOrNull(row.suggestion_type) ?? "region";
    const hotelId = textOrNull(row.hotel_id);
    const hid = positiveInteger(row.hid);
    const key =
      type === "hotel"
        ? `hotel:${hotelId ?? hid ?? `${regionId}:${label}`}`
        : `${type}:${regionId}`;

    if (seen.has(key)) continue;
    seen.add(key);

    suggestions.push({
      regionId,
      name: label,
      countryCode: textOrNull(row.country_code),
      type,
      hotelId,
      hid,
    });
  }
  return suggestions;
}

function matchPriority(row: AutocompleteIndexRow, normalizedTerm: string) {
  const label = textOrNull(row.normalized_label) ?? normalizeAutocompleteLabel(textOrNull(row.label) ?? "");
  const type = textOrNull(row.suggestion_type);
  const starts = label.startsWith(normalizedTerm);
  const wordStarts = label.includes(` ${normalizedTerm}`);
  const contains = label.includes(normalizedTerm);

  if (label === normalizedTerm) return 0;
  if (starts && type === "hotel") return 10;
  if (starts) return 20;
  if (wordStarts && type === "hotel") return 30;
  if (wordStarts) return 40;
  if (contains && type === "hotel") return 60;
  if (contains) return 90;
  return 120;
}

function suggestionTypePriority(value: string | null) {
  if (value === "country") return 0;
  if (value === "region") return 1;
  if (value === "hotel") return 2;
  return 3;
}

function autocompleteRowKey(row: AutocompleteIndexRow) {
  const type = textOrNull(row.suggestion_type) ?? "unknown";
  const hotelId = textOrNull(row.hotel_id);
  const regionId = positiveInteger(row.region_id);
  const label = textOrNull(row.normalized_label) ?? normalizeAutocompleteLabel(textOrNull(row.label) ?? "");

  if (type === "hotel") return `hotel:${hotelId ?? positiveInteger(row.hid) ?? `${regionId ?? "no-region"}:${label}`}`;
  if (regionId) return `${type}:${regionId}`;
  if (textOrNull(row.country_code)) return `${type}:${row.country_code}:${label}`;
  return label ? `${type}:${label}` : null;
}

function normalizeAutocompleteLabel(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function finiteOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function textOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function positiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function numericOrZero(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function httpsUrlOrNull(value: unknown) {
  const text = textOrNull(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
