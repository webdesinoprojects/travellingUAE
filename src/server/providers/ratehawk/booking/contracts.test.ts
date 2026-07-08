import { test } from "node:test";
import assert from "node:assert/strict";

import {
  BOOKING_STATES,
  CREATE_RETRY_CODES,
  CREATE_TERMINAL_CODES,
  FINISH_PROCEED_CODES,
  FINISH_TERMINAL_CODES,
  STATUS_POLL_CODES,
  STATUS_TERMINAL_CODES,
  buildCancelRequest,
  buildCreateBookingRequest,
  buildOrderInfoRequest,
  buildStartBookingRequest,
  buildBookingStatusRequest,
  classifyBookingFinish,
  classifyBookingStatus,
  classifyCancel,
  classifyCreateBooking,
  classifyOrderInfo,
  classifyWebhookStatus,
  generatePartnerOrderId,
  isValidPartnerOrderId,
  nextBookingState,
  normalizeSignal,
  buildBookingRooms,
  parseCreateBookingResponse,
  decideStandaloneFinishAfterStripe,
  isHotelPageBookHash,
  isPrebookBookHash,
  selectDepositPaymentType,
  selectPaymentType,
  BookingContractError,
} from "./contracts.ts";

function sig(input: { httpStatus?: number | null; status?: string | null; error?: string | null }) {
  return normalizeSignal(input);
}

// ---- Create booking process ------------------------------------------------

test("create: status ok -> proceed", () => {
  assert.deepEqual(classifyCreateBooking(sig({ httpStatus: 200, status: "ok" })), {
    kind: "proceed",
  });
});

test("create: every documented retry code -> retry/new_partner_order_id", () => {
  for (const code of CREATE_RETRY_CODES) {
    assert.deepEqual(
      classifyCreateBooking(sig({ httpStatus: 200, error: code })),
      { kind: "retry", strategy: "new_partner_order_id" },
      `code ${code}`,
    );
  }
});

test("create: every documented terminal code -> failed", () => {
  for (const code of CREATE_TERMINAL_CODES) {
    assert.deepEqual(
      classifyCreateBooking(sig({ httpStatus: 200, error: code })),
      { kind: "failed", code },
      `code ${code}`,
    );
  }
});

test("create: 5xx and 429 -> retry/new_partner_order_id", () => {
  for (const httpStatus of [500, 502, 503, 504, 429]) {
    assert.deepEqual(classifyCreateBooking(sig({ httpStatus })), {
      kind: "retry",
      strategy: "new_partner_order_id",
    });
  }
});

test("create: undocumented error -> unknown", () => {
  assert.deepEqual(classifyCreateBooking(sig({ httpStatus: 400, error: "weird_new_code" })), {
    kind: "unknown",
  });
});

// ---- Start booking process -------------------------------------------------

test("finish: status ok -> proceed", () => {
  assert.deepEqual(classifyBookingFinish(sig({ httpStatus: 200, status: "ok" })), {
    kind: "proceed",
  });
});

test("finish: timeout/unknown/5xx -> proceed (check anyway)", () => {
  for (const code of FINISH_PROCEED_CODES) {
    assert.deepEqual(classifyBookingFinish(sig({ error: code })), { kind: "proceed" }, code);
  }
  for (const httpStatus of [500, 503, 429]) {
    assert.deepEqual(classifyBookingFinish(sig({ httpStatus })), { kind: "proceed" });
  }
});

test("finish: every documented terminal code -> failed", () => {
  for (const code of FINISH_TERMINAL_CODES) {
    assert.deepEqual(classifyBookingFinish(sig({ error: code })), { kind: "failed", code }, code);
  }
});

// ---- Check booking process -------------------------------------------------

test("status: ok -> success (check-booking-process poll value)", () => {
  assert.deepEqual(classifyBookingStatus(sig({ status: "ok" })), { kind: "success" });
});

test("status: 'completed' is NOT a poll success value (it is the webhook spelling) -> unknown", () => {
  assert.deepEqual(classifyBookingStatus(sig({ status: "completed" })), { kind: "unknown" });
});

test("status: processing -> poll", () => {
  assert.deepEqual(classifyBookingStatus(sig({ status: "processing" })), { kind: "poll" });
});

test("status: 3ds STATUS -> requires_3ds", () => {
  assert.deepEqual(classifyBookingStatus(sig({ status: "3ds" })), { kind: "requires_3ds" });
});

test("status: 3ds from immediate finish/status check -> requires_3ds", () => {
  assert.deepEqual(classifyBookingStatus(sig({ status: "3ds" })), { kind: "requires_3ds" });
});

test("status: 3ds from later finish/status poll -> requires_3ds", () => {
  assert.deepEqual(classifyBookingStatus(sig({ status: "3ds" })), { kind: "requires_3ds" });
});

test("status: timeout/unknown error + 5xx -> poll", () => {
  for (const code of STATUS_POLL_CODES) {
    assert.deepEqual(classifyBookingStatus(sig({ error: code })), { kind: "poll" }, code);
  }
  for (const httpStatus of [500, 503, 429]) {
    assert.deepEqual(classifyBookingStatus(sig({ httpStatus })), { kind: "poll" });
  }
});

test("status: every documented terminal code -> failed (incl 3ds as error)", () => {
  for (const code of STATUS_TERMINAL_CODES) {
    assert.deepEqual(classifyBookingStatus(sig({ error: code })), { kind: "failed", code }, code);
  }
});

// ---- Webhook ---------------------------------------------------------------

test("webhook: only 'completed' is success (endpoint-contract value)", () => {
  assert.deepEqual(classifyWebhookStatus(sig({ status: "completed" })), { kind: "success" });
});

test("webhook: failed -> failed", () => {
  assert.deepEqual(classifyWebhookStatus(sig({ status: "failed" })), {
    kind: "failed",
    code: "failed",
  });
});

test("webhook: 'ok' is NOT webhook success (it is a finish/status polling value)", () => {
  assert.deepEqual(classifyWebhookStatus(sig({ status: "ok" })), { kind: "unknown" });
});

test("webhook: 'confirmed' is NOT accepted until ETG confirms the spelling", () => {
  assert.deepEqual(classifyWebhookStatus(sig({ status: "confirmed" })), { kind: "unknown" });
});

test("webhook: unknown value -> unknown", () => {
  assert.deepEqual(classifyWebhookStatus(sig({ status: "weird" })), { kind: "unknown" });
});

// ---- Cancel ----------------------------------------------------------------

test("cancel: ok -> success", () => {
  assert.deepEqual(classifyCancel(sig({ status: "ok" })), { kind: "success" });
});

test("cancel: timeout and 5xx -> retry/single (at most once)", () => {
  assert.deepEqual(classifyCancel(sig({ error: "timeout" })), { kind: "retry", strategy: "single" });
  assert.deepEqual(classifyCancel(sig({ httpStatus: 503 })), { kind: "retry", strategy: "single" });
});

test("cancel: coded error -> failed", () => {
  assert.deepEqual(classifyCancel(sig({ error: "not_allowed" })), {
    kind: "failed",
    code: "not_allowed",
  });
});

// ---- Order info ------------------------------------------------------------

test("order info: ok -> success; delays -> poll; coded error -> failed", () => {
  assert.deepEqual(classifyOrderInfo(sig({ status: "ok" })), { kind: "success" });
  assert.deepEqual(classifyOrderInfo(sig({ error: "timeout" })), { kind: "poll" });
  assert.deepEqual(classifyOrderInfo(sig({ httpStatus: 503 })), { kind: "poll" });
  assert.deepEqual(classifyOrderInfo(sig({ error: "provider" })), {
    kind: "failed",
    code: "provider",
  });
});

// ---- State machine ---------------------------------------------------------

test("nextBookingState: happy path create -> start -> processing -> confirmed", () => {
  assert.equal(nextBookingState("creating", "booking_form", { kind: "proceed" }), "starting");
  assert.equal(nextBookingState("starting", "booking_finish", { kind: "proceed" }), "processing");
  assert.equal(nextBookingState("processing", "booking_status", { kind: "poll" }), "processing");
  assert.equal(nextBookingState("processing", "booking_status", { kind: "success" }), "confirmed");
});

test("nextBookingState: 3ds, failure, webhook confirm, cancel paths", () => {
  assert.equal(
    nextBookingState("processing", "booking_status", { kind: "requires_3ds" }),
    "requires_3ds",
  );
  assert.equal(
    nextBookingState("processing", "booking_status", { kind: "failed", code: "soldout" }),
    "failed",
  );
  assert.equal(nextBookingState("processing", "webhook", { kind: "success" }), "confirmed");
  assert.equal(nextBookingState("cancel_pending", "cancel", { kind: "success" }), "cancelled");
  assert.equal(
    nextBookingState("cancel_pending", "cancel", { kind: "failed", code: "x" }),
    "pending_review",
  );
});

test("nextBookingState: terminal states never transition", () => {
  for (const terminal of ["confirmed", "failed", "cancelled"] as const) {
    assert.equal(nextBookingState(terminal, "booking_status", { kind: "poll" }), terminal);
  }
});

test("nextBookingState: order_info never changes state", () => {
  assert.equal(nextBookingState("confirmed", "order_info", { kind: "success" }), "confirmed");
  assert.equal(nextBookingState("processing", "order_info", { kind: "poll" }), "processing");
});

test("BOOKING_STATES contains the full documented set", () => {
  assert.deepEqual(
    [...BOOKING_STATES].sort(),
    [
      "cancel_pending",
      "cancelled",
      "confirmed",
      "creating",
      "failed",
      "pending",
      "pending_review",
      "processing",
      "requires_3ds",
      "starting",
    ],
  );
});

// ---- partner_order_id ------------------------------------------------------

test("generatePartnerOrderId is unique and valid", () => {
  const a = generatePartnerOrderId();
  const b = generatePartnerOrderId();
  assert.notEqual(a, b);
  assert.ok(isValidPartnerOrderId(a));
  assert.ok(isValidPartnerOrderId(b));
});

test("isValidPartnerOrderId enforces 1-256 chars", () => {
  assert.ok(!isValidPartnerOrderId(""));
  assert.ok(isValidPartnerOrderId("x"));
  assert.ok(isValidPartnerOrderId("x".repeat(256)));
  assert.ok(!isValidPartnerOrderId("x".repeat(257)));
  assert.ok(!isValidPartnerOrderId(123 as unknown));
});

// ---- Request builders ------------------------------------------------------

test("buildCreateBookingRequest assembles documented fields", () => {
  const body = buildCreateBookingRequest({
    bookHash: "p-abc",
    partnerOrderId: "po-1",
    language: "en",
    userIp: "1.2.3.4",
  });
  assert.deepEqual(body, {
    partner_order_id: "po-1",
    book_hash: "p-abc",
    language: "en",
    user_ip: "1.2.3.4",
  });
});

test("buildCreateBookingRequest rejects bad partner id and missing fields", () => {
  assert.throws(
    () => buildCreateBookingRequest({ bookHash: "p", partnerOrderId: "", language: "en", userIp: "1" }),
    BookingContractError,
  );
  assert.throws(
    () => buildCreateBookingRequest({ bookHash: "", partnerOrderId: "po", language: "en", userIp: "1" }),
    BookingContractError,
  );
});

test("hotelpage/prebook hash guards enforce h-* then p-* sequence", () => {
  assert.equal(isHotelPageBookHash("h-hotelpage-token"), true);
  assert.equal(isHotelPageBookHash("p-prebook-token"), false);
  assert.equal(isPrebookBookHash("p-prebook-token"), true);
  assert.equal(isPrebookBookHash("h-hotelpage-token"), false);
});

test("buildCreateBookingRequest rejects hotelpage h-* hashes", () => {
  assert.throws(
    () =>
      buildCreateBookingRequest({
        bookHash: "h-hotelpage-token",
        partnerOrderId: "po-1",
        language: "en",
        userIp: "1.2.3.4",
      }),
    BookingContractError,
  );
});

test("buildStartBookingRequest uses official nested shape (partner/payment_type/supplier_data)", () => {
  const body = buildStartBookingRequest({
    partner: { partnerOrderId: "po-1", amountSellB2b2c: "120.00" },
    language: "en",
    user: { email: "guest@example.com", phone: "+15551234567" },
    rooms: [
      { guests: [{ firstName: "Martin", lastName: "Smith" }] },
      {
        guests: [
          { firstName: "Olga", lastName: "Jordan" },
          { firstName: "Ben", lastName: "Button", age: 7, isChild: true },
        ],
      },
    ],
    payment: { type: "hotel", amount: "40.85", currencyCode: "EUR" },
    supplierData: { firstNameOriginal: "Martin", lastNameOriginal: "Smith", email: "guest@example.com" },
  });

  // partner_order_id is NESTED under partner, never top-level.
  assert.equal((body.partner as { partner_order_id: string }).partner_order_id, "po-1");
  assert.equal((body.partner as { amount_sell_b2b2c: string }).amount_sell_b2b2c, "120.00");
  assert.equal("partner_order_id" in body, false);

  // payment_type resends the complete selected entry.
  assert.deepEqual(body.payment_type, { type: "hotel", amount: "40.85", currency_code: "EUR" });

  // user + supplier_data.
  assert.deepEqual(body.user, { email: "guest@example.com", phone: "+15551234567" });
  assert.deepEqual(body.supplier_data, {
    first_name_original: "Martin",
    last_name_original: "Smith",
    email: "guest@example.com",
  });

  const rooms = body.rooms as Array<{ guests: Array<Record<string, unknown>> }>;
  assert.equal(rooms.length, 2);
  assert.deepEqual(rooms[0].guests[0], { first_name: "Martin", last_name: "Smith" });
  assert.deepEqual(rooms[1].guests[1], {
    first_name: "Ben",
    last_name: "Button",
    is_child: true,
    age: 7,
  });
});

test("buildStartBookingRequest nests init_uuid/pay_uuid in payment_type for 'now' (return_path top-level)", () => {
  assert.throws(
    () =>
      buildStartBookingRequest({
        partner: { partnerOrderId: "po-1" },
        language: "en",
        user: { email: "g@example.com" },
        rooms: [{ guests: [{ firstName: "A", lastName: "B" }] }],
        payment: { type: "now", amount: "40.85", currencyCode: "EUR" },
      }),
    BookingContractError,
  );
  const ok = buildStartBookingRequest({
    partner: { partnerOrderId: "po-1" },
    language: "en",
    user: { email: "g@example.com" },
    rooms: [{ guests: [{ firstName: "A", lastName: "B" }] }],
    payment: {
      type: "now",
      amount: "40.85",
      currencyCode: "EUR",
      returnPath: "https://flytime.example/return",
      initUuid: "init-1",
      payUuid: "pay-1",
    },
  });
  const pt = ok.payment_type as Record<string, unknown>;
  // ETG requires init_uuid/pay_uuid INSIDE payment_type; return_path stays top-level.
  assert.deepEqual(pt, {
    type: "now",
    amount: "40.85",
    currency_code: "EUR",
    init_uuid: "init-1",
    pay_uuid: "pay-1",
  });
  assert.equal(ok.return_path, "https://flytime.example/return");
  // Must NOT be duplicated at the top level (top-level placement caused ETG
  // to reject Start Booking with not_enough_credit_card_data).
  assert.equal("init_uuid" in ok, false);
  assert.equal("pay_uuid" in ok, false);
});

test("buildStartBookingRequest rejects placeholder guest names", () => {
  assert.throws(
    () =>
      buildStartBookingRequest({
        partner: { partnerOrderId: "po-1" },
        language: "en",
        user: { email: "g@example.com" },
        rooms: [{ guests: [{ firstName: "Guest", lastName: "Guest" }] }],
        payment: { type: "hotel", amount: "10.00", currencyCode: "EUR" },
      }),
    BookingContractError,
  );
});

// ---- buildBookingRooms (exact occupancy, no fabrication) -------------------

test("buildBookingRooms preserves adults, child ages and room grouping exactly", () => {
  const rooms = buildBookingRooms(
    [
      { adults: 2, childrenAges: [] },
      { adults: 1, childrenAges: [7] },
    ],
    [
      { firstName: "Martin", lastName: "Smith" },
      { firstName: "Eliot", lastName: "Smith" },
      { firstName: "Olga", lastName: "Jordan" },
      { firstName: "Ben", lastName: "Button" },
    ],
  );
  assert.equal(rooms.length, 2);
  assert.equal(rooms[0].guests.length, 2);
  assert.equal(rooms[1].guests.length, 2);
  // The child keeps its age + is_child flag and stays in room 2.
  assert.deepEqual(rooms[1].guests[1], {
    firstName: "Ben",
    lastName: "Button",
    isChild: true,
    age: 7,
  });
  assert.equal(rooms[1].guests[0].isChild, undefined);
});

test("buildBookingRooms rejects when collected names cannot cover every occupant", () => {
  assert.throws(
    () => buildBookingRooms([{ adults: 2, childrenAges: [] }], [{ firstName: "Solo", lastName: "Guest" }]),
    BookingContractError,
  );
});

test("buildBookingRooms rejects empty occupancy and bad child ages", () => {
  assert.throws(() => buildBookingRooms([], []), BookingContractError);
  assert.throws(
    () => buildBookingRooms([{ adults: 1, childrenAges: [25] }], [{ firstName: "A", lastName: "B" }, { firstName: "C", lastName: "D" }]),
    BookingContractError,
  );
});

// ---- parseCreateBookingResponse -------------------------------------------

test("parseCreateBookingResponse extracts ids, payment_types, gender flag (no card data)", () => {
  const parsed = parseCreateBookingResponse({
    order_id: 123456789,
    item_id: 32165487,
    is_gender_specification_required: true,
    payment_types: [
      { type: "hotel", amount: "40.85", currency_code: "EUR", is_need_credit_card_data: false, is_need_cvc: false },
      { type: "now", amount: "40.85", currency_code: "EUR", is_need_credit_card_data: true, is_need_cvc: true },
    ],
  });
  assert.equal(parsed.orderId, "123456789");
  assert.equal(parsed.itemId, "32165487");
  assert.equal(parsed.isGenderSpecificationRequired, true);
  assert.equal(parsed.paymentTypes.length, 2);
  assert.equal(parsed.paymentTypes[1].isNeedCreditCardData, true);
  // No card fields are carried through.
  const serialized = JSON.stringify(parsed);
  assert.ok(!serialized.toLowerCase().includes("card_number"));
});

test("parseCreateBookingResponse is defensive on garbage", () => {
  assert.deepEqual(parseCreateBookingResponse(null), {
    orderId: null,
    itemId: null,
    paymentTypes: [],
    isGenderSpecificationRequired: false,
  });
});

test("selectPaymentType returns the matching entry or null", () => {
  const types = [
    { type: "hotel", amount: "1", currencyCode: "EUR", isNeedCreditCardData: false, isNeedCvc: false },
  ];
  assert.deepEqual(selectPaymentType(types, "hotel"), { type: "hotel", amount: "1", currencyCode: "EUR" });
  assert.equal(selectPaymentType(types, "now"), null);
});

test("selectDepositPaymentType only permits Stripe mapping for deposit", () => {
  const withoutDeposit = [
    { type: "hotel", amount: "1", currencyCode: "EUR", isNeedCreditCardData: false, isNeedCvc: false },
    { type: "now", amount: "1", currencyCode: "EUR", isNeedCreditCardData: true, isNeedCvc: true },
  ];
  const withDeposit = [
    ...withoutDeposit,
    { type: "deposit", amount: "25.50", currencyCode: "EUR", isNeedCreditCardData: false, isNeedCvc: false },
  ];
  assert.equal(selectDepositPaymentType(withoutDeposit), null);
  assert.deepEqual(selectDepositPaymentType(withDeposit), {
    type: "deposit",
    amount: "25.50",
    currencyCode: "EUR",
  });
});

test("standalone Stripe success starts ETG finish exactly from payment_pending", () => {
  assert.equal(
    decideStandaloneFinishAfterStripe({ status: "payment_pending", stripePaid: false }),
    "not_paid",
  );
  assert.equal(
    decideStandaloneFinishAfterStripe({ status: "payment_pending", stripePaid: true }),
    "start",
  );
  for (const status of ["finish_started", "processing", "confirmed", "failed"]) {
    assert.equal(
      decideStandaloneFinishAfterStripe({ status, stripePaid: true }),
      "already_started",
      status,
    );
  }
});

test("status/cancel builders shape the body", () => {
  assert.deepEqual(buildBookingStatusRequest("po-1"), { partner_order_id: "po-1" });
  assert.deepEqual(buildCancelRequest("po-1"), { partner_order_id: "po-1" });
  assert.throws(() => buildBookingStatusRequest(""), BookingContractError);
});

test("order-info request body matches ETG docs (search.partner_order_ids + ordering + pagination)", () => {
  assert.deepEqual(buildOrderInfoRequest("po-1"), {
    ordering: { ordering_type: "desc", ordering_by: "created_at" },
    pagination: { page_size: 1, page_number: 1 },
    search: { partner_order_ids: ["po-1"] },
    language: "en",
  });
  assert.throws(() => buildOrderInfoRequest(""), BookingContractError);
});
