import "server-only";

import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/server/supabase/client";
import {
  isSafeVisaMediaUrl,
  isVisaCategory,
  type VisaCategory,
  type VisaDbRow,
} from "@/server/public/visa-normalize";
import {
  parseApplyFormConfig,
  parseCallFormConfig,
  parseContactCardsConfig,
} from "@/lib/visa-forms";

/**
 * Admin data access for the Visa CMS (visa_destinations).
 *
 * Service-role only. Validates category/slug, coerces JSON array fields, and
 * rejects unsafe image hosts (same allowlist as the public view). No hard
 * delete: unpublish is the safe archive path.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ADMIN_COLUMNS =
  "id,category,slug,name,title,subtitle,hero_image_url,hero_image_alt,card_image_url,card_image_alt,starting_price,currency,processing_time,stay_period,validity,entry_type,is_featured,is_published,sort_order,visa_types,documents,process_steps,why_choose,faqs,process_image_url,process_image_alt,sample_visa_image_url,sample_visa_image_alt,seo_title,seo_description,metadata,updated_at";

const LIST_COLUMNS =
  "id,category,slug,name,starting_price,currency,is_featured,is_published,sort_order,updated_at";

export type VisaAdminListItem = {
  id: string;
  category: VisaCategory;
  slug: string;
  name: string;
  startingPrice: number | null;
  currency: string;
  isFeatured: boolean;
  isPublished: boolean;
  sortOrder: number;
  updatedAt: string;
};

export class VisaCmsError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "VisaCmsError";
    this.status = status;
  }
}

export async function listVisaDestinations(category: VisaCategory): Promise<VisaAdminListItem[]> {
  if (!hasSupabaseAdminEnv()) return [];
  const { data, error } = await getSupabaseAdminClient()
    .from("visa_destinations")
    .select(LIST_COLUMNS)
    .eq("category", category)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map(toListItem);
}

export async function getVisaDestination(id: string): Promise<VisaDbRow | null> {
  if (!UUID_RE.test(id) || !hasSupabaseAdminEnv()) return null;
  const { data, error } = await getSupabaseAdminClient()
    .from("visa_destinations")
    .select(ADMIN_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as VisaDbRow | null) ?? null;
}

export type VisaDestinationInput = {
  category: unknown;
  slug: unknown;
  name: unknown;
  title?: unknown;
  subtitle?: unknown;
  countryCode?: unknown;
  heroImageUrl?: unknown;
  heroImageAlt?: unknown;
  cardImageUrl?: unknown;
  cardImageAlt?: unknown;
  startingPrice?: unknown;
  currency?: unknown;
  processingTime?: unknown;
  stayPeriod?: unknown;
  validity?: unknown;
  entryType?: unknown;
  isFeatured?: unknown;
  isPublished?: unknown;
  sortOrder?: unknown;
  visaTypes?: unknown;
  documents?: unknown;
  processSteps?: unknown;
  whyChoose?: unknown;
  faqs?: unknown;
  processImageUrl?: unknown;
  processImageAlt?: unknown;
  sampleVisaImageUrl?: unknown;
  sampleVisaImageAlt?: unknown;
  seoTitle?: unknown;
  seoDescription?: unknown;
  applyForm?: unknown;
  callForm?: unknown;
  contactCards?: unknown;
};

export async function createVisaDestination(input: VisaDestinationInput): Promise<string> {
  const row = buildRow(input, { requireCore: true });
  const { data, error } = await getSupabaseAdminClient()
    .from("visa_destinations")
    .insert(row)
    .select("id")
    .single();
  if (error) {
    throw mapDbError(error);
  }
  return (data as { id: string }).id;
}

export async function updateVisaDestination(id: string, input: VisaDestinationInput): Promise<void> {
  if (!UUID_RE.test(id)) throw new VisaCmsError(400, "Invalid destination id.");
  const row = buildRow(input, { requireCore: true });
  const { data, error } = await getSupabaseAdminClient()
    .from("visa_destinations")
    .update(row)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw new VisaCmsError(404, "Destination not found.");
}

/** Publish/unpublish (the safe "archive" — no hard delete). */
export async function setVisaDestinationPublished(id: string, isPublished: boolean): Promise<void> {
  if (!UUID_RE.test(id)) throw new VisaCmsError(400, "Invalid destination id.");
  const { data, error } = await getSupabaseAdminClient()
    .from("visa_destinations")
    .update({ is_published: isPublished })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new VisaCmsError(404, "Destination not found.");
}

// ---- Validation / coercion -------------------------------------------------

function buildRow(
  input: VisaDestinationInput,
  { requireCore }: { requireCore: boolean },
): Record<string, unknown> {
  const category = input.category;
  if (!isVisaCategory(category)) {
    throw new VisaCmsError(400, "Category must be 'global' or 'gulf'.");
  }
  const slug = normalizeSlug(input.slug);
  if (requireCore && !slug) {
    throw new VisaCmsError(400, "Slug is required (lowercase letters, numbers, hyphens).");
  }
  const name = cleanText(input.name, 120);
  if (requireCore && !name) {
    throw new VisaCmsError(400, "Name is required.");
  }

  const metadata: Record<string, unknown> = {};
  const countryCode = cleanText(input.countryCode, 6);
  if (countryCode) metadata.countryCode = countryCode.toUpperCase();

  // CMS form configs: parsed/sanitized into a safe shape (bad input -> dropped).
  const applyForm = parseApplyFormConfig(input.applyForm);
  if (applyForm) metadata.applyForm = applyForm;
  const callForm = parseCallFormConfig(input.callForm);
  if (callForm) metadata.callForm = callForm;
  const contactCards = parseContactCardsConfig(input.contactCards);
  if (contactCards) metadata.contactCards = contactCards;

  return {
    category,
    slug,
    name,
    title: cleanText(input.title, 200),
    subtitle: cleanText(input.subtitle, 300),
    hero_image_url: cleanMediaUrl(input.heroImageUrl),
    hero_image_alt: cleanText(input.heroImageAlt, 200),
    card_image_url: cleanMediaUrl(input.cardImageUrl),
    card_image_alt: cleanText(input.cardImageAlt, 200),
    starting_price: cleanNumber(input.startingPrice),
    currency: cleanText(input.currency, 8)?.toUpperCase() ?? "INR",
    processing_time: cleanText(input.processingTime, 120),
    stay_period: cleanText(input.stayPeriod, 120),
    validity: cleanText(input.validity, 120),
    entry_type: cleanText(input.entryType, 60),
    is_featured: input.isFeatured === true,
    is_published: input.isPublished !== false,
    sort_order: cleanNumber(input.sortOrder) ?? 0,
    visa_types: coerceJsonArray(input.visaTypes, "Visa types"),
    documents: coerceJsonArray(input.documents, "Documents"),
    process_steps: coerceJsonArray(input.processSteps, "Process steps"),
    why_choose: coerceJsonArray(input.whyChoose, "Why choose"),
    faqs: coerceJsonArray(input.faqs, "FAQs"),
    process_image_url: cleanMediaUrl(input.processImageUrl),
    process_image_alt: cleanText(input.processImageAlt, 200),
    sample_visa_image_url: cleanMediaUrl(input.sampleVisaImageUrl),
    sample_visa_image_alt: cleanText(input.sampleVisaImageAlt, 200),
    seo_title: cleanText(input.seoTitle, 200),
    seo_description: cleanText(input.seoDescription, 320),
    metadata,
  };
}

function normalizeSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const slug = value.trim().toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null;
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed || null;
}

function cleanNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function cleanMediaUrl(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (!isSafeVisaMediaUrl(value)) {
    throw new VisaCmsError(
      400,
      "Image URLs must be a local path or hosted on ik.imagekit.io, images.unsplash.com, or res.cloudinary.com.",
    );
  }
  return (value as string).trim();
}

/** Accepts a JSON string or an already-parsed array; must resolve to an array. */
function coerceJsonArray(value: unknown, label: string): unknown[] {
  if (value == null || value === "") return [];
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new VisaCmsError(400, `${label} must be valid JSON.`);
    }
  }
  if (!Array.isArray(parsed)) {
    throw new VisaCmsError(400, `${label} must be a JSON array.`);
  }
  return parsed;
}

function toListItem(row: Record<string, unknown>): VisaAdminListItem {
  return {
    id: String(row.id),
    category: (row.category === "global" ? "global" : "gulf") as VisaCategory,
    slug: String(row.slug ?? ""),
    name: String(row.name ?? ""),
    startingPrice: cleanNumber(row.starting_price),
    currency: typeof row.currency === "string" ? row.currency : "INR",
    isFeatured: row.is_featured === true,
    isPublished: row.is_published === true,
    sortOrder: cleanNumber(row.sort_order) ?? 0,
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapDbError(error: { code?: string; message?: string }): Error {
  if (error?.code === "23505") {
    return new VisaCmsError(409, "A destination with this slug already exists in this category.");
  }
  return error instanceof Error ? error : new Error(error?.message ?? "Database error");
}
