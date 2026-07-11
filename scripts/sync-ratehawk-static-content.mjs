import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { createZstdDecompress } from "node:zlib";

import { createClient } from "@supabase/supabase-js";

import {
  mapHotel,
  mapHotelRegionBackfill,
} from "./ratehawk-static-content-mapping.mjs";

const mode = process.argv[2];
const options = parseOptions(process.argv.slice(3));
const validModes = new Set([
  "full",
  "incremental",
  "inspect-dump",
  "inspect-region-sample",
  "sync-sample",
  "sync-targeted",
  "sync-recent-search-hotels",
  "sync-rich-batch",
  "backfill-regions",
]);

if (!validModes.has(mode)) {
  throw new Error(
    [
      "Usage:",
      "  node scripts/sync-ratehawk-static-content.mjs <full|incremental> [--resume]",
      "  node scripts/sync-ratehawk-static-content.mjs inspect-dump",
      "  node scripts/sync-ratehawk-static-content.mjs inspect-region-sample [--limit=20] [--scan-limit=500]",
      "  node scripts/sync-ratehawk-static-content.mjs sync-sample [--limit=10] [--scan-limit=500]",
      "  node scripts/sync-ratehawk-static-content.mjs sync-targeted --hotel-ids=id1,id2,id3 [--hids=123,456] [--limit=50] [--scan-limit=200000]",
      "  node scripts/sync-ratehawk-static-content.mjs sync-recent-search-hotels [--limit=50] [--hours=24] [--scan-limit=200000]",
      "  node scripts/sync-ratehawk-static-content.mjs sync-rich-batch [--max-upserts=10000] [--batch-size=100] [--pause-ms=750] [--inventory=all] [--skip-lines=0] [--start-after-hotel-id=id]",
      "  node scripts/sync-ratehawk-static-content.mjs backfill-regions [--insert-missing]",
    ].join("\n"),
  );
}

loadEnvFile(".env");

const resume = options.has("resume");
const insertMissing = options.has("insert-missing");
const language = optionValue("language") ?? process.env.RATEHAWK_STATIC_LANGUAGE?.trim() ?? "en";
const inventory = optionValue("inventory") ?? process.env.RATEHAWK_STATIC_INVENTORY?.trim() ?? "preferable";
// Env resolution: RATEHAWK_STATIC_ENV overrides, else the project-wide
// RATEHAWK_ENV, else "test". Never defaults to "prod" (this project has no
// RATEHAWK_PROD_* creds), so a test-configured project uses its TEST creds/base
// (api.ratehawk.com) without forcing missing PROD envs. Sandbox stays isolated.
const providerEnv =
  (process.env.RATEHAWK_STATIC_ENV?.trim() ||
    process.env.RATEHAWK_ENV?.trim() ||
    "test").toLowerCase();
const credentialPrefix = providerEnv === "prod" ? "PROD" : providerEnv === "sandbox" ? "SANDBOX" : "TEST";
const keyId = requiredEnv(`RATEHAWK_${credentialPrefix}_KEY_ID`);
const apiKey = requiredEnv(`RATEHAWK_${credentialPrefix}_API_KEY`);
const baseUrl = new URL(
  process.env[`RATEHAWK_${credentialPrefix}_BASE_URL`]?.trim() ||
    (providerEnv === "sandbox" ? "https://api-sandbox.worldota.net" : "https://api.ratehawk.com"),
).origin;
const STATIC_DUMP_ENDPOINT = "/api/b2b/v3/hotel/info/dump/";
const TARGETED_LIMIT_MAX = 50;
const TARGETED_SCAN_LIMIT_MAX = 200_000;
const RECENT_SEARCH_HOURS_MAX = 168;
const RICH_BATCH_MAX_UPSERTS = 10_000;
const RICH_BATCH_MAX_BATCH_SIZE = 100;
const RICH_BATCH_DEFAULT_PAUSE_MS = 750;
const RICH_BATCH_MAX_PAUSE_MS = 60_000;
const RICH_BATCH_MAX_SKIP_LINES = 10_000_000;

if (mode === "inspect-dump") {
  await inspectDumpAccess();
} else if (mode === "inspect-region-sample") {
  await inspectRegionSample();
} else if (mode === "sync-sample") {
  await syncSample();
} else if (mode === "sync-targeted") {
  await syncTargeted();
} else if (mode === "sync-recent-search-hotels") {
  await syncRecentSearchHotels();
} else if (mode === "sync-rich-batch") {
  await syncRichBatch();
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

async function inspectDumpAccess() {
  const result = await requestDumpMetadata("/api/b2b/v3/hotel/info/dump/", { language, inventory });
  console.info(
    JSON.stringify(
      {
        mode,
        provider_env: providerEnv,
        base_url: baseUrl,
        endpoint: "/api/b2b/v3/hotel/info/dump/",
        language,
        inventory,
        http_status: result.httpStatus,
        provider_status: result.providerStatus,
        provider_error: result.providerError,
        dump_url_returned: Boolean(result.url),
        dump_url_host: result.url ? new URL(result.url).host : null,
        last_update_returned: Boolean(result.lastUpdate),
      },
      null,
      2,
    ),
  );
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

/**
 * Bounded sample sync: stream the dump, upsert AT MOST `limit` (hard-capped at
 * 10) valid hotel rows into provider_hotel_content, then read them back and
 * print a sanitized verification summary. Never runs a full or incremental sync
 * and never creates a provider_content_sync_runs row. Prints only counts and
 * presence/shape booleans - never full descriptions, policies, or raw payloads,
 * credentials, or signed dump URLs.
 */
async function syncSample() {
  // Hard cap: the sample never writes more than 10 rows regardless of input.
  const limit = numericOption("limit", 10, 1, 10);
  const scanLimit = numericOption("scan-limit", 500, limit, 50_000);

  const supabase = createSupabaseClient();
  const provider = await loadProvider(supabase);
  const dump = await requestDump("/api/b2b/v3/hotel/info/dump/", { language, inventory });
  const lines = await openDumpLines(dump.url);

  const rows = [];
  let scanned = 0;

  for await (const rawLine of lines) {
    const value = parseDumpLine(rawLine);
    if (!value) continue;
    scanned += 1;

    const row = mapHotel(value, provider.id, language);
    if (row) rows.push(row);

    // Stop as soon as we have enough valid hotels or hit the scan ceiling.
    if (rows.length >= limit || scanned >= scanLimit) break;
  }

  const toWrite = rows.slice(0, limit);
  let upserted = 0;
  if (toWrite.length > 0) {
    const result = await supabase
      .from("provider_hotel_content")
      .upsert(toWrite, { onConflict: "provider_id,hotel_id,language" });
    if (result.error) throw result.error;
    upserted = toWrite.length;
  }

  const sampleSummary = toWrite.map((row) => ({
    hotel_id: row.hotel_id,
    name: row.name,
    image_urls_count: Array.isArray(row.image_urls) ? row.image_urls.length : 0,
    amenities_count: Array.isArray(row.amenities) ? row.amenities.length : 0,
    has_description: Boolean(row.description),
    has_policies: Boolean(row.policies && Object.keys(row.policies).length > 0),
  }));

  // Step D: read the just-written rows back and verify shape from the DB.
  const dbVerification = await verifySampleRows(
    supabase,
    provider.id,
    toWrite.map((row) => row.hotel_id),
  );

  console.info(
    JSON.stringify(
      {
        mode,
        provider_env: providerEnv,
        base_url: baseUrl,
        endpoint: "/api/b2b/v3/hotel/info/dump/",
        language,
        inventory,
        limit,
        scan_limit: scanLimit,
        scanned,
        upserted,
        sample_summary: sampleSummary,
        db_verification: dbVerification,
      },
      null,
      2,
    ),
  );
}

async function syncTargeted() {
  const parsedTargets = parseExplicitTargets();
  if (parsedTargets.length === 0) {
    throw new Error("--hotel-ids or --hids is required for sync-targeted");
  }

  const limit = numericOption("limit", TARGETED_LIMIT_MAX, 1, TARGETED_LIMIT_MAX);
  const scanLimit = numericOption("scan-limit", TARGETED_SCAN_LIMIT_MAX, limit, TARGETED_SCAN_LIMIT_MAX);
  const targets = parsedTargets.slice(0, limit);

  await syncTargetRows({
    targets,
    limit,
    scanLimit,
    source: "explicit",
    extraSummary: {
      requested_target_count: parsedTargets.length,
      ignored_target_count: Math.max(0, parsedTargets.length - targets.length),
    },
  });
}

async function syncRecentSearchHotels() {
  const limit = numericOption("limit", TARGETED_LIMIT_MAX, 1, TARGETED_LIMIT_MAX);
  const hours = numericOption("hours", 24, 1, RECENT_SEARCH_HOURS_MAX);
  const scanLimit = numericOption("scan-limit", TARGETED_SCAN_LIMIT_MAX, limit, TARGETED_SCAN_LIMIT_MAX);
  const supabase = createSupabaseClient();
  const provider = await loadProvider(supabase);
  const targets = await loadRecentSearchHotelTargets(supabase, provider.id, limit, hours);

  if (targets.length === 0) {
    console.info(
      JSON.stringify(
        {
          mode,
          provider_env: providerEnv,
          base_url: baseUrl,
          endpoint: STATIC_DUMP_ENDPOINT,
          language,
          inventory,
          source: "recent_search",
          limit,
          hours,
          scan_limit: scanLimit,
          scanned: 0,
          matched: 0,
          upserted: 0,
          missing_target_ids: [],
          db_verification: { rows_found: 0, rows: [] },
        },
        null,
        2,
      ),
    );
    return;
  }

  await syncTargetRows({
    supabase,
    provider,
    targets,
    limit,
    scanLimit,
    source: "recent_search",
    extraSummary: {
      hours,
      recent_target_count: targets.length,
    },
  });
}

async function syncRichBatch() {
  const maxUpserts = numericOption("max-upserts", 1_000, 1, RICH_BATCH_MAX_UPSERTS);
  const batchSize = numericOption("batch-size", RICH_BATCH_MAX_BATCH_SIZE, 1, RICH_BATCH_MAX_BATCH_SIZE);
  const pauseMs = numericOption("pause-ms", RICH_BATCH_DEFAULT_PAUSE_MS, 0, RICH_BATCH_MAX_PAUSE_MS);
  const skipLines = numericOption("skip-lines", 0, 0, RICH_BATCH_MAX_SKIP_LINES);
  const startAfterHotelId = readStartAfterHotelId();

  const supabase = createSupabaseClient();
  const provider = await loadProvider(supabase);
  const beforeDb = await measureProviderHotelContentFootprint(supabase, provider.id);
  const dump = await requestDump(STATIC_DUMP_ENDPOINT, { language, inventory });
  const lines = await openDumpLines(dump.url);

  let scanned = 0;
  let skipped = 0;
  let skippedForResume = 0;
  let skippedNotUseful = 0;
  let skippedInvalid = 0;
  let upserted = 0;
  let batchNumber = 0;
  let batch = [];
  let lastProcessedHotelId = null;
  let waitingForStartAfter = Boolean(startAfterHotelId);
  let startAfterFound = !startAfterHotelId;

  try {
    for await (const rawLine of lines) {
      const value = parseDumpLine(rawLine);
      if (!value) continue;
      scanned += 1;

      if (scanned <= skipLines) {
        skipped += 1;
        skippedForResume += 1;
        continue;
      }

      if (waitingForStartAfter) {
        const identifiers = dumpHotelIdentifiers(value);
        skipped += 1;
        skippedForResume += 1;
        if (identifiers.includes(startAfterHotelId)) {
          waitingForStartAfter = false;
          startAfterFound = true;
        }
        continue;
      }

      const row = mapHotel(value, provider.id, language);
      if (!row) {
        skipped += 1;
        skippedInvalid += 1;
        continue;
      }

      lastProcessedHotelId = row.hotel_id;
      if (!isRichUsefulHotelRow(row)) {
        skipped += 1;
        skippedNotUseful += 1;
        continue;
      }

      batch.push(row);
      if (batch.length >= batchSize || upserted + batch.length >= maxUpserts) {
        const written = await flushRichBatch({
          supabase,
          batch,
          batchNumber: batchNumber + 1,
          scanned,
          skipped,
          upserted,
          pauseMs,
          lastProcessedHotelId,
        });
        upserted += written;
        batchNumber += 1;
        batch = [];
        if (upserted >= maxUpserts) break;
      }
    }
  } finally {
    lines.close();
  }

  if (batch.length > 0 && upserted < maxUpserts) {
    const remaining = maxUpserts - upserted;
    const toWrite = batch.slice(0, remaining);
    const written = await flushRichBatch({
      supabase,
      batch: toWrite,
      batchNumber: batchNumber + 1,
      scanned,
      skipped,
      upserted,
      pauseMs: 0,
      lastProcessedHotelId,
    });
    upserted += written;
    batchNumber += 1;
  }

  const afterDb = await measureProviderHotelContentFootprint(supabase, provider.id);

  console.info(
    JSON.stringify(
      {
        event: "rich_batch_complete",
        mode,
        provider_env: providerEnv,
        base_url: baseUrl,
        endpoint: STATIC_DUMP_ENDPOINT,
        language,
        inventory,
        max_upserts: maxUpserts,
        batch_size: batchSize,
        pause_ms: pauseMs,
        skip_lines: skipLines,
        start_after_hotel_id: startAfterHotelId,
        start_after_found: startAfterFound,
        scanned,
        upserted,
        skipped,
        skipped_for_resume: skippedForResume,
        skipped_invalid: skippedInvalid,
        skipped_not_useful: skippedNotUseful,
        batches: batchNumber,
        last_processed_hotel_id: lastProcessedHotelId,
        db_before: beforeDb,
        db_after: afterDb,
      },
      null,
      2,
    ),
  );
}

async function flushRichBatch({
  supabase,
  batch,
  batchNumber,
  scanned,
  skipped,
  upserted,
  pauseMs,
  lastProcessedHotelId,
}) {
  const written = await upsertProviderHotelRows(supabase, batch);
  const nextUpserted = upserted + written;
  console.info(
    JSON.stringify({
      event: "rich_batch_progress",
      batch: batchNumber,
      scanned,
      upserted: nextUpserted,
      skipped,
      batch_size: written,
      last_processed_hotel_id: lastProcessedHotelId,
    }),
  );
  if (pauseMs > 0) await sleep(pauseMs);
  return written;
}

async function upsertProviderHotelRows(supabase, rows) {
  if (rows.length === 0) return 0;
  const result = await supabase
    .from("provider_hotel_content")
    .upsert(rows, { onConflict: "provider_id,hotel_id,language" });
  if (result.error) throw result.error;
  return rows.length;
}

async function measureProviderHotelContentFootprint(supabase, providerId) {
  const result = await supabase
    .from("provider_hotel_content")
    .select("hotel_id", { count: "exact", head: true })
    .eq("provider_id", providerId)
    .eq("language", language);

  return {
    exact_size_available: false,
    exact_size_note:
      "No existing Supabase RPC/admin SQL helper is available for pg_total_relation_size; reporting exact row count only.",
    row_count_available: !result.error,
    row_count: result.error ? null : result.count,
    row_count_error: result.error ? safeErrorCode(result.error) : null,
  };
}

function isRichUsefulHotelRow(row) {
  if (!row.hotel_id || !row.name) return false;
  return (
    (Array.isArray(row.image_urls) && row.image_urls.length > 0) ||
    (Array.isArray(row.room_groups) && row.room_groups.length > 0) ||
    (Array.isArray(row.amenities) && row.amenities.length > 0) ||
    Boolean(row.description)
  );
}

function readStartAfterHotelId() {
  const raw = optionValue("start-after-hotel-id");
  if (!raw) return null;
  const normalized = targetText(raw);
  if (!normalized) throw new Error("--start-after-hotel-id must be a valid hotel id or HID");
  return normalized;
}

async function syncTargetRows({
  supabase: providedSupabase,
  provider: providedProvider,
  targets,
  limit,
  scanLimit,
  source,
  extraSummary = {},
}) {
  const supabase = providedSupabase ?? createSupabaseClient();
  const provider = providedProvider ?? (await loadProvider(supabase));
  const targetIndex = indexTargets(targets);
  const dump = await requestDump(STATIC_DUMP_ENDPOINT, { language, inventory });
  const lines = await openDumpLines(dump.url);

  const matchedRows = [];
  const matchedTargetLabels = new Set();
  const matchedHotelIds = new Set();
  let scanned = 0;

  try {
    for await (const rawLine of lines) {
      const value = parseDumpLine(rawLine);
      if (!value) continue;
      scanned += 1;

      const matchLabels = labelsForDumpHotel(value, targetIndex);
      if (matchLabels.length > 0) {
        const row = mapHotel(value, provider.id, language);
        if (row) {
          for (const label of matchLabels) matchedTargetLabels.add(label);
        }
        if (row && !matchedHotelIds.has(row.hotel_id)) {
          matchedRows.push({ row, targetLabels: matchLabels });
          matchedHotelIds.add(row.hotel_id);
        }
      }

      if (matchedRows.length >= limit || matchedTargetLabels.size >= targets.length || scanned >= scanLimit) {
        break;
      }
    }
  } finally {
    lines.close();
  }

  const rowsToWrite = matchedRows.slice(0, limit).map((match) => match.row);
  let upserted = 0;
  if (rowsToWrite.length > 0) {
    const result = await supabase
      .from("provider_hotel_content")
      .upsert(rowsToWrite, { onConflict: "provider_id,hotel_id,language" });
    if (result.error) throw result.error;
    upserted = rowsToWrite.length;
  }

  const dbVerification = await verifySampleRows(
    supabase,
    provider.id,
    rowsToWrite.map((row) => row.hotel_id),
  );
  const missingTargetIds = targets
    .map((target) => target.label)
    .filter((label) => !matchedTargetLabels.has(label));

  console.info(
    JSON.stringify(
      {
        mode,
        provider_env: providerEnv,
        base_url: baseUrl,
        endpoint: STATIC_DUMP_ENDPOINT,
        language,
        inventory,
        source,
        limit,
        scan_limit: scanLimit,
        scanned,
        target_count: targets.length,
        matched: matchedRows.length,
        upserted,
        missing_target_ids: missingTargetIds,
        ...extraSummary,
        match_summary: matchedRows.slice(0, limit).map(({ row, targetLabels }) => ({
          target_ids: targetLabels,
          hotel_id: row.hotel_id,
          hid: row.hid,
          name: row.name,
          image_urls_count: Array.isArray(row.image_urls) ? row.image_urls.length : 0,
          amenities_count: Array.isArray(row.amenities) ? row.amenities.length : 0,
          has_description: Boolean(row.description),
          has_policies: Boolean(row.policies && Object.keys(row.policies).length > 0),
        })),
        db_verification: dbVerification,
      },
      null,
      2,
    ),
  );
}

async function loadRecentSearchHotelTargets(supabase, providerId, limit, hours) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const result = await supabase
    .from("provider_quote_snapshots")
    .select("provider_reference,safe_payload,created_at")
    .eq("provider_id", providerId)
    .eq("service_type", "hotel")
    .eq("safe_payload->>stage", "serp")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(Math.min(limit * 8, 500));
  if (result.error) throw result.error;

  const targets = [];
  const seen = new Set();
  for (const row of result.data ?? []) {
    const safePayload = objectOrNull(row.safe_payload) ?? {};
    const hotelId = targetText(row.provider_reference);
    const hid = positiveInteger(safePayload.hid);
    const label = hotelId ?? (hid ? String(hid) : null);
    if (!label) continue;

    const uniqueKey = hotelId ? `hotel:${hotelId}` : `hid:${hid}`;
    if (seen.has(uniqueKey)) continue;
    seen.add(uniqueKey);
    targets.push({ hotelId, hid, label });
    if (targets.length >= limit) break;
  }

  return targets;
}

function parseExplicitTargets() {
  const targets = [];
  const seen = new Set();

  for (const hotelId of optionList("hotel-ids")) {
    const normalized = targetText(hotelId);
    if (!normalized) throw new Error(`Invalid --hotel-ids value: ${hotelId}`);
    const key = `hotel:${normalized}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push({ hotelId: normalized, hid: null, label: normalized });
  }

  for (const hidValue of optionList("hids")) {
    const hid = positiveInteger(hidValue);
    if (!hid) throw new Error(`Invalid --hids value: ${hidValue}`);
    const key = `hid:${hid}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push({ hotelId: null, hid, label: String(hid) });
  }

  return targets;
}

function indexTargets(targets) {
  const indexed = new Map();
  for (const target of targets) {
    for (const identifier of targetIdentifiers(target)) {
      const labels = indexed.get(identifier) ?? new Set();
      labels.add(target.label);
      indexed.set(identifier, labels);
    }
  }
  return indexed;
}

function labelsForDumpHotel(value, targetIndex) {
  const labels = new Set();
  for (const identifier of dumpHotelIdentifiers(value)) {
    const matched = targetIndex.get(identifier);
    if (!matched) continue;
    for (const label of matched) labels.add(label);
  }
  return Array.from(labels);
}

function targetIdentifiers(target) {
  const identifiers = [];
  if (target.hotelId) identifiers.push(target.hotelId);
  if (target.hid) identifiers.push(String(target.hid));
  if (target.label) identifiers.push(target.label);
  return Array.from(new Set(identifiers));
}

function dumpHotelIdentifiers(value) {
  const record = objectOrNull(value);
  if (!record) return [];
  const identifiers = [];
  const hotelId = targetText(record.id);
  const hid = positiveInteger(record.hid);
  if (hotelId) identifiers.push(hotelId);
  if (hid) identifiers.push(String(hid));
  return identifiers;
}

function optionList(name) {
  const raw = optionValue(name);
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function targetText(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > 160) return null;
  return /^[A-Za-z0-9._:-]+$/.test(normalized) ? normalized : null;
}

/** Read back the sample rows and return sanitized presence/shape checks only. */
async function verifySampleRows(supabase, providerId, hotelIds) {
  if (hotelIds.length === 0) return { rows_found: 0, rows: [] };

  const result = await supabase
    .from("provider_hotel_content")
    .select(
      "hotel_id,name,address,star_rating,latitude,longitude,region_id,region_name,region_country_code,primary_image_url,image_urls,room_groups,amenities,description,policies",
    )
    .eq("provider_id", providerId)
    .eq("language", language)
    .in("hotel_id", hotelIds);
  if (result.error) throw result.error;

  const rows = (result.data ?? []).map((row) => {
    const imageUrls = Array.isArray(row.image_urls) ? row.image_urls : null;
    const roomGroups = Array.isArray(row.room_groups) ? row.room_groups : null;
    const amenities = Array.isArray(row.amenities) ? row.amenities : null;
    return {
      hotel_id: row.hotel_id,
      image_urls_is_array: Array.isArray(row.image_urls),
      image_urls_count: imageUrls ? imageUrls.length : 0,
      image_urls_within_max_15: imageUrls ? imageUrls.length <= 15 : true,
      primary_image_url_set_when_images:
        !imageUrls || imageUrls.length === 0 ? true : Boolean(row.primary_image_url),
      room_groups_is_array_or_null: row.room_groups === null || Array.isArray(row.room_groups),
      room_groups_count: roomGroups ? roomGroups.length : 0,
      room_groups_within_max_30: roomGroups ? roomGroups.length <= 30 : true,
      room_group_images_within_max_8: roomGroups
        ? roomGroups.every((group) => !Array.isArray(group?.images) || group.images.length <= 8)
        : true,
      amenities_is_array: Array.isArray(row.amenities),
      amenities_count: amenities ? amenities.length : 0,
      description_ok: row.description === null || typeof row.description === "string",
      policies_is_object:
        row.policies !== null && typeof row.policies === "object" && !Array.isArray(row.policies),
      has_name: Boolean(row.name),
      has_address: Boolean(row.address),
      has_star_rating: row.star_rating !== null && row.star_rating !== undefined,
      has_coords: row.latitude !== null && row.longitude !== null,
      has_region: Boolean(row.region_id || row.region_name || row.region_country_code),
    };
  });

  return { rows_found: rows.length, rows };
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
  const result = await requestDumpMetadata(path, body);
  if (!result.ok || !result.url) {
    throw new Error(`Hotel dump request failed with HTTP ${result.httpStatus}`);
  }
  const parsed = new URL(result.url);
  if (parsed.protocol !== "https:") throw new Error("Hotel dump URL must use HTTPS");
  return {
    url: parsed.toString(),
    lastUpdate: result.lastUpdate,
  };
}

async function requestDumpMetadata(path, body) {
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
  return {
    ok: response.ok && payload?.status === "ok" && typeof url === "string",
    httpStatus: response.status,
    providerStatus: typeof payload?.status === "string" ? payload.status : null,
    providerError: typeof payload?.error === "string" ? payload.error : null,
    url: typeof url === "string" ? url : null,
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

function parseDumpLine(rawLine) {
  const line = rawLine.trim().replace(/,$/, "");
  if (!line || line === "[" || line === "]") return null;
  return JSON.parse(line);
}

function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function objectOrNull(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
