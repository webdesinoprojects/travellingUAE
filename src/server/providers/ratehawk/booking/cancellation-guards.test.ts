import { test } from "node:test";
import assert from "node:assert/strict";

import {
  canAdminRequestHotelCancel,
  describeHotelCancellationState,
  evaluateCancellationRequest,
  mapCancellationOutcome,
  mapProcessedCancellationResult,
} from "./cancellation-guards.ts";

test("evaluateCancellationRequest: admin may cancel only a confirmed booking", () => {
  assert.deepEqual(
    evaluateCancellationRequest({
      providerOrderStatus: "confirmed",
      bookingCustomerEmail: null,
      requester: { kind: "admin" },
    }),
    { allowed: true },
  );

  for (const [status, code] of [
    ["cancel_pending", "already_cancelling"],
    ["cancelled", "already_terminal"],
    ["failed", "already_terminal"],
    ["processing", "not_confirmed"],
    ["pending_review", "not_confirmed"],
    [null, "not_confirmed"],
  ] as const) {
    const decision = evaluateCancellationRequest({
      providerOrderStatus: status,
      bookingCustomerEmail: null,
      requester: { kind: "admin" },
    });
    assert.equal(decision.allowed, false);
    assert.equal(decision.allowed === false && decision.code, code);
  }
});

test("canAdminRequestHotelCancel is true only for confirmed", () => {
  assert.equal(canAdminRequestHotelCancel("confirmed"), true);
  for (const status of ["cancel_pending", "cancelled", "failed", "processing", "pending_review", null]) {
    assert.equal(canAdminRequestHotelCancel(status), false);
  }
});

test("mapCancellationOutcome maps every RPC result to a safe HTTP outcome", () => {
  assert.deepEqual(mapCancellationOutcome("requested"), {
    httpStatus: 200,
    status: "cancellation_requested",
  });
  assert.equal(mapCancellationOutcome("already_cancelling").httpStatus, 409);
  assert.equal(mapCancellationOutcome("already_terminal").httpStatus, 409);
  assert.equal(mapCancellationOutcome("not_confirmed").httpStatus, 409);
  assert.equal(mapCancellationOutcome("missing_partner_order_id").httpStatus, 409);
  assert.equal(mapCancellationOutcome("not_found").httpStatus, 404);
  assert.equal(mapCancellationOutcome("boom").httpStatus, 500);
});

test("describeHotelCancellationState: only confirmed offers cancel; only cancel_pending offers processing", () => {
  const confirmed = describeHotelCancellationState("confirmed");
  assert.equal(confirmed.adminState, "not_requested");
  assert.equal(confirmed.canRequestCancel, true);
  assert.equal(confirmed.canProcessPending, false);

  const pending = describeHotelCancellationState("cancel_pending");
  assert.equal(pending.adminState, "requested_pending");
  assert.equal(pending.canRequestCancel, false);
  assert.equal(pending.canProcessPending, true);

  const cancelled = describeHotelCancellationState("cancelled");
  assert.equal(cancelled.adminState, "cancelled");
  assert.equal(cancelled.canRequestCancel, false);
  assert.equal(cancelled.canProcessPending, false);
  assert.equal(cancelled.tone, "success");

  const review = describeHotelCancellationState("pending_review");
  assert.equal(review.adminState, "needs_review");
  assert.equal(review.canRequestCancel, false);

  for (const status of ["processing", "creating", "requires_3ds", null]) {
    const view = describeHotelCancellationState(status);
    assert.equal(view.adminState, "not_cancellable");
    assert.equal(view.canRequestCancel, false);
    assert.equal(view.canProcessPending, false);
  }
});

test("mapProcessedCancellationResult surfaces the correct admin result label", () => {
  assert.equal(mapProcessedCancellationResult("cancelled").adminState, "cancelled");
  assert.equal(mapProcessedCancellationResult("cancel_pending").adminState, "requested_pending");
  assert.equal(mapProcessedCancellationResult("pending_review").adminState, "needs_review");
  assert.equal(mapProcessedCancellationResult("failed").adminState, "failed");
});

test("cancellation view never leaks card / 3DS / hash / payload terms", () => {
  const statuses = [
    "confirmed",
    "cancel_pending",
    "cancelled",
    "pending_review",
    "failed",
    "processing",
    null,
  ];
  const forbidden = ["card", "cvc", "pan", "3ds", "3-d", "hash", "payload", "cvv", "pin"];
  for (const status of statuses) {
    const serialized = JSON.stringify({
      view: describeHotelCancellationState(status),
      result: mapProcessedCancellationResult(status),
    }).toLowerCase();
    for (const term of forbidden) {
      assert.equal(serialized.includes(term), false, `state ${status} must not mention "${term}"`);
    }
  }
});
