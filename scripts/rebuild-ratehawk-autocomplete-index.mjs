import { existsSync, readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

const SAFE_COUNTRY_NAMES = {
  AE: "United Arab Emirates",
  IN: "India",
  SA: "Saudi Arabia",
  US: "United States",
  GB: "United Kingdom",
};

const COUNTRY_ALIASES = {
  AE: ["UAE", "United Arab Emirates"],
  GB: ["UK", "United Kingdom", "Great Britain"],
  US: ["USA", "United States", "United States of America"],
};

loadEnvFile(".env");

const options = parseOptions(process.argv.slice(2));
const language = optionValue("language") ?? process.env.RATEHAWK_STATIC_LANGUAGE?.trim() ?? "en";
const pageSize = numericOption("page-size", 500, 100, 1000);
const batchSize = numericOption("batch-size", 100, 25, 1000);
const includeHotels = !options.has("no-hotels");
const resume = options.has("resume");

const supabase = createClient(
  requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const provider = await loadProvider();
const regions = new Map();
const countries = new Map();
let processed = 0;
let hotelRowsIndexed = 0;
let countryRowsUpserted = 0;
let regionRowsUpserted = 0;
let hotelRowsUpserted = 0;
let hotelIndexBatch = [];

let resumeFromHotelId = null;
if (resume) {
  resumeFromHotelId = await findLastIndexedHotelId(provider.id);
  logProgress("resume", { resume_from_hotel_id: resumeFromHotelId ?? "START" });
} else {
  await clearAutocompleteIndex(provider.id);
}

let lastHotelId = resumeFromHotelId;
for (;;) {
  const rows = await readHotelContentPage(provider.id, lastHotelId, "hotel_index");
  if (rows.length === 0) break;

  for (const row of rows) {
    const hotelId = text(row.hotel_id);
    const hotelName = text(row.name);
    const regionId = positiveInteger(row.region_id);
    const regionName = text(row.region_name);
    const regionType = text(row.region_type);
    const country = countryCode(row.region_country_code);
    const hid = positiveInteger(row.hid);

    if (!resume) accumulateRegionCountry(row);

    if (includeHotels && hotelId && hotelName && regionId) {
      const hotelRow = buildAutocompleteRow({
        providerId: provider.id,
        suggestionType: "hotel",
        sourceKey: `hotel:${hotelId}`,
        label: hotelName,
        countryCode: country,
        regionId,
        hotelId,
        hid,
        hotelCount: 1,
        metadata: {
          region_name: regionName,
          region_type: regionType,
          country_name: country ? countryNameForCode(country, language) : null,
        },
      });
      if (hotelRow) hotelIndexBatch.push(hotelRow);
      if (hotelIndexBatch.length >= batchSize) {
        hotelRowsUpserted += await upsertAutocompleteRows(hotelIndexBatch, "hotel_upsert");
        hotelRowsIndexed += hotelIndexBatch.length;
        hotelIndexBatch = [];
      }
    }
  }

  processed += rows.length;
  lastHotelId = text(rows.at(-1)?.hotel_id) ?? lastHotelId;

  if (processed % 25_000 === 0) {
    logProgress("progress", { last_hotel_id: lastHotelId ?? "none" });
  }
  if (rows.length < pageSize) break;
}

if (hotelIndexBatch.length) {
  hotelRowsUpserted += await upsertAutocompleteRows(hotelIndexBatch, "hotel_upsert");
  hotelRowsIndexed += hotelIndexBatch.length;
}

if (resume) {
  await buildRegionCountryIndexFromAllHotelContent(provider.id);
}

const regionRows = [];
for (const region of regions.values()) {
  const row = buildAutocompleteRow({
    providerId: provider.id,
    suggestionType: "region",
    sourceKey: `region:${region.regionId}`,
    label: region.label,
    countryCode: region.countryCode,
    regionId: region.regionId,
    hotelId: null,
    hid: null,
    hotelCount: region.hotelCount,
    metadata: {
      region_type: region.regionType,
      country_name: region.countryCode ? countryNameForCode(region.countryCode, language) : null,
    },
  });
  if (row) regionRows.push(row);
}

const countryRows = [];
for (const country of countries.values()) {
  const countryName = countryNameForCode(country.countryCode, language);
  const aliases = countryAliases(country.countryCode, countryName);
  for (const label of aliases) {
    const normalized = normalizeLabel(label);
    const row = buildAutocompleteRow({
      providerId: provider.id,
      suggestionType: "country",
      sourceKey: `country:${country.countryCode}:${normalized}`,
      label,
      countryCode: country.countryCode,
      regionId: country.realRegionId,
      hotelId: null,
      hid: null,
      hotelCount: country.hotelCount,
      metadata: {
        country_name: countryName,
        grouping: !country.realRegionId,
        real_region_label: country.realRegionLabel,
        real_region_type: country.realRegionType,
      },
    });
    if (row) countryRows.push(row);
  }
}

for (let index = 0; index < countryRows.length; index += batchSize) {
  countryRowsUpserted += await upsertAutocompleteRows(
    countryRows.slice(index, index + batchSize),
    "country_upsert",
    { onConflict: true },
  );
}

for (let index = 0; index < regionRows.length; index += batchSize) {
  regionRowsUpserted += await upsertAutocompleteRows(
    regionRows.slice(index, index + batchSize),
    "region_upsert",
    { onConflict: true },
  );
}

console.info(
  [
    "[ratehawk-autocomplete-index] completed",
    `processed=${processed}`,
    `regions=${regions.size}`,
    `countries=${countries.size}`,
    `hotel_rows_indexed=${hotelRowsIndexed}`,
    `country_rows_upserted=${countryRowsUpserted}`,
    `region_rows_upserted=${regionRowsUpserted}`,
    `hotel_rows_upserted=${hotelRowsUpserted}`,
    `page_size=${pageSize}`,
    `batch_size=${batchSize}`,
    `language=${language}`,
  ].join(" "),
);

async function loadProvider() {
  const provider = await supabase
    .from("external_providers")
    .select("id")
    .eq("slug", "ratehawk-hotel")
    .eq("is_active", true)
    .maybeSingle();
  if (provider.error) throw provider.error;
  if (!provider.data?.id) throw new Error("Active RateHawk provider row is missing");
  return { id: provider.data.id };
}

async function findLastIndexedHotelId(providerId) {
  logDbStart("resume_last_hotel_select", {});

  const result = await supabase
    .from("provider_hotel_autocomplete_index")
    .select("hotel_id")
    .eq("provider_id", providerId)
    .eq("language", language)
    .eq("suggestion_type", "hotel")
    .not("hotel_id", "is", null)
    .order("hotel_id", { ascending: false })
    .limit(1);

  if (result.error) throw result.error;

  const hotelId = text((result.data ?? [])[0]?.hotel_id);
  logDbDone("resume_last_hotel_select", { resume_from_hotel_id: hotelId ?? "START" });
  return hotelId;
}

async function buildRegionCountryIndexFromAllHotelContent(providerId) {
  let aggregateProcessed = 0;
  let aggregateLastHotelId = null;

  for (;;) {
    const rows = await readHotelContentPage(providerId, aggregateLastHotelId, "region_country_aggregate");
    if (rows.length === 0) break;

    for (const row of rows) {
      accumulateRegionCountry(row);
    }

    aggregateProcessed += rows.length;
    aggregateLastHotelId = text(rows.at(-1)?.hotel_id) ?? aggregateLastHotelId;

    if (aggregateProcessed % 25_000 === 0) {
      logProgress("aggregate_progress", {
        aggregate_processed: aggregateProcessed,
        last_hotel_id: aggregateLastHotelId ?? "none",
      });
    }
    if (rows.length < pageSize) break;
  }

  logProgress("aggregate_completed", {
    aggregate_processed: aggregateProcessed,
    countries: countries.size,
    regions: regions.size,
  });
}

async function readHotelContentPage(providerId, lastHotelId, pass) {
  logDbStart("provider_hotel_content_page_select", {
    pass,
    last_hotel_id: lastHotelId ?? "START",
    limit: pageSize,
  });

  let query = supabase
    .from("provider_hotel_content")
    .select("hotel_id,hid,name,region_id,region_name,region_country_code,region_type")
    .eq("provider_id", providerId)
    .eq("language", language)
    .order("hotel_id", { ascending: true })
    .limit(pageSize);

  if (lastHotelId) {
    query = query.gt("hotel_id", lastHotelId);
  }

  const result = await query;
  if (result.error) throw result.error;

  const rows = result.data ?? [];
  logDbDone("provider_hotel_content_page_select", {
    pass,
    rows: rows.length,
    last_hotel_id: lastHotelId ?? "START",
    next_hotel_id: text(rows.at(-1)?.hotel_id) ?? "END",
  });
  return rows;
}

function accumulateRegionCountry(row) {
  const regionId = positiveInteger(row.region_id);
  const regionName = text(row.region_name);
  const regionType = text(row.region_type);
  const country = countryCode(row.region_country_code);

  if (country) {
    const countryEntry = ensureCountry(countries, country);
    countryEntry.hotelCount += 1;
  }

  if (regionId && regionName) {
    const regionEntry = ensureRegion(regions, regionId, regionName, country, regionType);
    regionEntry.hotelCount += 1;
    if (country && isCountryRegion(regionType)) {
      const countryEntry = ensureCountry(countries, country);
      countryEntry.realRegionId = regionId;
      countryEntry.realRegionLabel = regionName;
      countryEntry.realRegionType = regionType;
    }
  }
}

async function clearAutocompleteIndex(providerId) {
  let deleted = 0;

  for (;;) {
    logDbStart("cleanup_select", { limit: batchSize, cleared: deleted });

    const selected = await supabase
      .from("provider_hotel_autocomplete_index")
      .select("id")
      .eq("provider_id", providerId)
      .eq("language", language)
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (selected.error) throw selected.error;

    const ids = (selected.data ?? []).map((row) => row.id).filter(Boolean);
    logDbDone("cleanup_select", { rows: ids.length, cleared: deleted });
    if (ids.length === 0) break;

    logDbStart("cleanup_delete", { rows: ids.length, cleared: deleted });

    const removed = await supabase
      .from("provider_hotel_autocomplete_index")
      .delete()
      .eq("provider_id", providerId)
      .eq("language", language)
      .in("id", ids);

    if (removed.error) throw removed.error;

    deleted += ids.length;
    logDbDone("cleanup_delete", { rows: ids.length, cleared: deleted });
  }
}

async function upsertAutocompleteRows(rows, operation, { onConflict = false } = {}) {
  if (rows.length === 0) return 0;
  logDbStart(operation, { rows: rows.length });
  const query = supabase.from("provider_hotel_autocomplete_index");
  const result = onConflict
    ? await query.upsert(rows, { onConflict: "provider_id,language,suggestion_type,source_key" })
    : await query.insert(rows);
  if (result.error) throw result.error;
  logDbDone(operation, { rows: rows.length });
  return rows.length;
}

function buildAutocompleteRow({
  providerId,
  suggestionType,
  sourceKey,
  label,
  countryCode,
  regionId,
  hotelId,
  hid,
  hotelCount,
  metadata,
}) {
  const normalizedLabel = normalizeLabel(label);
  if (!normalizedLabel) return null;
  return {
    provider_id: providerId,
    suggestion_type: suggestionType,
    source_key: sourceKey,
    label: label.trim(),
    normalized_label: normalizedLabel,
    country_code: countryCode,
    region_id: regionId,
    hotel_id: hotelId,
    hid,
    language,
    hotel_count: Math.max(0, Number(hotelCount) || 0),
    metadata: stripNullish(metadata),
  };
}

function logDbStart(operation, details = {}) {
  logProgress(`${operation}:start`, details);
}

function logDbDone(operation, details = {}) {
  logProgress(`${operation}:done`, details);
}

function logProgress(event, details = {}) {
  console.info(
    [
      "[ratehawk-autocomplete-index]",
      `event=${event}`,
      `processed=${processed}`,
      `hotel_rows_indexed=${hotelRowsIndexed}`,
      `country_rows_upserted=${countryRowsUpserted}`,
      `region_rows_upserted=${regionRowsUpserted}`,
      `hotel_rows_upserted=${hotelRowsUpserted}`,
      `page_size=${pageSize}`,
      `batch_size=${batchSize}`,
      ...Object.entries(details).map(([key, value]) => `${key}=${formatLogValue(value)}`),
    ].join(" "),
  );
}

function formatLogValue(value) {
  if (value === null || value === undefined) return "null";
  return String(value).replace(/\s+/g, "_");
}

function ensureRegion(regions, regionId, label, country, regionType) {
  const existing = regions.get(regionId);
  if (existing) {
    if (!existing.countryCode && country) existing.countryCode = country;
    if (!existing.regionType && regionType) existing.regionType = regionType;
    return existing;
  }

  const created = {
    regionId,
    label,
    countryCode: country,
    regionType,
    hotelCount: 0,
  };
  regions.set(regionId, created);
  return created;
}

function ensureCountry(countries, code) {
  const existing = countries.get(code);
  if (existing) return existing;
  const created = {
    countryCode: code,
    hotelCount: 0,
    realRegionId: null,
    realRegionLabel: null,
    realRegionType: null,
  };
  countries.set(code, created);
  return created;
}

function countryNameForCode(code, locale) {
  const normalized = countryCode(code);
  if (!normalized) return null;
  if (SAFE_COUNTRY_NAMES[normalized]) return SAFE_COUNTRY_NAMES[normalized];
  try {
    const displayNames = new Intl.DisplayNames([locale], { type: "region" });
    return displayNames.of(normalized) ?? normalized;
  } catch {
    return normalized;
  }
}

function countryAliases(code, countryName) {
  const aliases = new Set([countryName]);
  for (const alias of COUNTRY_ALIASES[code] ?? []) aliases.add(alias);
  return [...aliases].filter(Boolean);
}

function isCountryRegion(regionType) {
  return typeof regionType === "string" && /^country$/i.test(regionType.trim());
}

function normalizeLabel(value) {
  const raw = text(value);
  if (!raw) return "";
  return raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function stripNullish(value) {
  const out = {};
  for (const [key, entry] of Object.entries(value ?? {})) {
    if (entry !== null && entry !== undefined && entry !== "") out[key] = entry;
  }
  return out;
}

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function countryCode(value) {
  const raw = text(value);
  if (!raw) return null;
  const normalized = raw.toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function parseOptions(args) {
  const parsed = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const withoutPrefix = arg.slice(2);
    const separator = withoutPrefix.indexOf("=");
    if (separator >= 0) {
      parsed.set(withoutPrefix.slice(0, separator), withoutPrefix.slice(separator + 1));
    } else {
      const next = args[index + 1];
      if (next && !next.startsWith("--")) {
        parsed.set(withoutPrefix, next);
        index += 1;
      } else {
        parsed.set(withoutPrefix, "true");
      }
    }
  }
  return parsed;
}

function optionValue(name) {
  const value = options.get(name);
  return typeof value === "string" && value.trim() && value !== "true" ? value.trim() : null;
}

function numericOption(name, fallback, min, max) {
  const raw = optionValue(name);
  const parsed = raw ? Number(raw) : fallback;
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`--${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
