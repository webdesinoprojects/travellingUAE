import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildEnquiryFieldLines,
  defaultApplyFormConfig,
  parseApplyFormConfig,
  parseCallFormConfig,
  parseContactCardsConfig,
  parseFormFields,
} from "./visa-forms.ts";

test("defaults mirror the hardcoded apply form", () => {
  const d = defaultApplyFormConfig();
  assert.equal(d.enabled, true);
  assert.deepEqual(d.fields.map((f) => f.key), ["email", "phone", "visaType", "travelers"]);
  assert.equal(d.fields[2].optionsFromVisaTypes, true);
});

test("parseFormFields: sanitizes types/keys, drops non-objects", () => {
  const fields = parseFormFields([
    { key: "email", label: "Email", type: "email", required: true, enabled: true, placeholder: "x@y" },
    { label: "Custom!", type: "nonsense", custom: true },
    "garbage",
    { key: "opts", label: "Pick", type: "select", options: ["A", "B", 5, ""] },
  ]);
  assert.equal(fields.length, 3);
  assert.equal(fields[1].type, "text"); // invalid type -> text
  assert.equal(fields[1].key, "Custom"); // sanitized key from label
  assert.deepEqual(fields[2].options, ["A", "B"]); // non-strings dropped
});

test("parseApplyFormConfig: fills defaults, clamps travellers", () => {
  const cfg = parseApplyFormConfig({ heading: "Apply", defaultTravellers: 999, fields: [] });
  assert.equal(cfg?.heading, "Apply");
  assert.equal(cfg?.defaultTravellers, 50); // clamped
  assert.equal(cfg?.fields.length, 4); // empty -> default fields
  assert.equal(parseApplyFormConfig(null), undefined);
  assert.equal(parseApplyFormConfig("x"), undefined);
});

test("parseCallFormConfig + parseContactCardsConfig", () => {
  const call = parseCallFormConfig({ enabled: false, heading: "Call me", fields: [{ key: "fullName", label: "Name", type: "text" }] });
  assert.equal(call?.enabled, false);
  assert.equal(call?.fields.length, 1);

  const cards = parseContactCardsConfig({ whatsapp: { enabled: false, label: "WA", value: "123" } });
  assert.equal(cards?.whatsapp.enabled, false);
  assert.equal(cards?.whatsapp.value, "123");
  assert.equal(cards?.phone.enabled, true); // default kept
  assert.equal(parseContactCardsConfig(42), undefined);
});

test("buildEnquiryFieldLines: only enabled fields with values", () => {
  const fields = parseApplyFormConfig({})!.fields;
  const lines = buildEnquiryFieldLines(fields, { email: "a@b.com", phone: "", visaType: "Tourist", travelers: "2" });
  assert.deepEqual(lines, ["Email ID: a@b.com", "Visa type: Tourist", "Travellers: 2"]);
});
