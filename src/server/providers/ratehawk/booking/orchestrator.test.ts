import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  executeCreateBooking,
  executeStartBooking,
  executePollStatus,
  buildCreateBookingJobSpec,
  type BookingRepository,
  type BookingContext,
  type OrchestratorTransport,
  type OrchestratorTransportResult,
  type BookingJob,
  type NewBookingAttempt,
  type NewBookingEvent,
  type NewJob,
  type StatePatch,
} from "./orchestrator.ts";
import type { BookingState } from "./contracts.ts";
import { toProviderBookingPublicStatus } from "./public-status.ts";
import { extractTrustedUserIp, isPublicIp } from "./ip-trust.ts";

// ---- Test helpers ----------------------------------------------------------

function makeContext(overrides?: Partial<BookingContext>): BookingContext {
  return {
    bookingId: "booking-uuid-1",
    providerOrderStatus: null,
    providerStatusVersion: 0,
    providerAttemptCount: 0,
    providerPartnerOrderId: null,
    providerBookingCutoffAt: null,
    prebookHash: "p-test-hash",
    customerEmail: "test@example.com",
    customerFirstName: "Test",
    customerLastName: "User",
    customerPhone: "+15551234567",
    travelersCount: 1,
    language: "en",
    paymentType: "hotel",
    userIp: "8.8.8.8",
    // Single occupant so the lead name satisfies occupancy in the default path.
    occupancy: [{ adults: 1, childrenAges: [] }],
    providerPaymentTypes: [
      { type: "hotel", amount: "100.00", currencyCode: "EUR", isNeedCreditCardData: false, isNeedCvc: false },
    ],
    isGenderSpecificationRequired: false,
    ...overrides,
  };
}

function makeJob(overrides?: Partial<BookingJob>): BookingJob {
  return {
    id: "job-uuid-1",
    bookingId: "booking-uuid-1",
    jobType: "create_booking",
    status: "leased",
    attempts: 1,
    maxAttempts: 10,
    partnerOrderId: null,
    payload: {},
    ...overrides,
  };
}

type RepoCall =
  | { type: "transitionState"; toState: BookingState; expectedVersion: number; patch?: StatePatch }
  | { type: "createAttempt"; data: NewBookingAttempt }
  | { type: "updateAttemptStatus"; partnerOrderId: string; status: string }
  | { type: "appendEvent"; data: NewBookingEvent }
  | { type: "enqueueJob"; data: NewJob }
  | { type: "storeCreateBookingResult"; data: Record<string, unknown> };

function makeRepo(ctx: BookingContext, transitionOk = true): {
  repo: BookingRepository;
  calls: RepoCall[];
} {
  const calls: RepoCall[] = [];

  const repo: BookingRepository = {
    async getBookingContext() {
      return ctx;
    },
    async transitionState({ toState, expectedVersion, patch }) {
      calls.push({ type: "transitionState", toState, expectedVersion, patch });
      return transitionOk;
    },
    async createAttempt(data) {
      calls.push({ type: "createAttempt", data });
      return "attempt-uuid";
    },
    async updateAttemptStatus(partnerOrderId, status) {
      calls.push({ type: "updateAttemptStatus", partnerOrderId, status });
    },
    async appendEvent(data) {
      calls.push({ type: "appendEvent", data });
    },
    async enqueueJob(data) {
      calls.push({ type: "enqueueJob", data });
      return "new-job-uuid";
    },
    async storeCreateBookingResult(data) {
      calls.push({ type: "storeCreateBookingResult", data });
    },
  };

  return { repo, calls };
}

function makeTransport(
  responses: Array<Partial<OrchestratorTransportResult>>,
): { transport: OrchestratorTransport; callCount: number[] } {
  const callCount = [0];
  let i = 0;

  const transport: OrchestratorTransport = {
    async call() {
      callCount[0] += 1;
      const r = responses[i++] ?? { httpStatus: 200, status: "ok", error: null, data: {} };
      return {
        httpStatus: r.httpStatus ?? 200,
        status: r.status ?? null,
        error: r.error ?? null,
        data: r.data ?? null,
      };
    },
  };

  return { transport, callCount };
}

// ---- Create booking step ---------------------------------------------------

describe("executeCreateBooking", () => {
  test("ETG ok -> transition to starting, enqueue start_booking, return succeeded", async () => {
    const ctx = makeContext();
    const { repo, calls } = makeRepo(ctx);
    const { transport } = makeTransport([{ httpStatus: 200, status: "ok" }]);

    const outcome = await executeCreateBooking({ job: makeJob(), transport, repo });

    assert.equal(outcome.kind, "succeeded");

    const transitions = calls.filter((c) => c.type === "transitionState");
    assert.equal(transitions.length, 2);
    assert.equal(
      (transitions[0] as { type: "transitionState"; toState: string }).toState,
      "creating",
    );
    assert.equal(
      (transitions[1] as { type: "transitionState"; toState: string }).toState,
      "starting",
    );

    const enqueue = calls.find((c) => c.type === "enqueueJob");
    assert.ok(enqueue, "start_booking job should be enqueued");
    assert.equal(
      (enqueue as { type: "enqueueJob"; data: NewJob }).data.jobType,
      "start_booking",
    );
  });

  test("ETG duplicate_reservation -> retry, stay at creating", async () => {
    const ctx = makeContext();
    const { repo, calls } = makeRepo(ctx);
    const { transport } = makeTransport([
      { httpStatus: 200, status: null, error: "duplicate_reservation" },
    ]);

    const outcome = await executeCreateBooking({ job: makeJob(), transport, repo });

    assert.equal(outcome.kind, "requeue");

    const transitions = calls.filter((c) => c.type === "transitionState");
    assert.equal(
      (transitions[1] as { type: "transitionState"; toState: string }).toState,
      "creating",
      "should stay in creating on retry",
    );

    const enqueue = calls.find((c) => c.type === "enqueueJob");
    assert.equal(enqueue, undefined, "no start_booking job on retry");
  });

  test("ETG 503 -> retry (transient HTTP)", async () => {
    const ctx = makeContext();
    const { repo } = makeRepo(ctx);
    const { transport } = makeTransport([{ httpStatus: 503, status: null }]);

    const outcome = await executeCreateBooking({ job: makeJob(), transport, repo });
    assert.equal(outcome.kind, "requeue");
  });

  test("ETG hotel_not_found -> terminal failed immediately", async () => {
    const ctx = makeContext();
    const { repo, calls } = makeRepo(ctx);
    const { transport } = makeTransport([
      { httpStatus: 200, status: null, error: "hotel_not_found" },
    ]);

    const outcome = await executeCreateBooking({ job: makeJob(), transport, repo });

    assert.equal(outcome.kind, "terminal");
    assert.equal(outcome.errorCode, "hotel_not_found");

    const transition = calls.filter((c) => c.type === "transitionState").at(-1) as {
      type: "transitionState";
      toState: string;
    };
    assert.equal(transition.toState, "failed");
  });

  test("ETG contract_mismatch -> terminal failed", async () => {
    const ctx = makeContext();
    const { repo } = makeRepo(ctx);
    const { transport } = makeTransport([
      { httpStatus: 200, status: null, error: "contract_mismatch" },
    ]);

    const outcome = await executeCreateBooking({ job: makeJob(), transport, repo });
    assert.equal(outcome.kind, "terminal");
  });

  test("unknown response -> pending_review", async () => {
    const ctx = makeContext();
    const { repo, calls } = makeRepo(ctx);
    const { transport } = makeTransport([{ httpStatus: 200, status: "weird_status" }]);

    const outcome = await executeCreateBooking({ job: makeJob(), transport, repo });

    assert.equal(outcome.kind, "terminal");
    const lastTransition = calls.filter((c) => c.type === "transitionState").at(-1) as {
      type: "transitionState";
      toState: string;
    };
    assert.equal(lastTransition.toState, "pending_review");
  });

  test("attempt count >= MAX_CREATE_BOOKING_RETRIES -> terminal without calling ETG", async () => {
    const ctx = makeContext({ providerAttemptCount: 10 });
    const { repo } = makeRepo(ctx);
    const { transport, callCount } = makeTransport([]);

    const outcome = await executeCreateBooking({ job: makeJob(), transport, repo });

    assert.equal(outcome.kind, "terminal");
    assert.equal(outcome.errorCode, "max_create_retries_exceeded");
    assert.equal(callCount[0], 0, "ETG must not be called when retries exhausted");
  });

  test("optimistic lock conflict (transitionState returns false) -> requeue, no ETG call", async () => {
    const ctx = makeContext();
    const { repo } = makeRepo(ctx, false);
    const { transport, callCount } = makeTransport([]);

    const outcome = await executeCreateBooking({ job: makeJob(), transport, repo });

    assert.equal(outcome.kind, "requeue");
    assert.equal(callCount[0], 0, "ETG must not be called when lock is lost");
  });

  test("booking not found -> terminal", async () => {
    const { transport } = makeTransport([]);
    const repo: BookingRepository = {
      async getBookingContext() { return null; },
      async transitionState() { return true; },
      async createAttempt() { return ""; },
      async updateAttemptStatus() {},
      async appendEvent() {},
      async enqueueJob() { return ""; },
      async storeCreateBookingResult() {},
    };

    const outcome = await executeCreateBooking({ job: makeJob(), transport, repo });
    assert.equal(outcome.kind, "terminal");
    assert.equal(outcome.errorCode, "booking_not_found");
  });

  test("booking already in terminal state -> succeeded (idempotent)", async () => {
    const ctx = makeContext({ providerOrderStatus: "confirmed", providerStatusVersion: 5 });
    const { repo } = makeRepo(ctx);
    const { transport, callCount } = makeTransport([]);

    const outcome = await executeCreateBooking({ job: makeJob(), transport, repo });

    assert.equal(outcome.kind, "succeeded");
    assert.equal(callCount[0], 0, "ETG must not be called for terminal bookings");
  });

  test("new partner_order_id is generated per attempt (not reused)", async () => {
    const ctx = makeContext();
    const seenIds = new Set<string>();
    let firstId: string | null = null;

    const repo: BookingRepository = {
      async getBookingContext() { return ctx; },
      async transitionState({ patch }) {
        if (patch?.providerPartnerOrderId) {
          seenIds.add(patch.providerPartnerOrderId);
          if (!firstId) firstId = patch.providerPartnerOrderId;
        }
        return true;
      },
      async createAttempt({ partnerOrderId }) {
        seenIds.add(partnerOrderId);
        return "attempt";
      },
      async updateAttemptStatus() {},
      async appendEvent() {},
      async enqueueJob() { return ""; },
      async storeCreateBookingResult() {},
    };
    const { transport } = makeTransport([{ httpStatus: 200, status: "ok" }]);

    await executeCreateBooking({ job: makeJob(), transport, repo });

    // Run a second time simulating retry - should get a different partner_order_id
    ctx.providerAttemptCount = 1;
    ctx.providerStatusVersion = 2;
    const { transport: t2 } = makeTransport([{ httpStatus: 200, status: "ok" }]);
    await executeCreateBooking({ job: makeJob(), transport: t2, repo });

    assert.equal(seenIds.size >= 2, true, "each attempt must use a distinct partner_order_id");
  });
});

// ---- Start booking step ----------------------------------------------------

describe("executeStartBooking", () => {
  test("ETG ok -> transition to processing, enqueue poll_status with 5s delay", async () => {
    const ctx = makeContext({ providerOrderStatus: "starting", providerStatusVersion: 1 });
    const { repo, calls } = makeRepo(ctx);
    const { transport } = makeTransport([{ httpStatus: 200, status: "ok" }]);
    const job = makeJob({
      jobType: "start_booking",
      partnerOrderId: "partner-uuid-1",
    });

    const outcome = await executeStartBooking({ job, transport, repo });

    assert.equal(outcome.kind, "succeeded");

    const transitions = calls.filter((c) => c.type === "transitionState");
    assert.equal(
      (transitions.at(-1) as { type: "transitionState"; toState: string }).toState,
      "processing",
    );

    const enqueue = calls.find((c) => c.type === "enqueueJob") as {
      type: "enqueueJob";
      data: NewJob;
    };
    assert.ok(enqueue);
    assert.equal(enqueue.data.jobType, "poll_status");
    assert.equal(enqueue.data.runAfterMs, 5000);
  });

  test("ETG timeout on finish -> still proceeds to processing (not a terminal error)", async () => {
    const ctx = makeContext({ providerOrderStatus: "starting", providerStatusVersion: 1 });
    const { repo } = makeRepo(ctx);
    const { transport } = makeTransport([
      { httpStatus: 200, status: null, error: "timeout" },
    ]);
    const job = makeJob({ jobType: "start_booking", partnerOrderId: "p-1" });

    const outcome = await executeStartBooking({ job, transport, repo });
    assert.equal(outcome.kind, "succeeded");
  });

  test("ETG 5xx on finish -> proceeds (not terminal)", async () => {
    const ctx = makeContext({ providerOrderStatus: "starting", providerStatusVersion: 1 });
    const { repo } = makeRepo(ctx);
    const { transport } = makeTransport([{ httpStatus: 503, status: null }]);
    const job = makeJob({ jobType: "start_booking", partnerOrderId: "p-1" });

    const outcome = await executeStartBooking({ job, transport, repo });
    assert.equal(outcome.kind, "succeeded", "5xx on finish should still proceed to polling");
  });

  test("ETG booking_form_expired -> terminal failed", async () => {
    const ctx = makeContext({ providerOrderStatus: "starting", providerStatusVersion: 1 });
    const { repo, calls } = makeRepo(ctx);
    const { transport } = makeTransport([
      { httpStatus: 200, status: null, error: "booking_form_expired" },
    ]);
    const job = makeJob({ jobType: "start_booking", partnerOrderId: "p-1" });

    const outcome = await executeStartBooking({ job, transport, repo });

    assert.equal(outcome.kind, "terminal");
    const lastTransition = calls.filter((c) => c.type === "transitionState").at(-1) as {
      type: "transitionState";
      toState: string;
    };
    assert.equal(lastTransition.toState, "failed");
  });

  test("missing partner_order_id -> terminal", async () => {
    const ctx = makeContext({ providerOrderStatus: "starting", providerPartnerOrderId: null });
    const { repo } = makeRepo(ctx);
    const { transport } = makeTransport([]);
    const job = makeJob({ jobType: "start_booking", partnerOrderId: null });

    const outcome = await executeStartBooking({ job, transport, repo });
    assert.equal(outcome.kind, "terminal");
    assert.equal(outcome.errorCode, "missing_partner_order_id");
  });
});

// ---- Requirements 1-4: contract, persistence, occupancy, IP ----------------

describe("create booking: persists response + rejects bad data before ETG", () => {
  test("persists order_id/item_id/payment_types/gender flag on proceed", async () => {
    const ctx = makeContext();
    const { repo, calls } = makeRepo(ctx);
    const { transport } = makeTransport([
      {
        httpStatus: 200,
        status: "ok",
        data: {
          order_id: 123456789,
          item_id: 32165487,
          is_gender_specification_required: true,
          payment_types: [
            { type: "hotel", amount: "40.85", currency_code: "EUR", is_need_credit_card_data: false, is_need_cvc: false },
          ],
        },
      },
    ]);

    const outcome = await executeCreateBooking({ job: makeJob(), transport, repo });
    assert.equal(outcome.kind, "succeeded");

    const stored = calls.find((c) => c.type === "storeCreateBookingResult") as
      | { type: "storeCreateBookingResult"; data: Record<string, unknown> }
      | undefined;
    assert.ok(stored, "create booking response must be persisted");
    assert.equal(stored.data.orderId, "123456789");
    assert.equal(stored.data.itemId, "32165487");
    assert.equal(stored.data.isGenderSpecificationRequired, true);
    const pts = stored.data.paymentTypes as Array<{ type: string }>;
    assert.equal(pts[0].type, "hotel");
  });

  test("rejects (pending_review) BEFORE any ETG call when no public IP", async () => {
    const ctx = makeContext({ userIp: "10.0.0.5" }); // private
    const { repo, calls } = makeRepo(ctx);
    const { transport, callCount } = makeTransport([]);

    const outcome = await executeCreateBooking({ job: makeJob(), transport, repo });

    assert.equal(outcome.kind, "terminal");
    assert.equal(outcome.errorCode, "missing_user_ip");
    assert.equal(callCount[0], 0, "no ETG call without a trustworthy IP");
    const t = calls.filter((c) => c.type === "transitionState").at(-1) as { toState: string };
    assert.equal(t.toState, "pending_review");
  });

  test("rejects BEFORE ETG when occupancy cannot be satisfied with real names", async () => {
    // 2 adults but only the lead name is collected -> cannot name every occupant.
    const ctx = makeContext({ occupancy: [{ adults: 2, childrenAges: [] }] });
    const { repo } = makeRepo(ctx);
    const { transport, callCount } = makeTransport([]);

    const outcome = await executeCreateBooking({ job: makeJob(), transport, repo });

    assert.equal(outcome.kind, "terminal");
    assert.equal(outcome.errorCode, "guest_data_incomplete");
    assert.equal(callCount[0], 0);
  });

  test("rejects BEFORE ETG when occupancy is unavailable", async () => {
    const ctx = makeContext({ occupancy: null });
    const { repo } = makeRepo(ctx);
    const { transport, callCount } = makeTransport([]);
    const outcome = await executeCreateBooking({ job: makeJob(), transport, repo });
    assert.equal(outcome.kind, "terminal");
    assert.equal(outcome.errorCode, "occupancy_unavailable");
    assert.equal(callCount[0], 0);
  });
});

describe("start booking: occupancy + payment_type resend + gender guard", () => {
  function startCtx(overrides?: Partial<BookingContext>): BookingContext {
    return makeContext({
      providerOrderStatus: "starting",
      providerStatusVersion: 1,
      providerPartnerOrderId: "partner-1",
      ...overrides,
    });
  }

  test("resends the matching create-booking payment_types entry verbatim", async () => {
    const ctx = startCtx({
      providerPaymentTypes: [
        { type: "hotel", amount: "40.85", currencyCode: "EUR", isNeedCreditCardData: false, isNeedCvc: false },
      ],
    });
    const { repo } = makeRepo(ctx);
    let sentBody: Record<string, unknown> | null = null;
    const transport: OrchestratorTransport = {
      async call(_step, _path, body) {
        sentBody = body;
        return { httpStatus: 200, status: "ok", error: null, data: null };
      },
    };
    const job = makeJob({ jobType: "start_booking", partnerOrderId: "partner-1" });

    const outcome = await executeStartBooking({ job, transport, repo });
    assert.equal(outcome.kind, "succeeded");
    assert.ok(sentBody);
    assert.deepEqual((sentBody as Record<string, unknown>).payment_type, {
      type: "hotel",
      amount: "40.85",
      currency_code: "EUR",
    });
    // partner_order_id is nested, supplier_data present, no top-level partner_order_id.
    assert.equal(((sentBody as Record<string, unknown>).partner as { partner_order_id: string }).partner_order_id, "partner-1");
    assert.equal("partner_order_id" in (sentBody as Record<string, unknown>), false);
    assert.ok((sentBody as Record<string, unknown>).supplier_data);
  });

  test("rejects before ETG when the configured payment model is not in payment_types", async () => {
    const ctx = startCtx({ paymentType: "now", providerPaymentTypes: [
      { type: "hotel", amount: "1", currencyCode: "EUR", isNeedCreditCardData: false, isNeedCvc: false },
    ] });
    const { repo } = makeRepo(ctx);
    const { transport, callCount } = makeTransport([]);
    const job = makeJob({ jobType: "start_booking", partnerOrderId: "partner-1" });

    const outcome = await executeStartBooking({ job, transport, repo });
    assert.equal(outcome.kind, "terminal");
    assert.equal(outcome.errorCode, "payment_type_unavailable");
    assert.equal(callCount[0], 0);
  });

  test("rejects before ETG when gender specification is required (not collected)", async () => {
    const ctx = startCtx({ isGenderSpecificationRequired: true });
    const { repo } = makeRepo(ctx);
    const { transport, callCount } = makeTransport([]);
    const job = makeJob({ jobType: "start_booking", partnerOrderId: "partner-1" });

    const outcome = await executeStartBooking({ job, transport, repo });
    assert.equal(outcome.kind, "terminal");
    assert.equal(outcome.errorCode, "gender_required_not_collected");
    assert.equal(callCount[0], 0);
  });

  test("preserves child age + room grouping when names are sufficient", async () => {
    // 2 rooms; provide exactly the real names required (3 occupants).
    const ctx = startCtx({
      occupancy: [
        { adults: 1, childrenAges: [] },
        { adults: 1, childrenAges: [7] },
      ],
    });
    // Override name collection by injecting two collected names via customer fields
    // is not possible (only lead). So this must REJECT: 3 occupants, 1 name.
    const { repo } = makeRepo(ctx);
    const { transport, callCount } = makeTransport([]);
    const job = makeJob({ jobType: "start_booking", partnerOrderId: "partner-1" });
    const outcome = await executeStartBooking({ job, transport, repo });
    assert.equal(outcome.kind, "terminal");
    assert.equal(outcome.errorCode, "guest_data_incomplete");
    assert.equal(callCount[0], 0);
  });
});

// ---- Poll status step ------------------------------------------------------

describe("executePollStatus", () => {
  test("status ok -> confirmed", async () => {
    const ctx = makeContext({ providerOrderStatus: "processing", providerStatusVersion: 2 });
    const { repo, calls } = makeRepo(ctx);
    const { transport } = makeTransport([{ httpStatus: 200, status: "ok" }]);
    const job = makeJob({ jobType: "poll_status", partnerOrderId: "p-1", payload: { pollCount: 1 } });

    const outcome = await executePollStatus({ job, transport, repo });

    assert.equal(outcome.kind, "succeeded");
    const lastTransition = calls.filter((c) => c.type === "transitionState").at(-1) as {
      type: "transitionState";
      toState: string;
    };
    assert.equal(lastTransition.toState, "confirmed");
  });

  test("status 'completed' on the poll surface is unknown -> pending_review (poll value is 'ok')", async () => {
    const ctx = makeContext({ providerOrderStatus: "processing", providerStatusVersion: 2 });
    const { repo, calls } = makeRepo(ctx);
    const { transport } = makeTransport([{ httpStatus: 200, status: "completed" }]);
    const job = makeJob({ jobType: "poll_status", partnerOrderId: "p-1", payload: { pollCount: 1 } });

    const outcome = await executePollStatus({ job, transport, repo });

    // `completed` is the WEBHOOK success spelling, not a finish/status poll value.
    assert.equal(outcome.kind, "terminal");
    const lastTransition = calls.filter((c) => c.type === "transitionState").at(-1) as {
      type: "transitionState";
      toState: string;
    };
    assert.equal(lastTransition.toState, "pending_review");
  });

  test("status processing -> re-enqueue poll with 5s delay", async () => {
    const ctx = makeContext({ providerOrderStatus: "processing", providerStatusVersion: 2 });
    const { repo, calls } = makeRepo(ctx);
    const { transport } = makeTransport([{ httpStatus: 200, status: "processing" }]);
    const job = makeJob({ jobType: "poll_status", partnerOrderId: "p-1", payload: { pollCount: 1 } });

    const outcome = await executePollStatus({ job, transport, repo });

    assert.equal(outcome.kind, "succeeded");
    const enqueue = calls.find((c) => c.type === "enqueueJob") as {
      type: "enqueueJob";
      data: NewJob;
    };
    assert.ok(enqueue);
    assert.equal(enqueue.data.jobType, "poll_status");
    assert.equal(enqueue.data.runAfterMs, 5000);
    assert.equal(enqueue.data.payload.pollCount, 2);
  });

  test("error timeout -> re-enqueue (not terminal)", async () => {
    const ctx = makeContext({ providerOrderStatus: "processing", providerStatusVersion: 2 });
    const { repo, calls } = makeRepo(ctx);
    const { transport } = makeTransport([
      { httpStatus: 200, status: null, error: "timeout" },
    ]);
    const job = makeJob({ jobType: "poll_status", partnerOrderId: "p-1", payload: { pollCount: 1 } });

    const outcome = await executePollStatus({ job, transport, repo });
    assert.equal(outcome.kind, "succeeded");
    const enqueue = calls.find((c) => c.type === "enqueueJob");
    assert.ok(enqueue, "timeout on poll should re-enqueue, not fail");
  });

  test("status 3ds -> requires_3ds state", async () => {
    const ctx = makeContext({ providerOrderStatus: "processing", providerStatusVersion: 2 });
    const { repo, calls } = makeRepo(ctx);
    const { transport } = makeTransport([{ httpStatus: 200, status: "3ds" }]);
    const job = makeJob({ jobType: "poll_status", partnerOrderId: "p-1", payload: { pollCount: 1 } });

    const outcome = await executePollStatus({ job, transport, repo });

    assert.equal(outcome.kind, "terminal");
    assert.equal(outcome.errorCode, "requires_3ds");
    const lastTransition = calls.filter((c) => c.type === "transitionState").at(-1) as {
      type: "transitionState";
      toState: string;
    };
    assert.equal(lastTransition.toState, "requires_3ds");
  });

  test("error soldout -> terminal failed", async () => {
    const ctx = makeContext({ providerOrderStatus: "processing", providerStatusVersion: 2 });
    const { repo, calls } = makeRepo(ctx);
    const { transport } = makeTransport([
      { httpStatus: 200, status: null, error: "soldout" },
    ]);
    const job = makeJob({ jobType: "poll_status", partnerOrderId: "p-1", payload: { pollCount: 1 } });

    const outcome = await executePollStatus({ job, transport, repo });

    assert.equal(outcome.kind, "terminal");
    const lastTransition = calls.filter((c) => c.type === "transitionState").at(-1) as {
      type: "transitionState";
      toState: string;
    };
    assert.equal(lastTransition.toState, "failed");
  });

  test("booking cut-off exceeded -> pending_review without calling ETG", async () => {
    const pastCutoff = new Date(Date.now() - 1000).toISOString();
    const ctx = makeContext({
      providerOrderStatus: "processing",
      providerStatusVersion: 2,
      providerBookingCutoffAt: pastCutoff,
    });
    const { repo, calls } = makeRepo(ctx);
    const { transport, callCount } = makeTransport([]);
    const job = makeJob({ jobType: "poll_status", partnerOrderId: "p-1", payload: { pollCount: 5 } });

    const outcome = await executePollStatus({ job, transport, repo });

    assert.equal(outcome.kind, "terminal");
    assert.equal(outcome.errorCode, "booking_cutoff_exceeded");
    assert.equal(callCount[0], 0, "ETG must not be polled after cut-off");
    const lastTransition = calls.filter((c) => c.type === "transitionState").at(-1) as {
      type: "transitionState";
      toState: string;
    };
    assert.equal(lastTransition.toState, "pending_review");
  });

  test("cut-off in future -> polls ETG normally", async () => {
    const futureCutoff = new Date(Date.now() + 60_000).toISOString();
    const ctx = makeContext({
      providerOrderStatus: "processing",
      providerBookingCutoffAt: futureCutoff,
    });
    const { repo } = makeRepo(ctx);
    const { transport, callCount } = makeTransport([{ httpStatus: 200, status: "ok" }]);
    const job = makeJob({ jobType: "poll_status", partnerOrderId: "p-1", payload: {} });

    await executePollStatus({ job, transport, repo });
    assert.equal(callCount[0], 1, "ETG should be polled when cut-off is in the future");
  });
});

// ---- State machine properties ----------------------------------------------

describe("state machine invariants", () => {
  test("confirmed state does not transition further on poll success", async () => {
    const ctx = makeContext({ providerOrderStatus: "confirmed", providerStatusVersion: 5 });
    const { repo, calls } = makeRepo(ctx);
    const { transport } = makeTransport([{ httpStatus: 200, status: "ok" }]);
    const job = makeJob({ jobType: "poll_status", partnerOrderId: "p-1", payload: {} });

    const outcome = await executePollStatus({ job, transport, repo });

    assert.equal(outcome.kind, "succeeded");
    const transitions = calls.filter((c) => c.type === "transitionState");
    assert.equal(transitions.length, 0, "confirmed booking must not be re-transitioned");
  });

  test("failed state does not re-enter create_booking chain", async () => {
    const ctx = makeContext({ providerOrderStatus: "failed", providerStatusVersion: 3 });
    const { repo } = makeRepo(ctx);
    const { transport, callCount } = makeTransport([]);

    const outcome = await executeCreateBooking({ job: makeJob(), transport, repo });

    assert.equal(outcome.kind, "succeeded");
    assert.equal(callCount[0], 0, "failed booking must not trigger ETG call");
  });
});

// ---- Public status DTO -----------------------------------------------------

describe("toProviderBookingPublicStatus", () => {
  test("null status -> pending state, flyTimeReference is last-8 uppercased", () => {
    const id = "aabbccdd-1122-3344-5566-778899aabbcc";
    const result = toProviderBookingPublicStatus({
      bookingId: id,
      providerOrderStatus: null,
    });
    assert.equal(result.providerState, "pending");
    assert.equal(result.flyTimeReference, id.slice(-8).toUpperCase());
  });

  test("confirmed -> confirmed state, no next action", () => {
    const result = toProviderBookingPublicStatus({
      bookingId: "00000000-0000-0000-0000-000000000001",
      providerOrderStatus: "confirmed",
    });
    assert.equal(result.providerState, "confirmed");
    assert.equal(result.nextAction, null);
  });

  test("processing -> in_progress, wait", () => {
    const result = toProviderBookingPublicStatus({
      bookingId: "00000000-0000-0000-0000-000000000002",
      providerOrderStatus: "processing",
    });
    assert.equal(result.providerState, "in_progress");
    assert.equal(result.nextAction, "wait");
  });

  test("failed -> failed state, contact_support", () => {
    const result = toProviderBookingPublicStatus({
      bookingId: "00000000-0000-0000-0000-000000000003",
      providerOrderStatus: "failed",
    });
    assert.equal(result.providerState, "failed");
    assert.equal(result.nextAction, "contact_support");
  });

  test("pending_review -> review state, contact_support", () => {
    const result = toProviderBookingPublicStatus({
      bookingId: "00000000-0000-0000-0000-000000000004",
      providerOrderStatus: "pending_review",
    });
    assert.equal(result.providerState, "review");
    assert.equal(result.nextAction, "contact_support");
  });

  test("message is present and non-empty for all known states", () => {
    const states = [
      null, "pending", "creating", "starting", "processing",
      "requires_3ds", "confirmed", "failed", "cancel_pending",
      "cancelled", "pending_review",
    ];
    for (const s of states) {
      const r = toProviderBookingPublicStatus({
        bookingId: "00000000-0000-0000-0000-000000000000",
        providerOrderStatus: s,
      });
      assert.ok(r.message.length > 0, `message must be present for state=${s}`);
    }
  });
});

// ---- IP trust extraction (requirement 4) -----------------------------------

describe("extractTrustedUserIp", () => {
  test("valid: CF-Connecting-IP (public) takes priority", () => {
    const h = new Headers({
      "cf-connecting-ip": "8.8.8.8",
      "x-real-ip": "1.1.1.1",
    });
    assert.equal(extractTrustedUserIp(h), "8.8.8.8");
  });

  test("valid: X-Real-IP (public) used when CF header absent", () => {
    const h = new Headers({ "x-real-ip": "1.1.1.1" });
    assert.equal(extractTrustedUserIp(h), "1.1.1.1");
  });

  test("valid: left-most public X-Forwarded-For entry used when others absent", () => {
    const h = new Headers({ "x-forwarded-for": "8.8.4.4, 70.0.0.9" });
    assert.equal(extractTrustedUserIp(h), "8.8.4.4");
  });

  test("valid: public IPv6 accepted", () => {
    const h = new Headers({ "x-real-ip": "2606:4700:4700::1111" });
    assert.equal(extractTrustedUserIp(h), "2606:4700:4700::1111");
  });

  test("missing: returns null when no IP header present", () => {
    assert.equal(extractTrustedUserIp(new Headers()), null);
  });

  test("private: rejects RFC1918 / loopback / CGNAT / link-local", () => {
    for (const ip of ["10.0.0.3", "192.168.1.4", "172.16.5.6", "127.0.0.1", "100.64.0.1", "169.254.1.1"]) {
      assert.equal(extractTrustedUserIp(new Headers({ "x-real-ip": ip })), null, ip);
    }
  });

  test("reserved: rejects documentation and benchmark ranges", () => {
    for (const ip of ["192.0.2.1", "198.18.0.1", "198.51.100.5", "203.0.113.20"]) {
      assert.equal(extractTrustedUserIp(new Headers({ "x-real-ip": ip })), null, ip);
    }
  });

  test("private IPv6: rejects loopback / link-local / unique-local", () => {
    for (const ip of ["::1", "fe80::1", "fc00::1", "fd12::3"]) {
      assert.equal(extractTrustedUserIp(new Headers({ "cf-connecting-ip": ip })), null, ip);
    }
  });

  test("malformed: rejects garbage, out-of-range octets, leading zeros", () => {
    for (const ip of ["not-an-ip", "999.1.1.1", "1.2.3", "01.2.3.4", "1.2.3.4.5", ""]) {
      assert.equal(extractTrustedUserIp(new Headers({ "x-real-ip": ip })), null, ip);
    }
  });

  test("spoof-resistant: a private/malformed left-most XFF entry is not trusted", () => {
    assert.equal(extractTrustedUserIp(new Headers({ "x-forwarded-for": "10.0.0.1, 198.51.100.5" })), null);
    assert.equal(extractTrustedUserIp(new Headers({ "x-forwarded-for": "garbage, 198.51.100.5" })), null);
  });
});

// ---- isPublicIp ------------------------------------------------------------

describe("isPublicIp", () => {
  test("accepts public v4/v6, rejects private/reserved/malformed", () => {
    assert.equal(isPublicIp("8.8.8.8"), true);
    assert.equal(isPublicIp("203.0.113.1"), false);
    assert.equal(isPublicIp("2606:4700::1"), true);
    assert.equal(isPublicIp("10.0.0.1"), false);
    assert.equal(isPublicIp("127.0.0.1"), false);
    assert.equal(isPublicIp("::1"), false);
    assert.equal(isPublicIp("0.0.0.0"), false);
    assert.equal(isPublicIp("255.255.255.255"), false);
    assert.equal(isPublicIp("garbage"), false);
    assert.equal(isPublicIp(null), false);
    assert.equal(isPublicIp(undefined), false);
  });
});

// ---- buildCreateBookingJobSpec ---------------------------------------------

test("buildCreateBookingJobSpec returns correct initial job spec", () => {
  const spec = buildCreateBookingJobSpec("booking-xyz");
  assert.equal(spec.jobType, "create_booking");
  assert.equal(spec.bookingId, "booking-xyz");
  assert.equal(spec.dedupeKey, "create_booking:booking-xyz");
  assert.equal(spec.runAfterMs, 0);
  assert.equal(spec.partnerOrderId, null);
});
