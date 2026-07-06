import { test } from "node:test";
import assert from "node:assert/strict";

import {
  extractPlanFeatures,
  sanitizeAirhubDescription,
} from "./plan-display.ts";
import type { AirhubPublicPlan } from "./contracts.ts";

// Real additionalInfo payloads captured from the live/cached Airhub response
// (AZ, IN, UK, AU) - not invented sample text.
const AZ_HTML =
  '<p>Package Details:<br>&nbsp;</p><ul><li>4GB High-speed data</li><li>Operates on Bakcell networks</li><li>Hotspot supports</li><li>Validity starts from first network connection in destination</li><li>Top up available</li><li>APN: wap.tim.it</li><li>24/7 customer support</li></ul><p>Supported Countries:</p><ul><li>Azerbaijan</li></ul>';
const IN_HTML =
  '<p><strong>Package Details:</strong></p><ul><li>4G Data-only E-SIM.</li><li>Operates on the Airtel, Vodafone and Idea India in India .</li><li>Internet connectivity required for eSIM activation.</li></ul><p><strong>Supported destination:</strong></p><ul><li>India&nbsp;</li></ul><p><strong>APN:</strong></p><ul><li>Plus</li></ul>';
const UK_NO_HEADING_HTML =
  "<ul><li>Unlimited Calls and Text.</li><li>50GB (5G) High speed data</li><li>Operates on EE network</li><li>Validity starts from the date of purchase</li><li>Hotspot supports</li></ul>";

function buildPlan(overrides: Partial<AirhubPublicPlan> = {}): AirhubPublicPlan {
  return {
    planCode: "1034453",
    planName: "Azerbaijan 4GB 30days",
    planType: "Local",
    countryName: "Azerbaijan",
    countryCode: null,
    currency: "USD",
    price: 12,
    dataUnit: null,
    validity: null,
    validityType: "Days",
    capacity: "4",
    connectivity: "Local",
    networkOperator: "Bakcell",
    countriesCovered: null,
    travelDateRequirement: "No Need",
    additionalInfo: AZ_HTML,
    subscription: true,
    subscriptionPeriod: null,
    phoneNumber: false,
    ...overrides,
  };
}

test("sanitizeAirhubDescription cleans real AZ HTML into safe sections/bullets, no raw tags", () => {
  const result = sanitizeAirhubDescription(AZ_HTML);

  // No raw HTML must survive anywhere in the output.
  const serialized = JSON.stringify(result);
  for (const tag of ["<p>", "<ul>", "<li>", "<br", "&nbsp;", "<strong>"]) {
    assert.equal(serialized.includes(tag), false, `must not contain raw ${tag}`);
  }

  assert.deepEqual(
    result.sections.map((s) => s.heading),
    ["Package Details", "Supported Countries"],
  );
  assert.ok(result.bullets.includes("4GB High-speed data"));
  assert.ok(result.bullets.includes("APN: wap.tim.it"));
  assert.ok(result.bullets.includes("Azerbaijan"));
  assert.ok(result.plainText.length > 0);
});

test("sanitizeAirhubDescription handles bold headings (India) safely", () => {
  const result = sanitizeAirhubDescription(IN_HTML);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("<strong>"), false);
  assert.equal(serialized.includes("&nbsp;"), false);

  assert.deepEqual(
    result.sections.map((s) => s.heading),
    ["Package Details", "Supported destination", "APN"],
  );
  // &nbsp; inside <li>India&nbsp;</li> is decoded/trimmed, not shown raw.
  assert.equal(result.sections[1].items[0], "India");
});

test("sanitizeAirhubDescription handles a heading-less list (UK plan)", () => {
  const result = sanitizeAirhubDescription(UK_NO_HEADING_HTML);
  assert.deepEqual(result.sections, [
    {
      heading: null,
      items: [
        "Unlimited Calls and Text.",
        "50GB (5G) High speed data",
        "Operates on EE network",
        "Validity starts from the date of purchase",
        "Hotspot supports",
      ],
    },
  ]);
});

test("sanitizeAirhubDescription never throws on missing/malformed input", () => {
  assert.deepEqual(sanitizeAirhubDescription(null), { plainText: "", sections: [], bullets: [] });
  assert.deepEqual(sanitizeAirhubDescription(""), { plainText: "", sections: [], bullets: [] });
  assert.deepEqual(sanitizeAirhubDescription("   "), { plainText: "", sections: [], bullets: [] });
  // Unclosed tag - must not throw, must still strip what it can.
  const result = sanitizeAirhubDescription("<p>Unclosed paragraph");
  assert.equal(result.plainText, "Unclosed paragraph");
});

test("sanitizeAirhubDescription falls back to plain text when there is no list", () => {
  const result = sanitizeAirhubDescription("<p>Just a note, no bullets.</p>");
  assert.equal(result.plainText, "Just a note, no bullets.");
  assert.deepEqual(result.sections, []);
  assert.deepEqual(result.bullets, []);
});

test("extractPlanFeatures only reports fields Airhub actually returned", () => {
  const features = extractPlanFeatures(buildPlan());

  assert.equal(features.coverage, "Local");
  assert.equal(features.operator, "Bakcell");
  assert.equal(features.dataLabel, "4 GB"); // capacity=4, unit confirmed from planName "4GB"
  assert.equal(features.validityLabel, "30 Days"); // validityType=Days, count confirmed from planName "30days"
  assert.equal(features.includesCalls, false); // phoneNumber=false is a REAL value, not hidden
  assert.equal(features.renewalAvailable, true);
  assert.equal(features.travelDateRequirement, "No Need");
  assert.equal(features.countriesCovered, null); // always null in the live payload - must stay hidden
});

test("extractPlanFeatures never invents a plan category or voice+data label", () => {
  const features = extractPlanFeatures(buildPlan());
  const serialized = JSON.stringify(features);

  // Airhub's plan-info contract has no tier/category field - these must never appear.
  for (const invented of ["Premium", "Standard", "Lifetime", "Voice + Data", "4G/5G", "Autostart"]) {
    assert.equal(serialized.includes(invented), false, `must not invent ${invented}`);
  }
});

test("extractPlanFeatures hides fields that are null on the plan (missing, not invented)", () => {
  const features = extractPlanFeatures(
    buildPlan({
      planType: null,
      networkOperator: null,
      capacity: null,
      validityType: null,
      travelDateRequirement: null,
      subscription: null,
      phoneNumber: null,
      additionalInfo: null,
    }),
  );

  assert.equal(features.coverage, null);
  assert.equal(features.operator, null);
  assert.equal(features.dataLabel, null);
  assert.equal(features.validityLabel, null);
  assert.equal(features.travelDateRequirement, null);
  assert.equal(features.renewalAvailable, null);
  assert.equal(features.includesCalls, null);
  assert.deepEqual(features.description, { plainText: "", sections: [], bullets: [] });
});

test("extractPlanFeatures data label never guesses a unit it cannot confirm", () => {
  const features = extractPlanFeatures(
    buildPlan({ capacity: "999", planName: "Weird Plan Name", dataUnit: null }),
  );
  // No "GB"/"MB" confirmed anywhere in planName for this capacity -> bare number only.
  assert.equal(features.dataLabel, "999");
});
