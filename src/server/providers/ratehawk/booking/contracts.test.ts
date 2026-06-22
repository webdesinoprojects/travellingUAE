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

test("status: ok and completed -> success", () => {
  assert.deepEqual(classifyBookingStatus(sig({ status: "ok" })), { kind: "success" });
  assert.deepEqual(classifyBookingStatus(sig({ status: "completed" })), { kind: "success" });
});

test("status: processing -> poll", () => {
  assert.deepEqual(classifyBookingStatus(sig({ status: "processing" })), { kind: "poll" });
});

test("status: 3ds STATUS -> requires_3ds", () => {
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

test("webhook: confirmed/completed/ok -> success", () => {
  for (const status of ["confirmed", "completed", "ok"]) {
    assert.deepEqual(classifyWebhookStatus(sig({ status })), { kind: "success" }, status);
  }
});

test("webhook: failed -> failed", () => {
  assert.deepEqual(classifyWebhookStatus(sig({ status: "failed" })), {
    kind: "failed",
    code: "failed",
  });
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

test("buildStartBookingRequest maps rooms/guests and hotel payment", () => {
  const body = buildStartBookingRequest({
    partnerOrderId: "po-1",
    language: "en",
    userEmail: "guest@example.com",
    rooms: [
      { guests: [{ firstName: "Martin", lastName: "Smith" }] },
      {
        guests: [
          { firstName: "Olga", lastName: "Jordan" },
          { firstName: "Ben", lastName: "Button", age: 7, isChild: true },
        ],
      },
    ],
    paymentType: "hotel",
  });
  assert.equal((body.payment_type as { type: string }).type, "hotel");
  const rooms = body.rooms as Array<{ guests: Array<Record<string, unknown>> }>;
  assert.equal(rooms.length, 2);
  assert.deepEqual(rooms[0].guests[0], { first_name: "Martin", last_name: "Smith" });
  assert.deepEqual(rooms[1].guests[1], {
    first_name: "Ben",
    last_name: "Button",
    is_child: true,
    age: 7,
  });
  assert.ok(!("return_path" in body));
});

test("buildStartBookingRequest requires 3ds fields for payment 'now'", () => {
  assert.throws(
    () =>
      buildStartBookingRequest({
        partnerOrderId: "po-1",
        language: "en",
        userEmail: "g@example.com",
        rooms: [{ guests: [{ firstName: "A", lastName: "B" }] }],
        paymentType: "now",
      }),
    BookingContractError,
  );
  const ok = buildStartBookingRequest({
    partnerOrderId: "po-1",
    language: "en",
    userEmail: "g@example.com",
    rooms: [{ guests: [{ firstName: "A", lastName: "B" }] }],
    paymentType: "now",
    returnPath: "https://flytime.example/return",
    payUuid: "pay-1",
    initUuid: "init-1",
  });
  assert.equal(ok.return_path, "https://flytime.example/return");
  assert.equal(ok.pay_uuid, "pay-1");
  assert.equal(ok.init_uuid, "init-1");
});

test("status/cancel/order-info builders shape the body", () => {
  assert.deepEqual(buildBookingStatusRequest("po-1"), { partner_order_id: "po-1" });
  assert.deepEqual(buildCancelRequest("po-1"), { partner_order_id: "po-1" });
  assert.deepEqual(buildOrderInfoRequest("po-1"), {
    ordering: { partner_order_ids: ["po-1"] },
  });
  assert.throws(() => buildBookingStatusRequest(""), BookingContractError);
});
