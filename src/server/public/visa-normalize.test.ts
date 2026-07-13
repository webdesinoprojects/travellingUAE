import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isSafeVisaMediaUrl,
  isVisaCategory,
  normalizeVisaDbRow,
  pageSlugToVisaCategory,
  visaRowSeo,
  type VisaDbRow,
} from "./visa-normalize.ts";

function row(overrides: Partial<VisaDbRow>): VisaDbRow {
  return {
    id: "id-1",
    category: "gulf",
    slug: "dubai",
    name: "Dubai",
    title: null,
    subtitle: null,
    hero_image_url: null,
    hero_image_alt: null,
    card_image_url: null,
    card_image_alt: null,
    starting_price: null,
    currency: "INR",
    processing_time: null,
    stay_period: null,
    validity: null,
    entry_type: null,
    is_featured: false,
    is_published: true,
    sort_order: 0,
    visa_types: [],
    documents: [],
    process_steps: [],
    why_choose: [],
    faqs: [],
    process_image_url: null,
    process_image_alt: null,
    sample_visa_image_url: null,
    sample_visa_image_alt: null,
    seo_title: null,
    seo_description: null,
    metadata: {},
    ...overrides,
  };
}

test("category helpers", () => {
  assert.equal(pageSlugToVisaCategory("global-visa"), "global");
  assert.equal(pageSlugToVisaCategory("gulf-visa"), "gulf");
  assert.equal(pageSlugToVisaCategory("nope"), null);
  assert.equal(isVisaCategory("global"), true);
  assert.equal(isVisaCategory("x"), false);
});

test("isSafeVisaMediaUrl: local + allowed hosts only", () => {
  assert.equal(isSafeVisaMediaUrl("/local/img.png"), true);
  assert.equal(isSafeVisaMediaUrl("https://ik.imagekit.io/x/a.jpg"), true);
  assert.equal(isSafeVisaMediaUrl("https://images.unsplash.com/a.jpg"), true);
  assert.equal(isSafeVisaMediaUrl("https://res.cloudinary.com/a.jpg"), true);
  assert.equal(isSafeVisaMediaUrl("https://evil.example.com/a.jpg"), false);
  assert.equal(isSafeVisaMediaUrl("http://ik.imagekit.io/a.jpg"), false); // not https
  assert.equal(isSafeVisaMediaUrl(""), false);
  assert.equal(isSafeVisaMediaUrl(42), false);
});

test("normalizeVisaDbRow: maps columns + price label + defaults", () => {
  const d = normalizeVisaDbRow(
    row({
      name: "Dubai",
      title: "Dubai Visa Online for Indians",
      subtitle: "99.2% visas approved before time",
      card_image_url: "https://images.unsplash.com/dubai.jpg",
      card_image_alt: "Dubai skyline",
      starting_price: 7800,
      currency: "INR",
      processing_time: "2-3 Business Days",
      stay_period: "30 Days",
      metadata: { countryCode: "AE" },
    }),
  );
  assert.equal(d.slug, "dubai");
  assert.equal(d.name, "Dubai");
  assert.equal(d.countryCode, "AE");
  assert.equal(d.detailTitle, "Dubai Visa Online for Indians");
  assert.equal(d.approvalText, "99.2% visas approved before time");
  assert.equal(d.image, "https://images.unsplash.com/dubai.jpg");
  assert.equal(d.priceLabel, "INR 7,800 onwards");
  assert.equal(d.startingFrom, "INR 7,800");
  assert.equal(d.stayLabel, "30 Days");
  // Narrative defaults fill in.
  assert.ok(d.overview.length >= 1);
  assert.ok(d.whyChooseUs.length >= 1);
  assert.equal(d.agentBadge.includes("Dubai"), true);
});

test("normalizeVisaDbRow: no price -> On request; unsafe image dropped to default", () => {
  const d = normalizeVisaDbRow(
    row({ starting_price: null, card_image_url: "https://evil.com/x.jpg" }),
  );
  assert.equal(d.priceLabel, "On request");
  assert.equal(d.startingFrom, "On request");
  // Unsafe host -> falls back to default safe image (not the evil URL).
  assert.equal(d.image.includes("evil.com"), false);
});

test("normalizeVisaDbRow: parses JSON arrays and drops malformed entries", () => {
  const d = normalizeVisaDbRow(
    row({
      visa_types: [
        { title: "Tourist", processingTime: "5d", stayPeriod: "30d", validity: "58d", entry: "Single", fee: "INR 7,899", popular: true },
        { processingTime: "no title -> dropped" },
        "garbage",
      ],
      documents: [{ title: "Docs", items: ["Passport", 42, "Photo"] }, { title: "empty", items: [] }],
      process_steps: [{ title: "Step", description: "Do it" }, { title: "no desc" }],
      faqs: [{ question: "Q?", answer: "A." }, { question: "no answer" }],
      why_choose: ["Fast", 5, "  Reliable  "],
    }),
  );
  assert.equal(d.visaTypes.length, 1);
  assert.equal(d.visaTypes[0].popular, true);
  assert.deepEqual(d.documents, [{ title: "Docs", items: ["Passport", "Photo"] }]);
  assert.equal(d.processSteps.length, 1);
  assert.equal(d.faqs.length, 1);
  assert.deepEqual(d.whyChooseUs, ["Fast", "Reliable"]);
});

test("normalizeVisaDbRow: totally malformed JSON -> empty arrays, still renders", () => {
  const d = normalizeVisaDbRow(row({ visa_types: "x", documents: null, faqs: 5, process_steps: {} }));
  assert.deepEqual(d.visaTypes, []);
  assert.deepEqual(d.documents, []);
  assert.deepEqual(d.faqs, []);
  assert.deepEqual(d.processSteps, []);
});

test("visaRowSeo: row values or defaults", () => {
  assert.deepEqual(visaRowSeo(row({ seo_title: "T", seo_description: "D" })), {
    title: "T",
    description: "D",
  });
  const seo = visaRowSeo(row({ name: "Oman" }));
  assert.equal(seo.title, "Oman Visa | Fly Time");
});
