import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computePageCount,
  isEsimOrderStatus,
  normalizeEsimListQuery,
  sanitizeEsimSearchTerm,
  toEsimOrderDetail,
  toEsimOrderListItem,
  type EsimOrderDetailRow,
  type EsimOrderListRow,
} from "./esim-orders-helpers.ts";

test("sanitizeEsimSearchTerm strips filter/ilike metacharacters and bounds length", () => {
  assert.equal(sanitizeEsimSearchTerm("a,b(c)%*\\d"), "a b c d");
  assert.equal(sanitizeEsimSearchTerm("  multiple   spaces  "), "multiple spaces");
  assert.equal(sanitizeEsimSearchTerm(null), "");
  assert.equal(sanitizeEsimSearchTerm("x".repeat(200)).length, 80);
});

test("normalizeEsimListQuery validates status, page and sanitizes q", () => {
  assert.deepEqual(normalizeEsimListQuery({ status: "paid", q: "foo", page: "3" }), {
    status: "paid",
    search: "foo",
    page: 3,
    pageSize: 25,
  });
  // invalid/unknown status -> "all"; bad page -> 1
  assert.deepEqual(normalizeEsimListQuery({ status: "nope", page: "-2" }), {
    status: "all",
    search: "",
    page: 1,
    pageSize: 25,
  });
  // array params take the first value
  assert.equal(normalizeEsimListQuery({ status: ["fulfilled", "paid"] }).status, "fulfilled");
});

test("isEsimOrderStatus guards the CHECK-constraint values", () => {
  assert.equal(isEsimOrderStatus("paid"), true);
  assert.equal(isEsimOrderStatus("fulfilled"), true);
  assert.equal(isEsimOrderStatus("banana"), false);
});

test("computePageCount", () => {
  assert.equal(computePageCount(0, 25), 1);
  assert.equal(computePageCount(25, 25), 1);
  assert.equal(computePageCount(26, 25), 2);
  assert.equal(computePageCount(51, 25), 3);
});

test("toEsimOrderListItem maps fields and coerces numeric price", () => {
  const row: EsimOrderListRow = {
    id: "id-1",
    public_reference: "ESIM-1",
    guest_email: "a@b.com",
    guest_name: "  Ada  ",
    country_name: "France",
    plan_name: "5GB",
    plan_code: "FR5",
    price: "3.50",
    currency: "usd",
    status: "paid",
    paid_at: "2026-07-01T00:00:00Z",
    created_at: "2026-07-01T00:00:00Z",
  };
  const item = toEsimOrderListItem(row);
  assert.equal(item.price, 3.5);
  assert.equal(item.guestName, "Ada");
  assert.equal(item.status, "paid");
});

test("toEsimOrderDetail exposes sensitive fields as booleans only — never raw", () => {
  const row: EsimOrderDetailRow = {
    id: "id-1",
    public_reference: "ESIM-1",
    guest_email: "a@b.com",
    guest_name: "Ada",
    country_name: "France",
    plan_name: "5GB",
    plan_code: "FR5",
    price: 3.5,
    currency: "USD",
    status: "fulfilled",
    paid_at: "2026-07-01T00:00:00Z",
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    expires_at: null,
    guest_phone: "+100",
    provider: "airhub",
    partner_code: "PARTNER",
    country_code: "FR",
    travel_date: "2026-08-01",
    paid_amount: "3.50",
    paid_currency: "USD",
    stripe_checkout_session_id: "cs_123",
    stripe_payment_intent_id: "pi_123",
    stripe_completed_event_id: "evt_123",
    unique_order_id: "UID-1",
    provider_order_id: "POID-1",
    activation_code: "ACT-SUPER-SECRET",
    lpa_code: "LPA:1$smdp$secret",
    qr_payload: "QR-SECRET-PAYLOAD",
    apn: "internet",
    sim_id: "SIM-SECRET",
    sim_pin: "9999",
    provider_response: { status: "ok", "weird key!": 1, sim: { pin: "9999" } },
    error_code: null,
  };

  const detail = toEsimOrderDetail(row);
  const serialized = JSON.stringify(detail);

  // Presence booleans are correct...
  assert.deepEqual(detail.fulfillment, {
    hasActivationCode: true,
    hasLpaCode: true,
    hasQrPayload: true,
    hasApn: true,
    hasSimId: true,
    hasSimPin: true,
  });

  // ...and NONE of the raw sensitive values leak into the DTO.
  for (const secret of [
    "ACT-SUPER-SECRET",
    "LPA:1$smdp$secret",
    "QR-SECRET-PAYLOAD",
    "internet",
    "SIM-SECRET",
    "9999",
  ]) {
    assert.equal(serialized.includes(secret), false, `DTO must not contain ${secret}`);
  }

  // provider_response is summarised by key NAMES only (sanitized), no values.
  assert.equal(detail.providerResponsePresent, true);
  assert.deepEqual(detail.providerResponseKeys, ["status", "sim"]);
  assert.equal(serialized.includes("weird key!"), false);

  // Non-sensitive identifiers are retained for admin display.
  assert.equal(detail.stripeCheckoutSessionId, "cs_123");
  assert.equal(detail.uniqueOrderId, "UID-1");
});

test("toEsimOrderDetail treats empty/whitespace sensitive fields as absent", () => {
  const base = makeDetailRow();
  const detail = toEsimOrderDetail({ ...base, activation_code: "   ", qr_payload: "" });
  assert.equal(detail.fulfillment.hasActivationCode, false);
  assert.equal(detail.fulfillment.hasQrPayload, false);
  assert.equal(detail.providerResponsePresent, false);
});

function makeDetailRow(): EsimOrderDetailRow {
  return {
    id: "id",
    public_reference: "ESIM-X",
    guest_email: "a@b.com",
    guest_name: null,
    country_name: null,
    plan_name: null,
    plan_code: "PC",
    price: null,
    currency: null,
    status: "paid",
    paid_at: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    expires_at: null,
    guest_phone: null,
    provider: "airhub",
    partner_code: "PARTNER",
    country_code: null,
    travel_date: null,
    paid_amount: null,
    paid_currency: null,
    stripe_checkout_session_id: null,
    stripe_payment_intent_id: null,
    stripe_completed_event_id: null,
    unique_order_id: null,
    provider_order_id: null,
    activation_code: null,
    lpa_code: null,
    qr_payload: null,
    apn: null,
    sim_id: null,
    sim_pin: null,
    provider_response: {},
    error_code: null,
  };
}
