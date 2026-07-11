/**
 * Pure display helpers for RateHawk static hotel content (provider_hotel_content).
 *
 * No IO, no `server-only` — node --test friendly. These sanitize/shape the
 * cached static fields for public rendering: they never invent data (a missing
 * field yields an empty array / null, never a placeholder value) and only ever
 * surface safe, readable values (no raw policy JSON dumps).
 */

import type {
  HotelPaidOnSpotItem,
  HotelPolicyInfo,
  HotelRateDTO,
  HotelStaticRoomGroupDTO,
} from "@/types/hotels";

/** Gallery cap — keeps the detail payload small and avoids rendering 50 images. */
export const MAX_GALLERY_IMAGES = 12;
export const MAX_ROOM_GROUPS = 30;
export const MAX_ROOM_GROUP_IMAGES = 8;
export const MAX_ROOM_GROUP_AMENITIES = 16;
/** Amenity payload cap — the UI shows fewer; this bounds the DTO size. */
export const MAX_AMENITIES = 40;
const MAX_POLICY_TEXT = 400;

function httpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

/**
 * Build the ordered, de-duplicated gallery: the primary image first (when it is
 * a valid https URL), then the rest of image_urls, https-only, capped. Returns
 * [] when nothing valid exists so the UI can fall back to a placeholder.
 */
export function buildHotelGalleryImages(
  primaryImageUrl: unknown,
  imageUrls: unknown,
  max: number = MAX_GALLERY_IMAGES,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (candidate: unknown) => {
    if (out.length >= max) return;
    const url = httpsUrl(candidate);
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push(url);
  };

  push(primaryImageUrl);
  if (Array.isArray(imageUrls)) {
    for (const candidate of imageUrls) push(candidate);
  }

  return out;
}

export function extractStaticRoomGroups(roomGroups: unknown): HotelStaticRoomGroupDTO[] {
  if (!Array.isArray(roomGroups)) return [];

  const groups: HotelStaticRoomGroupDTO[] = [];
  const seen = new Set<string>();

  for (const entry of roomGroups) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const name = cleanText(record.name, 160);
    const mainName = cleanText(record.main_name, 160);
    const mainRoomType = cleanText(record.main_room_type, 160);
    if (!name && !mainName && !mainRoomType) continue;

    const group: HotelStaticRoomGroupDTO = {
      id: cleanText(record.id, 120),
      name,
      mainName,
      mainRoomType,
      images: buildRoomGroupImages(record.images),
      amenities: buildRoomGroupAmenities(record.amenities),
      rgExt: buildRoomGroupRgExt(record.rg_ext),
      bedType: cleanText(record.bed_type, 80),
      beds: buildRoomGroupBeds(record.beds),
      roomSizeSqm: positiveNumber(record.room_size_sqm),
      smokingLabel: cleanText(record.smoking_label, 80),
      hasBathroom: typeof record.has_bathroom === "boolean" ? record.has_bathroom : null,
      capacity: positiveInteger(record.capacity),
    };

    const key = [group.id, group.name, group.mainName, group.mainRoomType]
      .filter(Boolean)
      .join("|")
      .toLowerCase();
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);

    groups.push(group);
    if (groups.length >= MAX_ROOM_GROUPS) break;
  }

  return groups;
}

function buildRoomGroupImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    if (out.length >= MAX_ROOM_GROUP_IMAGES) break;
    const url = httpsUrl(entry);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }

  return out;
}

function buildRoomGroupAmenities(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    const text = cleanText(entry, 80);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= MAX_ROOM_GROUP_AMENITIES) break;
  }

  return out;
}

function buildRoomGroupBeds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    const text = cleanText(entry, 80);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= 6) break;
  }

  return out;
}

function buildRoomGroupRgExt(value: unknown): Record<string, number | string | boolean | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const out: Record<string, number | string | boolean | null> = {};

  for (const key of [
    "class",
    "quality",
    "sex",
    "bathroom",
    "bedding",
    "family",
    "capacity",
    "club",
    "balcony",
    "view",
  ]) {
    const entry = source[key];
    if (
      typeof entry === "string" ||
      typeof entry === "boolean" ||
      (typeof entry === "number" && Number.isFinite(entry)) ||
      entry === null
    ) {
      out[key] = entry;
    }
  }

  return out;
}

export function enrichRatesWithStaticRoomGroups(
  rates: HotelRateDTO[],
  roomGroups: HotelStaticRoomGroupDTO[],
): HotelRateDTO[] {
  if (roomGroups.length === 0) return rates;

  return rates.map((rate) => {
    const group = findStaticRoomGroupForRate(rate, roomGroups);
    if (!group) return rate;

    const roomImages = mergeStrings(rate.roomImages, group.images, MAX_ROOM_GROUP_IMAGES);
    return {
      ...rate,
      roomGroupName: rate.roomGroupName ?? group.name ?? group.mainName ?? group.mainRoomType,
      roomImages,
      roomPhotoCount: roomImages.length,
      bedType: rate.bedType ?? group.bedType,
      beds: mergeStrings(rate.beds, group.beds, 6),
      roomSizeSqm: rate.roomSizeSqm ?? group.roomSizeSqm,
      amenities: mergeStrings(rate.amenities, group.amenities, 12),
      smokingLabel: rate.smokingLabel ?? group.smokingLabel,
      hasBathroom: rate.hasBathroom || group.hasBathroom === true,
      capacity: rate.capacity ?? group.capacity,
    };
  });
}

export function findStaticRoomGroupForRate(
  rate: HotelRateDTO,
  roomGroups: HotelStaticRoomGroupDTO[],
): HotelStaticRoomGroupDTO | null {
  const rateNames = roomNameKeys([
    rate.roomGroupName,
    rate.roomName,
    stripParenthetical(rate.roomGroupName),
    stripParenthetical(rate.roomName),
  ]);
  if (rateNames.length === 0) return null;

  const candidates = roomGroups
    .map((group) => ({
      group,
      score: scoreRoomGroupMatch(
        rateNames,
        roomNameKeys([
          group.name,
          group.mainName,
          group.mainRoomType,
          stripParenthetical(group.name),
          stripParenthetical(group.mainName),
          stripParenthetical(group.mainRoomType),
        ]),
      ),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);

  if (candidates.length === 0) return null;
  if (candidates.length > 1 && candidates[0].score === candidates[1].score) return null;
  return candidates[0].group;
}

function scoreRoomGroupMatch(rateNames: string[], groupNames: string[]) {
  let score = 0;

  for (const rateName of rateNames) {
    for (const groupName of groupNames) {
      if (rateName === groupName) score = Math.max(score, 100);
      const rateBase = stripRoomNoise(rateName);
      const groupBase = stripRoomNoise(groupName);
      if (rateBase && groupBase && rateBase === groupBase) score = Math.max(score, 90);
      if (
        Math.min(rateName.length, groupName.length) >= 14 &&
        (rateName.includes(groupName) || groupName.includes(rateName))
      ) {
        score = Math.max(score, 60);
      }
    }
  }

  return score;
}

function roomNameKeys(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = normalizeRoomName(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function normalizeRoomName(value: string | null | undefined) {
  const text = value
    ?.toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text && text.length >= 3 ? text : null;
}

function stripParenthetical(value: string | null | undefined) {
  return value?.replace(/\([^)]*\)/g, " ").trim() ?? null;
}

function stripRoomNoise(value: string) {
  return value
    .replace(/\b(?:non smoking|smoking|with|bed|beds|room|rooms)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mergeStrings(left: string[], right: string[], max: number) {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const value of [...left, ...right]) {
    const text = cleanText(value, 120);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= max) break;
  }

  return out;
}

function positiveNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function positiveInteger(value: unknown): number | null {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

/** Trim, de-dupe and cap the amenities array. Non-string entries are dropped. */
export function pickHotelAmenities(amenities: unknown, max: number = MAX_AMENITIES): string[] {
  if (!Array.isArray(amenities)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of amenities) {
    const text = cleanText(entry, 80);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Extract only safe, readable policy fields (check-in / check-out time + a short
 * extra-info string). Never returns the raw metapolicy/policy_struct JSON.
 * Returns null when nothing useful is present so the section can be hidden.
 */
export function extractSafeHotelPolicies(policies: unknown): HotelPolicyInfo | null {
  if (!policies || typeof policies !== "object" || Array.isArray(policies)) {
    return null;
  }
  const record = policies as Record<string, unknown>;

  const checkInTime = cleanText(record.check_in_time, 120);
  const checkOutTime = cleanText(record.check_out_time, 120);
  const extraInfo = cleanText(record.extra_info, MAX_POLICY_TEXT);

  if (!checkInTime && !checkOutTime && !extraInfo) {
    return null;
  }
  return { checkInTime, checkOutTime, extraInfo };
}

/**
 * Known metapolicy_struct sections we can safely surface as "paid on the spot"
 * charges. Each section is an array of entries with a consistent shape
 * (`{ price, currency, inclusion, price_unit, ... }`). We ONLY read those
 * whitelisted primitive fields — never the raw object — and only emit an entry
 * when it carries a real positive price. Anything unexpected is skipped.
 */
const PAID_ON_SPOT_SECTIONS: Array<{ key: string; label: string }> = [
  { key: "deposit", label: "Deposit" },
  { key: "parking", label: "Parking" },
  { key: "meal", label: "Meals" },
  { key: "children_meal", label: "Children's meals" },
  { key: "pets", label: "Pets" },
  { key: "extra_bed", label: "Extra bed" },
  { key: "cot", label: "Cot / crib" },
  { key: "shuttle", label: "Shuttle" },
];

function formatPriceUnit(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().toLowerCase();
  if (!cleaned || cleaned === "unspecified") return null;
  return cleaned.replace(/_/g, " ");
}

function formatInclusion(value: unknown): string | null {
  if (typeof value !== "string") return null;
  switch (value.trim().toLowerCase()) {
    case "included":
      return "Included";
    case "not_included":
      return "Paid on site";
    case "free":
      return "Free";
    default:
      return null;
  }
}

function positivePrice(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

/**
 * Parse real "paid on the spot" charges from metapolicy_struct. Returns only
 * sections that carry a positive priced entry, formatted as readable text.
 * Never dumps raw JSON; skips empty/unspecified/free-of-charge entries.
 */
export function extractPaidOnSpot(policies: unknown): HotelPaidOnSpotItem[] {
  if (!policies || typeof policies !== "object" || Array.isArray(policies)) return [];
  const metapolicy = (policies as Record<string, unknown>).metapolicy_struct;
  if (!metapolicy || typeof metapolicy !== "object" || Array.isArray(metapolicy)) return [];
  const struct = metapolicy as Record<string, unknown>;

  const items: HotelPaidOnSpotItem[] = [];

  for (const { key, label } of PAID_ON_SPOT_SECTIONS) {
    const entries = struct[key];
    if (!Array.isArray(entries)) continue;

    for (const entry of entries) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const rec = entry as Record<string, unknown>;

      const price = positivePrice(rec.price);
      if (price === null) continue; // only real, chargeable amounts

      const currency = typeof rec.currency === "string" ? rec.currency.trim().toUpperCase() : "";
      const unit = formatPriceUnit(rec.price_unit);
      const inclusion = formatInclusion(rec.inclusion);

      const amount = [price.toFixed(2), currency, unit].filter(Boolean).join(" ");
      items.push({ label, amount, note: inclusion });
      break; // one line per section is enough for a summary
    }
  }

  return items;
}
