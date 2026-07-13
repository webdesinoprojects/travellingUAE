// Seed the Visa CMS (visa_destinations) from the static src/data/visa.ts.
//
// Idempotent + non-destructive: upserts on (category, slug); never deletes rows.
// Run MANUALLY after applying the visa_cms migration:
//   node --env-file=.env scripts/seed-visa-cms-from-static.mjs
//
// Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Reads the static content via Node's TypeScript type-stripping (Node >= 22.6).

import { createClient } from "@supabase/supabase-js";

import { globalVisaPage, gulfVisaPage } from "../src/data/visa.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Extract a numeric starting price + currency from a label like "INR 4000 onwards". */
function parsePrice(label) {
  if (typeof label !== "string") return { price: null, currency: "INR" };
  const currencyMatch = label.match(/[A-Z]{3}/);
  const numberMatch = label.replace(/[, ]/g, "").match(/(\d+(?:\.\d+)?)/);
  return {
    price: numberMatch ? Number(numberMatch[1]) : null,
    currency: currencyMatch ? currencyMatch[0] : "INR",
  };
}

function toRow(category, d) {
  const { price, currency } = parsePrice(d.priceLabel);
  return {
    category,
    slug: d.slug,
    name: d.name,
    title: d.detailTitle ?? null,
    subtitle: d.approvalText ?? null,
    card_image_url: d.image ?? null,
    card_image_alt: d.alt ?? null,
    hero_image_url: d.image ?? null,
    hero_image_alt: d.alt ?? null,
    starting_price: price,
    currency,
    processing_time: d.processingLabel ?? d.processingTime ?? null,
    stay_period: d.stayLabel ?? null,
    validity: null,
    entry_type: null,
    is_featured: false,
    is_published: true,
    sort_order: 0,
    visa_types: d.visaTypes ?? [],
    documents: d.documents ?? [],
    process_steps: d.processSteps ?? [],
    why_choose: d.whyChooseUs ?? [],
    faqs: d.faqs ?? [],
    process_image_url: d.processImage ?? null,
    process_image_alt: d.processImageAlt ?? null,
    sample_visa_image_url: d.sampleVisaImage ?? null,
    sample_visa_image_alt: d.sampleVisaImageAlt ?? null,
    seo_title: `${d.name} Visa | Fly Time`,
    seo_description: Array.isArray(d.overview) ? d.overview[0] ?? null : null,
    metadata: {
      countryCode: d.countryCode ?? "",
      agentBadge: d.agentBadge ?? "",
      overview: d.overview ?? [],
      embassyNote: d.embassyNote ?? "",
      visitUsNote: d.visitUsNote ?? "",
    },
  };
}

const rows = [
  ...gulfVisaPage.destinations.map((d) => toRow("gulf", d)),
  ...globalVisaPage.destinations.map((d) => toRow("global", d)),
];

// De-dupe by (category, slug) in case the static global page spreads gulf items.
const seen = new Set();
const unique = [];
for (const row of rows) {
  const key2 = `${row.category}:${row.slug}`;
  if (seen.has(key2)) continue;
  seen.add(key2);
  unique.push(row);
}

const result = await supabase
  .from("visa_destinations")
  .upsert(unique, { onConflict: "category,slug" })
  .select("id");

if (result.error) {
  throw result.error;
}

console.info(
  `[visa-cms-seed] upserted=${result.data?.length ?? unique.length} rows (gulf + global). No rows deleted.`,
);
