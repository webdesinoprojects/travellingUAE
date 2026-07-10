const MAX_IMAGES = 15;
const MAX_AMENITIES = 80;
const MAX_DESCRIPTION_LENGTH = 3000;

export function mapHotel(value, providerId, locale) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const hotelId = text(value.id) || (positiveInteger(value.hid) ? String(positiveInteger(value.hid)) : null);
  const name = text(value.name);
  if (!hotelId || !name) return null;

  const region = readRegion(value);
  const imageUrls = extractImageUrls(value);

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
    primary_image_url: imageUrls[0] ?? null,
    image_urls: imageUrls,
    amenities: extractAmenities(value),
    policies: extractPolicies(value),
    description: extractDescription(value),
    provider_updated_at: text(value.updated_at),
    synced_at: new Date().toISOString(),
  };
}

export function mapHotelRegionBackfill(value) {
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

export function extractImageUrls(value) {
  const candidates = [];

  if (Array.isArray(value?.images_ext)) {
    for (const entry of value.images_ext) {
      candidates.push(objectOrNull(entry)?.url);
    }
  }

  if (Array.isArray(value?.images)) {
    candidates.push(...value.images);
  }

  if (Array.isArray(value?.image_urls)) {
    candidates.push(...value.image_urls);
  }

  const seen = new Set();
  const urls = [];
  for (const candidate of candidates) {
    const url = normalizeImage(candidate);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= MAX_IMAGES) break;
  }
  return urls;
}

export function extractAmenities(value) {
  const candidates = [];

  collectAmenityValues(value?.amenities, candidates);
  collectAmenityValues(value?.amenity_groups, candidates);
  collectAmenityValues(value?.serp_filters, candidates);

  const seen = new Set();
  const amenities = [];
  for (const candidate of candidates) {
    const normalized = cleanPlainText(candidate, 80);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    amenities.push(normalized);
    if (amenities.length >= MAX_AMENITIES) break;
  }
  return amenities;
}

export function extractDescription(value) {
  const candidates = [
    value?.description,
    value?.description_text,
    value?.overview,
    value?.short_description,
    value?.description_struct,
  ];

  for (const candidate of candidates) {
    const description = cleanPlainText(collectDescriptionText(candidate), MAX_DESCRIPTION_LENGTH);
    if (description) return description;
  }

  return null;
}

export function extractPolicies(value) {
  const policies = {};
  const metapolicy = objectOrNull(value?.metapolicy_struct);
  const policyStruct = objectOrNull(value?.policy_struct);

  if (metapolicy) policies.metapolicy_struct = sanitizeJson(metapolicy);
  if (policyStruct) policies.policy_struct = sanitizeJson(policyStruct);

  copyPolicyText(value, policies, "check_in_time", "check_in_time");
  copyPolicyText(value, policies, "check_out_time", "check_out_time");
  copyPolicyText(value, policies, "checkin_time", "check_in_time");
  copyPolicyText(value, policies, "checkout_time", "check_out_time");
  copyPolicyText(value, policies, "metapolicy_extra_info", "extra_info");

  return policies;
}

function collectAmenityValues(value, output) {
  if (Array.isArray(value)) {
    for (const entry of value) collectAmenityValues(entry, output);
    return;
  }

  if (typeof value === "string" || typeof value === "number") {
    output.push(value);
    return;
  }

  const record = objectOrNull(value);
  if (!record) return;

  const direct = text(record.name) ?? text(record.title) ?? text(record.label) ?? text(record.id);
  if (direct) output.push(direct);

  collectAmenityValues(record.amenities, output);
  collectAmenityValues(record.items, output);
}

function collectDescriptionText(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map(collectDescriptionText).filter(Boolean).join(" ");
  }

  const record = objectOrNull(value);
  if (!record) return null;

  return [
    record.title,
    record.name,
    record.paragraph,
    record.text,
    record.value,
    record.body,
    record.content,
    record.paragraphs,
    record.items,
  ]
    .map(collectDescriptionText)
    .filter(Boolean)
    .join(" ");
}

function copyPolicyText(source, target, sourceKey, targetKey) {
  const value = cleanPlainText(source?.[sourceKey], 500);
  if (value) target[targetKey] = value;
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

function sanitizeJson(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeJson).filter((entry) => entry !== undefined);
  }

  if (value && typeof value === "object") {
    const output = {};
    for (const [key, entry] of Object.entries(value)) {
      const safeKey = cleanKey(key);
      if (!safeKey) continue;
      const safeValue = sanitizeJson(entry);
      if (safeValue !== undefined) output[safeKey] = safeValue;
    }
    return output;
  }

  if (typeof value === "string") return cleanPlainText(value, 500) ?? "";
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean" || value === null) return value;
  return undefined;
}

function cleanKey(value) {
  return /^[A-Za-z0-9_.-]{1,80}$/.test(value) ? value : null;
}

function cleanPlainText(value, maxLength) {
  const raw = text(value);
  if (!raw) return null;
  const cleaned = raw
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function objectOrNull(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function text(value) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
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
