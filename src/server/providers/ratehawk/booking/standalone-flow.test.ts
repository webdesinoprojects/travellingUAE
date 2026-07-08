import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_STANDALONE_CONFIRMATION_WINDOW_SECONDS,
  decideStandaloneStripeCheckoutClaim,
  isStandaloneBookingCutoffReached,
  isStandaloneStatusPollEligible,
  nextStandaloneStatusAfterFinishException,
  nextStandaloneStatusFromStatusClassification,
} from "../../../hotels/booking-state.ts";
import { decideStandaloneFinishAfterStripe } from "./contracts.ts";

test("standalone: duplicate Stripe request cannot create a second payable session", () => {
  const nowMs = Date.parse("2026-06-29T12:00:00Z");

  assert.deepEqual(
    decideStandaloneStripeCheckoutClaim({
      status: "form_created",
      stripeCheckoutUrl: null,
      stripeCheckoutClaimedAt: null,
      nowMs,
    }),
    { kind: "claim" },
  );

  assert.deepEqual(
    decideStandaloneStripeCheckoutClaim({
      status: "payment_pending",
      stripeCheckoutUrl: "https://checkout.stripe.test/session",
      stripeCheckoutClaimedAt: "2026-06-29T12:00:00Z",
      nowMs,
    }),
    { kind: "return_existing", url: "https://checkout.stripe.test/session" },
  );

  assert.deepEqual(
    decideStandaloneStripeCheckoutClaim({
      status: "payment_pending",
      stripeCheckoutUrl: null,
      stripeCheckoutClaimedAt: "2026-06-29T11:59:30Z",
      nowMs,
    }),
    { kind: "wait" },
  );
});

test("standalone: stale Stripe claim can be reclaimed without returning an unpersisted URL", () => {
  assert.deepEqual(
    decideStandaloneStripeCheckoutClaim({
      status: "payment_pending",
      stripeCheckoutUrl: null,
      stripeCheckoutClaimedAt: "2026-06-29T11:55:00Z",
      nowMs: Date.parse("2026-06-29T12:00:00Z"),
    }),
    { kind: "claim" },
  );
});

test("standalone: duplicate Stripe webhook cannot start ETG finish twice", () => {
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

test("standalone: booking/finish exception moves into status polling", () => {
  assert.equal(nextStandaloneStatusAfterFinishException(), "processing");
  assert.equal(isStandaloneStatusPollEligible("processing"), true);
});

test("standalone: finish_started is eligible for finish/status polling", () => {
  assert.equal(isStandaloneStatusPollEligible("finish_started"), true);
  assert.equal(isStandaloneStatusPollEligible("payment_pending"), false);
  assert.equal(isStandaloneStatusPollEligible("confirmed"), false);
});

test("standalone: finish/status ok confirms; transient statuses remain processing", () => {
  assert.equal(
    nextStandaloneStatusFromStatusClassification({ kind: "success" }),
    "confirmed",
  );
  assert.equal(
    nextStandaloneStatusFromStatusClassification({ kind: "poll" }),
    "processing",
  );
  assert.equal(
    nextStandaloneStatusFromStatusClassification({ kind: "unknown" }),
    "processing",
  );
});

test("standalone: finish/status final failure marks failed/support path", () => {
  assert.equal(
    nextStandaloneStatusFromStatusClassification({ kind: "failed", code: "soldout" }),
    "failed",
  );
});

test("standalone: finish/status 3ds remains processing so user can verify card", () => {
  assert.equal(
    nextStandaloneStatusFromStatusClassification({ kind: "requires_3ds" }),
    "processing",
  );
  assert.equal(isStandaloneStatusPollEligible("processing"), true);
});

test("standalone: default booking confirmation cutoff is 600 seconds", () => {
  assert.equal(DEFAULT_STANDALONE_CONFIRMATION_WINDOW_SECONDS, 600);
});

test("standalone: booking confirmation cutoff waits 600 seconds by default", () => {
  const finishStartedAt = "2026-06-29T12:00:00Z";
  assert.equal(
    isStandaloneBookingCutoffReached({
      bookingCutoffAt: null,
      finishStartedAt,
      confirmationWindowMs: DEFAULT_STANDALONE_CONFIRMATION_WINDOW_SECONDS * 1000,
      nowMs: Date.parse("2026-06-29T12:09:59Z"),
    }),
    false,
  );
  assert.equal(
    isStandaloneBookingCutoffReached({
      bookingCutoffAt: null,
      finishStartedAt,
      confirmationWindowMs: DEFAULT_STANDALONE_CONFIRMATION_WINDOW_SECONDS * 1000,
      nowMs: Date.parse("2026-06-29T12:10:00Z"),
    }),
    true,
  );
});
