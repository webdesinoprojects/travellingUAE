/**
 * Pure normalizer: maps DB `visa_destinations` rows into the exact shape the
 * public visa views consume (`VisaDestination` / `VisaPageContent` from
 * src/data/visa.ts). No IO, no server-only — node --test friendly.
 *
 * Malformed JSONB fields degrade to safe defaults (never throw), so a partially
 * filled admin row still renders. Narrative fields that have no dedicated column
 * (overview / agentBadge / visitUsNote / embassyNote / countryCode) are read
 * from `metadata` when present, otherwise sensible defaults are generated — the
 * static file remains the richer source and the fallback path uses it directly.
 */

import type {
  VisaDestination,
  VisaDocumentGroup,
  VisaFaq,
  VisaPageContent,
  VisaProcessStep,
  VisaTypeOption,
} from "@/data/visa";
import {
  parseApplyFormConfig,
  parseCallFormConfig,
  parseContactCardsConfig,
} from "../../lib/visa-forms.ts";

export type VisaCategory = "global" | "gulf";

/** Row shape as selected from public.visa_destinations. */
export type VisaDbRow = {
  id: string;
  category: string;
  slug: string;
  name: string;
  title: string | null;
  subtitle: string | null;
  hero_image_url: string | null;
  hero_image_alt: string | null;
  card_image_url: string | null;
  card_image_alt: string | null;
  starting_price: number | string | null;
  currency: string | null;
  processing_time: string | null;
  stay_period: string | null;
  validity: string | null;
  entry_type: string | null;
  is_featured: boolean | null;
  is_published: boolean | null;
  sort_order: number | null;
  visa_types: unknown;
  documents: unknown;
  process_steps: unknown;
  why_choose: unknown;
  faqs: unknown;
  process_image_url: string | null;
  process_image_alt: string | null;
  sample_visa_image_url: string | null;
  sample_visa_image_alt: string | null;
  seo_title: string | null;
  seo_description: string | null;
  metadata: Record<string, unknown> | null;
};

/** Category -> public page slug. */
export const VISA_CATEGORY_TO_PAGE_SLUG: Record<VisaCategory, VisaPageContent["slug"]> = {
  global: "global-visa",
  gulf: "gulf-visa",
};

/** Page slug -> category. */
export function pageSlugToVisaCategory(pageSlug: string): VisaCategory | null {
  if (pageSlug === "global-visa") return "global";
  if (pageSlug === "gulf-visa") return "gulf";
  return null;
}

export function isVisaCategory(value: unknown): value is VisaCategory {
  return value === "global" || value === "gulf";
}

/** Allowed image hosts (matches VisaDetailView + next.config remotePatterns). */
const SAFE_VISA_MEDIA_HOSTS = new Set([
  "ik.imagekit.io",
  "images.unsplash.com",
  "res.cloudinary.com",
]);

/** True for a safe image URL: a local "/..." path or an allowed https host. */
export function isSafeVisaMediaUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/")) return true;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" && SAFE_VISA_MEDIA_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

const DEFAULT_VISA_IMAGE =
  "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1000&q=82";

function text(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  // Strings only (list fields never carry numbers); trimmed, empties dropped.
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function safeMedia(value: unknown): string | undefined {
  return isSafeVisaMediaUrl(value) ? (value as string).trim() : undefined;
}

// ---- JSONB field parsers (defensive: bad shapes -> []) ---------------------

/** "Why choose" is a list of single-line strings. */
export function parseWhyChoose(value: unknown): string[] {
  return stringArray(value);
}

export function parseVisaTypes(value: unknown): VisaTypeOption[] {
  if (!Array.isArray(value)) return [];
  const out: VisaTypeOption[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const r = entry as Record<string, unknown>;
    const title = text(r.title);
    if (!title) continue;
    out.push({
      title,
      processingTime: text(r.processingTime) ?? "",
      stayPeriod: text(r.stayPeriod) ?? "",
      validity: text(r.validity) ?? "",
      entry: text(r.entry) ?? "",
      fee: text(r.fee) ?? "",
      ...(r.popular === true ? { popular: true } : {}),
    });
  }
  return out;
}

export function parseDocuments(value: unknown): VisaDocumentGroup[] {
  if (!Array.isArray(value)) return [];
  const out: VisaDocumentGroup[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const r = entry as Record<string, unknown>;
    const title = text(r.title);
    const items = stringArray(r.items);
    if (!title || items.length === 0) continue;
    out.push({ title, items });
  }
  return out;
}

export function parseProcessSteps(value: unknown): VisaProcessStep[] {
  if (!Array.isArray(value)) return [];
  const out: VisaProcessStep[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const r = entry as Record<string, unknown>;
    const title = text(r.title);
    const description = text(r.description);
    if (!title || !description) continue;
    out.push({ title, description });
  }
  return out;
}

export function parseFaqs(value: unknown): VisaFaq[] {
  if (!Array.isArray(value)) return [];
  const out: VisaFaq[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const r = entry as Record<string, unknown>;
    const question = text(r.question);
    const answer = text(r.answer);
    if (!question || !answer) continue;
    out.push({ question, answer });
  }
  return out;
}

// ---- Narrative defaults (only when neither column nor metadata provides) ----

function defaultOverview(name: string, processing: string, priceLabel: string): string[] {
  return [
    `Fly Time helps prepare ${name} visa applications with document checks, guidance, and clear follow-up from the visa desk.`,
    `Most travellers choose this service for predictable processing (${processing}) and transparent pricing from ${priceLabel}.`,
    `Final eligibility, documents, and visa validity depend on nationality, residence status, travel dates, and the authority handling the application.`,
  ];
}

function buildPriceLabels(row: VisaDbRow): { priceLabel: string; startingFrom: string } {
  const currency = text(row.currency) ?? "INR";
  const price = row.starting_price;
  const numeric =
    typeof price === "number" ? price : typeof price === "string" ? Number(price) : NaN;
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return { priceLabel: "On request", startingFrom: "On request" };
  }
  const formatted = numeric.toLocaleString("en-IN");
  return {
    priceLabel: `${currency} ${formatted} onwards`,
    startingFrom: `${currency} ${formatted}`,
  };
}

/** Map one DB row into the public `VisaDestination` shape. */
export function normalizeVisaDbRow(row: VisaDbRow): VisaDestination {
  const meta = row.metadata ?? {};
  const name = text(row.name) ?? "Visa";
  const processingLabel = text(row.processing_time) ?? "2-3 Business Days";
  const stayLabel = text(row.stay_period) ?? "As approved";
  const { priceLabel, startingFrom } = buildPriceLabels(row);

  const image = safeMedia(row.card_image_url) ?? safeMedia(row.hero_image_url) ?? DEFAULT_VISA_IMAGE;
  const detailTitle = text(row.title) ?? `${name} Visa Online for Travellers`;
  const approvalText =
    text(row.subtitle) ?? `99.2% ${name} visas prepared before committed timelines`;

  const overview = stringArray(meta.overview);
  const whyChoose = stringArray(row.why_choose);

  return {
    slug: text(row.slug) ?? "",
    name,
    countryCode: text(meta.countryCode) ?? "",
    stayLabel,
    processingLabel,
    priceLabel,
    image,
    alt: text(row.card_image_alt) ?? text(row.hero_image_alt) ?? `${name} visa`,
    processImage: safeMedia(row.process_image_url),
    processImageAlt: text(row.process_image_alt) ?? undefined,
    sampleVisaImage: safeMedia(row.sample_visa_image_url),
    sampleVisaImageAlt: text(row.sample_visa_image_alt) ?? undefined,
    detailTitle,
    approvalText,
    processingTime: processingLabel,
    startingFrom,
    agentBadge:
      text(meta.agentBadge) ?? `Authorised visa assistance desk for ${name} travel`,
    overview: overview.length > 0 ? overview : defaultOverview(name, processingLabel, priceLabel),
    visaTypes: parseVisaTypes(row.visa_types),
    documents: parseDocuments(row.documents),
    processSteps: parseProcessSteps(row.process_steps),
    whyChooseUs:
      whyChoose.length > 0
        ? whyChoose
        : [
            `Destination-specific ${name} visa checklist before submission`,
            "Clear service pricing and processing expectations",
            "Human follow-up from the visa desk instead of unattended forms",
          ],
    faqs: parseFaqs(row.faqs),
    embassyNote:
      text(meta.embassyNote) ??
      `${name} embassy and consulate guidance will be confirmed by the Fly Time visa desk based on nationality, residence status, and chosen visa type.`,
    visitUsNote:
      text(meta.visitUsNote) ??
      "Visit the Fly Time office or submit your details online. The visa team will confirm the document checklist before collecting any application material.",
    applyForm: parseApplyFormConfig(meta.applyForm),
    callForm: parseCallFormConfig(meta.callForm),
    contactCards: parseContactCardsConfig(meta.contactCards),
  };
}

/** SEO fields for the detail page metadata (from the row or sensible defaults). */
export function visaRowSeo(row: VisaDbRow): { title: string; description: string } {
  const name = text(row.name) ?? "Visa";
  return {
    title: text(row.seo_title) ?? `${name} Visa | Fly Time`,
    description:
      text(row.seo_description) ??
      `Apply for a ${name} visa with document checks and guidance from the Fly Time visa desk.`,
  };
}

/**
 * Build a full `VisaPageContent` from DB rows for a category. Page chrome (hero,
 * breadcrumb, titles) is taken from the static fallback page; only the
 * destinations list is DB-driven. Rows are assumed pre-filtered to published and
 * pre-ordered by the caller.
 */
export function buildVisaPageFromDbRows(
  rows: VisaDbRow[],
  fallbackPage: VisaPageContent,
): VisaPageContent {
  return {
    ...fallbackPage,
    destinations: rows.map(normalizeVisaDbRow),
  };
}
