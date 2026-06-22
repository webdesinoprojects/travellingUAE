import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { createZstdDecompress } from "node:zlib";

import { createClient } from "@supabase/supabase-js";

const mode = process.argv[2];
const resume = process.argv.includes("--resume");
if (mode !== "full" && mode !== "incremental") {
  throw new Error("Usage: node scripts/sync-ratehawk-static-content.mjs <full|incremental>");
}

loadEnvFile(".env");

const language = process.env.RATEHAWK_STATIC_LANGUAGE?.trim() || "en";
const inventory = process.env.RATEHAWK_STATIC_INVENTORY?.trim() || "preferable";
const providerEnv = process.env.RATEHAWK_ENV?.trim().toLowerCase() || "test";
const credentialPrefix = providerEnv === "prod" ? "PROD" : providerEnv === "sandbox" ? "SANDBOX" : "TEST";
const keyId = requiredEnv(`RATEHAWK_${credentialPrefix}_KEY_ID`);
const apiKey = requiredEnv(`RATEHAWK_${credentialPrefix}_API_KEY`);
const baseUrl = new URL(
  process.env[`RATEHAWK_${credentialPrefix}_BASE_URL`]?.trim() ||
    (providerEnv === "sandbox" ? "https://api-sandbox.worldota.net" : "https://api.worldota.net"),
).origin;

const supabase = createClient(
  requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const endpoint = mode === "full"
  ? "/api/b2b/v3/hotel/info/dump/"
  : "/api/b2b/v3/hotel/info/incremental_dump/";

const provider = await supabase
  .from("external_providers")
  .select("id")
  .eq("slug", "ratehawk-hotel")
  .eq("is_active", true)
  .maybeSingle();
if (provider.error) throw provider.error;
if (!provider.data?.id) throw new Error("Active RateHawk provider row is missing");

const run = await supabase
  .from("provider_content_sync_runs")
  .insert({ provider_id: provider.data.id, sync_type: mode, language, status: "running" })
  .select("id")
  .single();
if (run.error || !run.data?.id) throw run.error ?? new Error("Could not create sync run");

let processed = 0;
try {
  const existingHotelIds = resume && mode === "full"
    ? await loadExistingHotelIds()
    : null;
  const dump = await requestDump(endpoint, { language, inventory });
  const response = await fetch(dump.url, {
    headers: { "User-Agent": "FlyTime-Backend/1.0 (static-content-sync)" },
    redirect: "follow",
  });
  if (!response.ok || !response.body) {
    throw new Error(`Hotel dump download failed with HTTP ${response.status}`);
  }

  const lines = createInterface({
    input: Readable.fromWeb(response.body).pipe(createZstdDecompress()),
    crlfDelay: Infinity,
  });
  let batch = [];
  for await (const rawLine of lines) {
    const line = rawLine.trim().replace(/,$/, "");
    if (!line || line === "[" || line === "]") continue;
    const row = mapHotel(JSON.parse(line), provider.data.id, language);
    if (!row) continue;
    batch.push(row);
    if (batch.length >= 100) {
      await upsertBatch(batch, existingHotelIds);
      processed += batch.length;
      batch = [];
      if (processed % 5000 === 0) console.info(`[ratehawk-static-sync] processed=${processed}`);
    }
  }
  if (batch.length) {
    await upsertBatch(batch, existingHotelIds);
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
  console.info(`[ratehawk-static-sync] status=completed mode=${mode} records=${processed}`);
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

async function upsertBatch(batch, existingHotelIds) {
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

async function loadExistingHotelIds() {
  const ids = new Set();
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const result = await supabase
      .from("provider_hotel_content")
      .select("hotel_id")
      .eq("provider_id", provider.data.id)
      .eq("language", language)
      .range(offset, offset + pageSize - 1);
    if (result.error) throw result.error;
    const rows = result.data ?? [];
    for (const row of rows) ids.add(row.hotel_id);
    if (rows.length < pageSize) break;
  }
  console.info(`[ratehawk-static-sync] resume_existing=${ids.size}`);
  return ids;
}

function mapHotel(value, providerId, locale) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const hotelId = text(value.id) || (Number.isSafeInteger(Number(value.hid)) ? String(value.hid) : null);
  const name = text(value.name);
  if (!hotelId || !name) return null;

  const images = Array.isArray(value.images_ext)
    ? value.images_ext.map((entry) => normalizeImage(entry?.url)).filter(Boolean).slice(0, 30)
    : Array.isArray(value.images)
      ? value.images.map(normalizeImage).filter(Boolean).slice(0, 30)
      : [];
  return {
    provider_id: providerId,
    hotel_id: hotelId,
    hid: Number.isSafeInteger(Number(value.hid)) ? Number(value.hid) : null,
    region_id: Number.isSafeInteger(Number(value.region_id)) ? Number(value.region_id) : null,
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

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function finite(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
