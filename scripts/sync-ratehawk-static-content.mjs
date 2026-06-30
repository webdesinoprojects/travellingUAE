import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { createZstdDecompress } from "node:zlib";

import { createClient } from "@supabase/supabase-js";

const mode = process.argv[2];
const options = parseOptions(process.argv.slice(3));
const validModes = new Set(["full", "incremental", "inspect-region-sample", "backfill-regions"]);

if (!validModes.has(mode)) {
  throw new Error(
    [
      "Usage:",
      "  node scripts/sync-ratehawk-static-content.mjs <full|incremental> [--resume]",
      "  node scripts/sync-ratehawk-static-content.mjs inspect-region-sample [--limit=20] [--scan-limit=500]",
      "  node scripts/sync-ratehawk-static-content.mjs backfill-regions [--insert-missing]",
    ].join("\n"),
  );
}

loadEnvFile(".env");

const resume = options.has("resume");
const insertMissing = options.has("insert-missing");
const language = optionValue("language") ?? process.env.RATEHAWK_STATIC_LANGUAGE?.trim() ?? "en";
const inventory = optionValue("inventory") ?? process.env.RATEHAWK_STATIC_INVENTORY?.trim() ?? "preferable";
const providerEnv = process.env.RATEHAWK_ENV?.trim().toLowerCase() || "test";
const credentialPrefix = providerEnv === "prod" ? "PROD" : providerEnv === "sandbox" ? "SANDBOX" : "TEST";
const keyId = requiredEnv(`RATEHAWK_${credentialPrefix}_KEY_ID`);
const apiKey = requiredEnv(`RATEHAWK_${credentialPrefix}_API_KEY`);
const baseUrl = new URL(
  process.env[`RATEHAWK_${credentialPrefix}_BASE_URL`]?.trim() ||
    (providerEnv === "sandbox" ? "https://api-sandbox.worldota.net" : "https://api.worldota.net"),
).origin;

if (mode === "inspect-region-sample") {
  await inspectRegionSample();
} else if (mode === "backfill-regions") {
  await backfillRegions();
} else {
  await syncStaticContent(mode);
}

async function syncStaticContent(syncMode) {
  const supabase = createSupabaseClient();
  const provider = await loadProvider(supabase);
  const endpoint = syncMode === "full"
    ? "/api/b2b/v3/hotel/info/dump/"
    : "/api/b2b/v3/hotel/info/incremental_dump/";

  const run = await supabase
    .from("provider_content_sync_runs")
    .insert({ provider_id: provider.id, sync_type: syncMode, language, status: "running" })
    .select("id")
    .single();
  if (run.error || !run.data?.id) throw run.error ?? new Error("Could not create sync run");

  let processed = 0;
  try {
    const existingHotelIds = resume && syncMode === "full"
      ? await loadExistingHotelIds(supabase, provider.id)
      : null;
    const dump = await requestDump(endpoint, { language, inventory });
    const lines = await openDumpLines(dump.url);
    let batch = [];

    for await (const rawLine of lines) {
      const value = parseDumpLine(rawLine);
      if (!value) continue;

      const row = mapHotel(value, provider.id, language);
      if (!row) continue;
      batch.push(row);

      if (batch.length >= 100) {
        await upsertBatch(supabase, batch, existingHotelIds);
        processed += batch.length;
        batch = [];
        if (processed % 5000 === 0) console.info(`[ratehawk-static-sync] processed=${processed}`);
      }
    }

    if (batch.length) {
      await upsertBatch(supabase, batch, existingHotelIds);
      processed += batch.length;
    }

    const completed = await supabase
      .from("provider_content_sync_runs")
      .update({
        status: "completed",
        records_processed: processed,
        provider_last_update: dump.lastUpdate,
        completed_at: new Date().toISOString(),
      })
      .eq("id", run.data.id);
    if (completed.error) throw completed.error;
    console.info(`[ratehawk-static-sync] status=completed mode=${syncMode} records=${processed}`);
  } catch (error) {
    await supabase
      .from("provider_content_sync_runs")
      .update({
        status: "failed",
        records_processed: processed,
        error_code: safeErrorCode(error),
        completed_at: new Date().toISOString(),
      })
      .eq("id", run.data.id);
    throw error;
  }
}

async function inspectRegionSample() {
  const limit = numericOption("limit", 20, 1, 200);
  const scanLimit = numericOption("scan-limit", Math.max(limit * 25, 100), limit, 50_000);
  const dump = await requestDump("/api/b2b/v3/hotel/info/dump/", { language, inventory });
  const lines = await openDumpLines(dump.url);
  const samples = [];
  const fallbackSampleLimit = Math.min(limit, 5);
  let scanned = 0;
  let rowsWithRegionObject = 0;
  let rowsWithTopLevelRegionId = 0;

  for await (const rawLine of lines) {
    const value = parseDumpLine(rawLine);
    if (!value) continue;
    scanned += 1;

    const region = objectOrNull(value.region);
    const topLevelRegionId = positiveInteger(value.region_id);
    if (region) rowsWithRegionObject += 1;
    if (topLevelRegionId) rowsWithTopLevelRegionId += 1;

    if (samples.length < limit && (region || topLevelRegionId || samples.length < fallbackSampleLimit)) {
      samples.push({
        hotel_id: text(value.id) ?? (positiveInteger(value.hid) ? String(positiveInteger(value.hid)) : null),
        name: text(value.name),
        has_region_object: Boolean(region),
        region_keys: region ? Object.keys(region).sort() : [],
        region_sample: region
          ? {
              id: region.id ?? null,
              name: region.name ?? null,
              country_code: region.country_code ?? null,
              type: region.type ?? null,
            }
          : null,
        top_level_region_id: value.region_id ?? null,
      });
    }

    if (scanned >= scanLimit) break;
  }

  console.info(
    JSON.stringify(
      {
        mode,
        language,
        inventory,
        endpoint: "/api/b2b/v3/hotel/info/dump/",
        scanned,
        rows_with_region_object: rowsWithRegionObject,
        rows_with_top_level_region_id: rowsWithTopLevelRegionId,
        samples,
      },
      null,
      2,
    ),
  );
}

async function backfillRegions() {
  const supabase = createSupabaseClient();
  const provider = await loadProvider(supabase);
  const dump = await requestDump("/api/b2b/v3/hotel/info/dump/", { language, inventory });
  const lines = await openDumpLines(dump.url);
  let processed = 0;
  let updated = 0;
  let insertedOrUpdated = 0;
  let batch = [];
  let insertBatch = [];

  console.info(
    `[ratehawk-static-backfill] starting provider=${provider.id} language=${language} inventory=${inventory} insert_missing=${insertMissing}`,
  );

  for await (const rawLine of lines) {
    const value = parseDumpLine(rawLine);
    if (!value) continue;

    const regionRow = mapHotelRegionBackfill(value);
    if (regionRow) batch.push(regionRow);

    if (insertMissing) {
      const hotelRow = mapHotel(value, provider.id, language);
      if (hotelRow) insertBatch.push(hotelRow);
    }

    if (batch.length >= 500) {
      updated += await updateRegionBatch(supabase, provider.id, batch);
      processed += batch.length;
      batch = [];
      if (insertMissing && insertBatch.length) {
        await upsertBatch(supabase, insertBatch, null);
        insertedOrUpdated += insertBatch.length;
        insertBatch = [];
      }
      if (processed % 10_000 === 0) {
        console.info(`[ratehawk-static-backfill] processed=${processed} updated_existing=${updated}`);
      }
    }
    if (insertMissing && insertBatch.length >= 500) {
      await upsertBatch(supabase, insertBatch, null);
      insertedOrUpdated += insertBatch.length;
      insertBatch = [];
    }
  }

  if (batch.length) {
    updated += await updateRegionBatch(supabase, provider.id, batch);
    processed += batch.length;
  }
  if (insertMissing && insertBatch.length) {
    await upsertBatch(supabase, insertBatch, null);
    insertedOrUpdated += insertBatch.length;
  }

  console.info(
    `[ratehawk-static-backfill] completed processed=${processed} updated_existing=${updated} inserted_or_updated=${insertedOrUpdated}`,
  );
}

async function requestDump(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${apiKey}`).toString("base64")}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "FlyTime-Backend/1.0 (static-content-sync)",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => null);
  const url = payload?.data?.url;
  const lastUpdate = payload?.data?.last_update;
  if (!response.ok || payload?.status !== "ok" || typeof url !== "string") {
    throw new Error(`Hotel dump request failed with HTTP ${response.status}`);
  }
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("Hotel dump URL must use HTTPS");
  return {
    url: parsed.toString(),
    lastUpdate: typeof lastUpdate === "string" ? lastUpdate : null,
  };
}

async function openDumpLines(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "FlyTime-Backend/1.0 (static-content-sync)" },
    redirect: "follow",
  });
  if (!response.ok || !response.body) {
    throw new Error(`Hotel dump download failed with HTTP ${response.status}`);
  }

  return createInterface({
    input: Readable.fromWeb(response.body).pipe(createZstdDecompress()),
    crlfDelay: Infinity,
  });
}

async function upsertBatch(supabase, batch, existingHotelIds) {
  const rows = existingHotelIds
    ? batch.filter((row) => !existingHotelIds.has(row.hotel_id))
    : batch;
  if (rows.length === 0) return;
  const result = await supabase
    .from("provider_hotel_content")
    .upsert(rows, { onConflict: "provider_id,hotel_id,language" });
  if (result.error) throw result.error;
  if (existingHotelIds) {
    for (const row of rows) existingHotelIds.add(row.hotel_id);
  }
}

async function updateRegionBatch(supabase, providerId, batch) {
  const result = await supabase.rpc("backfill_provider_hotel_content_regions", {
    p_provider_id: providerId,
    p_language: language,
    p_rows: batch,
  });
  if (result.error) throw result.error;
  return Number(result.data) || 0;
}

async function loadExistingHotelIds(supabase, providerId) {
  const ids = new Set();
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const result = await supabase
      .from("provider_hotel_content")
      .select("hotel_id")
      .eq("provider_id", providerId)
      .eq("language", language)
      .order("hotel_id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (result.error) throw result.error;
    const rows = result.data ?? [];
    for (const row of rows) ids.add(row.hotel_id);
    if (rows.length < pageSize) break;
  }
  console.info(`[ratehawk-static-sync] resume_existing=${ids.size}`);
  return ids;
}

async function loadProvider(supabase) {
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

function createSupabaseClient() {
  return createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function mapHotel(value, providerId, locale) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const hotelId = text(value.id) || (positiveInteger(value.hid) ? String(positiveInteger(value.hid)) : null);
  const name = text(value.name);
  if (!hotelId || !name) return null;

  const region = readRegion(value);
  const images = Array.isArray(value.images_ext)
    ? value.images_ext.map((entry) => normalizeImage(entry?.url)).filter(Boolean).slice(0, 30)
    : Array.isArray(value.images)
      ? value.images.map(normalizeImage).filter(Boolean).slice(0, 30)
      : [];

  return {
    provider_id: providerId,
    hotel_id: hotelId,
    hid: positiveInteger(value.hid),
    region_id: region.id,
    region_name: region.name,
    region_country_code: region.countryCode,
    region_type: region.type,
    language: locale,
    name,
    address: text(value.address),
    star_rating: finite(value.star_rating),
    latitude: finite(value.latitude),
    longitude: finite(value.longitude),
    primary_image_url: images[0] ?? null,
    // Keep the relational search index lean. ETG internal content such as the
    // full image gallery and descriptions is display-only and must not be
    // indexed; storing it for every hotel also exceeds small Postgres plans.
    image_urls: [],
    amenities: [],
    policies: value.metapolicy_struct && typeof value.metapolicy_struct === "object" ? value.metapolicy_struct : {},
    description: null,
    provider_updated_at: text(value.updated_at),
    synced_at: new Date().toISOString(),
  };
}

function mapHotelRegionBackfill(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const hotelId = text(value.id) || (positiveInteger(value.hid) ? String(positiveInteger(value.hid)) : null);
  if (!hotelId) return null;
  const region = readRegion(value);
  if (!region.id && !region.name && !region.countryCode && !region.type) return null;

  return {
    hotel_id: hotelId,
    region_id: region.id,
    region_name: region.name,
    region_country_code: region.countryCode,
    region_type: region.type,
  };
}

function readRegion(value) {
  const region = objectOrNull(value.region);
  return {
    id: positiveInteger(region?.id) ?? positiveInteger(value.region_id),
    name: text(region?.name) ?? text(value.region_name),
    countryCode: countryCode(region?.country_code) ?? countryCode(value.country_code),
    type: text(region?.type) ?? text(value.region_type),
  };
}

function normalizeImage(value) {
  const raw = text(value);
  if (!raw) return null;
  try {
    const url = new URL(raw.replace("{size}", "640x400"));
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function parseDumpLine(rawLine) {
  const line = rawLine.trim().replace(/,$/, "");
  if (!line || line === "[" || line === "]") return null;
  return JSON.parse(line);
}

function objectOrNull(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
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

function finite(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

function safeErrorCode(error) {
  if (error instanceof Error) return error.name.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 64);
  return "unknown_error";
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
