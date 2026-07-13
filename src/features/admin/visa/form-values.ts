import type {
  VisaDocumentGroup,
  VisaFaq,
  VisaProcessStep,
  VisaTypeOption,
} from "@/data/visa";
import type { VisaCategory, VisaDbRow } from "@/server/public/visa-normalize";
import {
  parseDocuments,
  parseFaqs,
  parseProcessSteps,
  parseVisaTypes,
  parseWhyChoose,
} from "@/server/public/visa-normalize";
import {
  defaultApplyFormConfig,
  defaultCallFormConfig,
  defaultContactCardsConfig,
  parseApplyFormConfig,
  parseCallFormConfig,
  parseContactCardsConfig,
  type VisaApplyFormConfig,
  type VisaCallFormConfig,
  type VisaContactCardsConfig,
} from "@/lib/visa-forms";

/** Structured admin form values (no raw JSON — every list is a real array). */
export type VisaFormValues = {
  category: VisaCategory;
  slug: string;
  name: string;
  countryCode: string;
  title: string;
  subtitle: string;
  startingPrice: string;
  currency: string;
  processingTime: string;
  stayPeriod: string;
  validity: string;
  entryType: string;
  isFeatured: boolean;
  isPublished: boolean;
  sortOrder: string;
  cardImageUrl: string;
  cardImageAlt: string;
  heroImageUrl: string;
  heroImageAlt: string;
  processImageUrl: string;
  processImageAlt: string;
  sampleVisaImageUrl: string;
  sampleVisaImageAlt: string;
  seoTitle: string;
  seoDescription: string;
  visaTypes: VisaTypeOption[];
  documents: VisaDocumentGroup[];
  processSteps: VisaProcessStep[];
  whyChoose: string[];
  faqs: VisaFaq[];
  applyForm: VisaApplyFormConfig;
  callForm: VisaCallFormConfig;
  contactCards: VisaContactCardsConfig;
};

export function emptyVisaFormValues(category: VisaCategory): VisaFormValues {
  return {
    category,
    slug: "",
    name: "",
    countryCode: "",
    title: "",
    subtitle: "",
    startingPrice: "",
    currency: "INR",
    processingTime: "",
    stayPeriod: "",
    validity: "",
    entryType: "",
    isFeatured: false,
    isPublished: true,
    sortOrder: "0",
    cardImageUrl: "",
    cardImageAlt: "",
    heroImageUrl: "",
    heroImageAlt: "",
    processImageUrl: "",
    processImageAlt: "",
    sampleVisaImageUrl: "",
    sampleVisaImageAlt: "",
    seoTitle: "",
    seoDescription: "",
    visaTypes: [],
    documents: [],
    processSteps: [],
    whyChoose: [],
    faqs: [],
    applyForm: defaultApplyFormConfig(),
    callForm: defaultCallFormConfig(),
    contactCards: defaultContactCardsConfig(),
  };
}

function str(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

/** Map a DB row into editable form values (edit mode). */
export function visaRowToFormValues(row: VisaDbRow): VisaFormValues {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    category: row.category === "global" ? "global" : "gulf",
    slug: str(row.slug),
    name: str(row.name),
    countryCode: str(meta.countryCode),
    title: str(row.title),
    subtitle: str(row.subtitle),
    startingPrice: str(row.starting_price),
    currency: str(row.currency) || "INR",
    processingTime: str(row.processing_time),
    stayPeriod: str(row.stay_period),
    validity: str(row.validity),
    entryType: str(row.entry_type),
    isFeatured: row.is_featured === true,
    isPublished: row.is_published !== false,
    sortOrder: str(row.sort_order) || "0",
    cardImageUrl: str(row.card_image_url),
    cardImageAlt: str(row.card_image_alt),
    heroImageUrl: str(row.hero_image_url),
    heroImageAlt: str(row.hero_image_alt),
    processImageUrl: str(row.process_image_url),
    processImageAlt: str(row.process_image_alt),
    sampleVisaImageUrl: str(row.sample_visa_image_url),
    sampleVisaImageAlt: str(row.sample_visa_image_alt),
    seoTitle: str(row.seo_title),
    seoDescription: str(row.seo_description),
    visaTypes: parseVisaTypes(row.visa_types),
    documents: parseDocuments(row.documents),
    processSteps: parseProcessSteps(row.process_steps),
    whyChoose: parseWhyChoose(row.why_choose),
    faqs: parseFaqs(row.faqs),
    applyForm: parseApplyFormConfig(meta.applyForm) ?? defaultApplyFormConfig(),
    callForm: parseCallFormConfig(meta.callForm) ?? defaultCallFormConfig(),
    contactCards: parseContactCardsConfig(meta.contactCards) ?? defaultContactCardsConfig(),
  };
}
