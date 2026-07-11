const MAX_IMAGES = 15;
const MAX_ROOM_GROUPS = 30;
const MAX_ROOM_GROUP_IMAGES = 8;
const MAX_ROOM_GROUP_AMENITIES = 16;
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
    room_groups: extractRoomGroups(value),
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

export function extractRoomGroups(value) {
  if (!Array.isArray(value?.room_groups)) return null;

  const groups = [];
  const seen = new Set();

  for (const entry of value.room_groups) {
    const group = objectOrNull(entry);
    if (!group) continue;

    const images = extractRoomGroupImages(group);
    const amenities = extractRoomGroupAmenities(group);
    const rgExt = sanitizeRoomGroupRgExt(group.rg_ext);
    const beds = extractRoomGroupBeds(group.beds);
    const bedType = cleanPlainText(
      text(group.bedding_type) ?? text(group.bed_type) ?? text(group.bed),
      80,
    );
    const roomSizeSqm = readRoomSizeSqm(group);
    const smokingLabel = extractSmokingLabel([group.smoking, group.smoking_label, ...amenities]);
    const hasBathroom = readRoomGroupBathroom(group, rgExt, amenities);
    const capacity = positiveInteger(rgExt.capacity) ?? positiveInteger(group.capacity);

    const roomGroup = {
      id: cleanPlainText(
        text(group.id) ?? text(group.room_group_id) ?? text(group.room_id),
        120,
      ),
      name: cleanPlainText(
        text(group.name) ?? text(group.room_name) ?? text(group.main_name),
        160,
      ),
      main_name: cleanPlainText(text(group.main_name), 160),
      main_room_type: cleanPlainText(text(group.main_room_type), 160),
      images,
      amenities,
      rg_ext: rgExt,
      bed_type: bedType,
      beds,
      room_size_sqm: roomSizeSqm,
      smoking_label: smokingLabel,
      has_bathroom: hasBathroom,
      capacity,
    };

    if (!roomGroup.name && !roomGroup.main_name && !roomGroup.main_room_type) continue;
    if (images.length === 0 && amenities.length === 0 && beds.length === 0 && !roomSizeSqm && !bedType && !capacity && !hasBathroom && !smokingLabel) {
      continue;
    }

    const key = [
      roomGroup.id,
      roomGroup.name,
      roomGroup.main_name,
      roomGroup.main_room_type,
    ]
      .filter(Boolean)
      .join("|")
      .toLowerCase();
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);

    groups.push(dropNullRoomGroupFields(roomGroup));
    if (groups.length >= MAX_ROOM_GROUPS) break;
  }

  return groups.length > 0 ? groups : null;
}

function extractRoomGroupImages(group) {
  const candidates = [];

  if (Array.isArray(group.images_ext)) {
    for (const entry of group.images_ext) {
      candidates.push(objectOrNull(entry)?.url);
    }
  }

  if (Array.isArray(group.images)) candidates.push(...group.images);
  if (Array.isArray(group.room_images)) candidates.push(...group.room_images);
  if (Array.isArray(group.photos)) candidates.push(...group.photos);
  if (Array.isArray(group.photo_urls)) candidates.push(...group.photo_urls);

  const seen = new Set();
  const urls = [];
  for (const candidate of candidates) {
    const url = normalizeImage(candidate);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= MAX_ROOM_GROUP_IMAGES) break;
  }
  return urls;
}

function extractRoomGroupAmenities(group) {
  const candidates = [];
  collectAmenityValues(group.room_amenities, candidates);
  collectAmenityValues(group.amenities, candidates);
  collectAmenityValues(group.amenity_groups, candidates);
  collectAmenityValues(group.serp_filters, candidates);

  const seen = new Set();
  const amenities = [];
  for (const candidate of candidates) {
    const normalized = cleanPlainText(candidate, 80);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    amenities.push(normalized);
    if (amenities.length >= MAX_ROOM_GROUP_AMENITIES) break;
  }
  return amenities;
}

function extractRoomGroupBeds(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const beds = [];

  for (const entry of value) {
    const record = objectOrNull(entry);
    const label = cleanPlainText(
      text(entry) ?? text(record?.name) ?? text(record?.type) ?? text(record?.bedding_type),
      80,
    );
    if (!label) continue;
    const count = positiveInteger(record?.count);
    const display = count && count > 1 ? `${count} ${label}` : label;
    const key = display.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    beds.push(display);
    if (beds.length >= 6) break;
  }

  return beds;
}

function sanitizeRoomGroupRgExt(value) {
  const source = objectOrNull(value);
  if (!source) return {};
  const safe = {};
  for (const key of ["class", "quality", "sex", "bathroom", "bedding", "family", "capacity", "club", "balcony", "view"]) {
    const raw = source[key];
    if (
      typeof raw === "string" ||
      typeof raw === "boolean" ||
      (typeof raw === "number" && Number.isFinite(raw))
    ) {
      safe[key] = raw;
    }
  }
  return safe;
}

function readRoomSizeSqm(group) {
  const candidates = [
    group.room_area,
    group.room_size,
    group.area,
    group.size,
    group.square_meters,
    group.sqm,
  ];

  for (const candidate of candidates) {
    const record = objectOrNull(candidate);
    const value =
      finite(candidate) ??
      finite(record?.square_meters) ??
      finite(record?.sqm) ??
      finite(record?.value);
    if (value !== null && value > 0 && value < 1000) return value;
  }

  return null;
}

function extractSmokingLabel(values) {
  const labels = values
    .map((value) => text(value)?.toLowerCase())
    .filter(Boolean);

  if (labels.some((label) => label.includes("non-smoking") || label.includes("non smoking"))) {
    return "Non-smoking";
  }
  if (labels.some((label) => label === "smoking" || label.includes("smoking room"))) {
    return "Smoking";
  }
  return null;
}

function readRoomGroupBathroom(group, rgExt, amenities) {
  if (typeof group.has_bathroom === "boolean") return group.has_bathroom;
  if (positiveInteger(rgExt.bathroom)) return true;
  return amenities.some((amenity) => amenity.toLowerCase().includes("bathroom")) ? true : null;
}

function dropNullRoomGroupFields(group) {
  const output = {};
  for (const [key, value] of Object.entries(group)) {
    if (value === null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) continue;
    output[key] = value;
  }
  return output;
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
