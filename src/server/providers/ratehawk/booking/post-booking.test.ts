import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  executeCancelBooking,
  executeOrderInfoSync,
  extractOrderInfoDetails,
  type PostBookingRepository,
} from "./post-booking.ts";
import type {
  BookingContext,
  BookingJob,
  OrchestratorTransport,
  OrchestratorTransportResult,
  StatePatch,
} from "./orchestrator.ts";
import type { BookingState } from "./contracts.ts";
import { evaluateRefundEligibility } from "./refund-policy.ts";
import {
  evaluateCancellationRequest,
  mapCancellationOutcome,
} from "./cancellation-guards.ts";

// ---- Shared mocks ----------------------------------------------------------

function makeContext(overrides?: Partial<BookingContext>): BookingContext {
  return {
    bookingId: "booking-1",
    providerOrderStatus: "confirmed",
    providerStatusVersion: 3,
    providerAttemptCount: 1,
    providerPartnerOrderId: "partner-1",
    providerBookingCutoffAt: null,
    prebookHash: "p-hash",
    customerEmail: "guest@example.com",
    customerFirstName: "Test",
    customerLastName: "User",
    customerPhone: "+15551234567",
    travelersCount: 1,
    language: "en",
    paymentType: "hotel",
    userIp: "203.0.113.7",
    occupancy: [{ adults: 1, childrenAges: [] }],
    providerPaymentTypes: [],
    isGenderSpecificationRequired: false,
    ...overrides,
  };
}

function makeJob(overrides?: Partial<BookingJob>): BookingJob {
  return {
    id: "job-1",
    bookingId: "booking-1",
    jobType: "cancel_booking",
    status: "leased",
    attempts: 1,
    maxAttempts: 2,
    partnerOrderId: "partner-1",
    payload: {},
    ...overrides,
  };
}

type RepoCall =
  | { type: "transitionState"; toState: BookingState; patch?: StatePatch }
  | { type: "appendEvent"; step: string; outcome: string }
  | { type: "enqueueJob"; jobType: string }
  | { type: "storeOrderInfo"; data: unknown }
  | { type: "setRefundState"; state: string };

function makeRepo(
  ctx: BookingContext | null,
  transitionOk = true,
): { repo: PostBookingRepository; calls: RepoCall[] } {
  const calls: RepoCall[] = [];
  const repo: PostBookingRepository = {
    async getBookingContext() { return ctx; },
    async transitionState({ toState, patch }) {
      calls.push({ type: "transitionState", toState, patch });
      return transitionOk;
    },
    async createAttempt() { return "attempt"; },
    async updateAttemptStatus() {},
    async appendEvent(e) { calls.push({ type: "appendEvent", step: e.step, outcome: e.outcome }); },
    async enqueueJob(j) { calls.push({ type: "enqueueJob", jobType: j.jobType }); return "j"; },
    async storeOrderInfo(d) { calls.push({ type: "storeOrderInfo", data: d }); },
    async setRefundState(_id, state) { calls.push({ type: "setRefundState", state }); },
    async storeCreateBookingResult() {},
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

// ---- Cancellation lifecycle ------------------------------------------------

describe("executeCancelBooking", () => {
  test("confirmed -> cancel_pending -> cancelled on ok; refund review + order_info enqueued", async () => {
    const { repo, calls } = makeRepo(makeContext({ providerOrderStatus: "confirmed" }));
    const { transport } = makeTransport([{ httpStatus: 200, status: "ok" }]);

    const out = await executeCancelBooking({ job: makeJob(), transport, repo });

    assert.equal(out.kind, "succeeded");
    const transitions = calls.filter((c) => c.type === "transitionState") as Array<{ toState: string }>;
    assert.equal(transitions[0].toState, "cancel_pending");
    assert.equal(transitions[1].toState, "cancelled");
    assert.ok(calls.some((c) => c.type === "setRefundState" && c.state === "review"));
    assert.ok(calls.some((c) => c.type === "enqueueJob" && c.jobType === "sync_order_info"));
  });

  test("already cancelled -> succeeded (idempotent), no ETG call", async () => {
    const { repo } = makeRepo(makeContext({ providerOrderStatus: "cancelled" }));
    const { transport, callCount } = makeTransport([]);
    const out = await executeCancelBooking({ job: makeJob(), transport, repo });
    assert.equal(out.kind, "succeeded");
    assert.equal(callCount[0], 0);
  });

  test("non-cancellable state -> terminal, no ETG call", async () => {
    const { repo } = makeRepo(makeContext({ providerOrderStatus: "processing" }));
    const { transport, callCount } = makeTransport([]);
    const out = await executeCancelBooking({ job: makeJob(), transport, repo });
    assert.equal(out.kind, "terminal");
    assert.equal(out.errorCode, "not_cancellable");
    assert.equal(callCount[0], 0);
  });

  test("duplicate concurrent cancel: confirmed lock lost -> requeue, no ETG call", async () => {
    const { repo } = makeRepo(makeContext({ providerOrderStatus: "confirmed" }), false);
    const { transport, callCount } = makeTransport([]);
    const out = await executeCancelBooking({ job: makeJob(), transport, repo });
    assert.equal(out.kind, "requeue");
    assert.equal(callCount[0], 0, "must not call ETG when the cancel lock is lost");
  });

  test("timeout on first attempt (attempts < max) -> requeue exactly once", async () => {
    const { repo } = makeRepo(makeContext({ providerOrderStatus: "cancel_pending" }));
    const { transport } = makeTransport([{ httpStatus: 200, status: null, error: "timeout" }]);
    const out = await executeCancelBooking({
      job: makeJob({ attempts: 1, maxAttempts: 2 }),
      transport,
      repo,
    });
    assert.equal(out.kind, "requeue");
  });

  test("timeout on final attempt (attempts >= max) -> pending_review + order_info reconcile", async () => {
    const { repo, calls } = makeRepo(makeContext({ providerOrderStatus: "cancel_pending" }));
    const { transport } = makeTransport([{ httpStatus: 200, status: null, error: "timeout" }]);
    const out = await executeCancelBooking({
      job: makeJob({ attempts: 2, maxAttempts: 2 }),
      transport,
      repo,
    });
    assert.equal(out.kind, "terminal");
    assert.equal(out.errorCode, "cancel_timeout_unresolved");
    const lastTransition = (calls.filter((c) => c.type === "transitionState").at(-1)) as { toState: string };
    assert.equal(lastTransition.toState, "pending_review");
    assert.ok(calls.some((c) => c.type === "enqueueJob" && c.jobType === "sync_order_info"));
  });

  test("coded error -> pending_review (needs human, not auto-fail)", async () => {
    const { repo, calls } = makeRepo(makeContext({ providerOrderStatus: "cancel_pending" }));
    const { transport } = makeTransport([{ httpStatus: 200, status: null, error: "provider" }]);
    const out = await executeCancelBooking({ job: makeJob(), transport, repo });
    assert.equal(out.kind, "terminal");
    const lastTransition = (calls.filter((c) => c.type === "transitionState").at(-1)) as { toState: string };
    assert.equal(lastTransition.toState, "pending_review");
    assert.ok(!calls.some((c) => c.type === "setRefundState"), "no refund routing on failed cancel");
  });

  test("missing partner_order_id -> pending_review terminal", async () => {
    const { repo } = makeRepo(
      makeContext({ providerOrderStatus: "cancel_pending", providerPartnerOrderId: null }),
    );
    const { transport, callCount } = makeTransport([]);
    const out = await executeCancelBooking({
      job: makeJob({ partnerOrderId: null }),
      transport,
      repo,
    });
    assert.equal(out.kind, "terminal");
    assert.equal(out.errorCode, "missing_partner_order_id");
    assert.equal(callCount[0], 0);
  });
});

// ---- Order info reconciliation ---------------------------------------------

describe("executeOrderInfoSync", () => {
  test("ok + documented HCN -> stores HCN, succeeds, never changes booking state", async () => {
    const { repo, calls } = makeRepo(makeContext({ providerOrderStatus: "confirmed" }));
    const { transport } = makeTransport([
      {
        httpStatus: 200,
        status: "ok",
        data: { orders: [{ hotel_data: { order_id: "HCN-123" } }] },
      },
    ]);

    const out = await executeOrderInfoSync({
      job: makeJob({ jobType: "sync_order_info", payload: {} }),
      transport,
      repo,
    });

    assert.equal(out.kind, "succeeded");
    const store = calls.find((c) => c.type === "storeOrderInfo") as { data: { hotelConfirmationNumber: string } };
    assert.equal(store.data.hotelConfirmationNumber, "HCN-123");
    assert.equal(calls.filter((c) => c.type === "transitionState").length, 0, "order_info never transitions state");
  });

  test("ok but HCN not synced yet -> reconcile (requeue), NOT fake success", async () => {
    const { repo, calls } = makeRepo(makeContext({ providerOrderStatus: "confirmed" }));
    const { transport } = makeTransport([
      { httpStatus: 200, status: "ok", data: { orders: [{ hotel_data: {} }] } },
    ]);
    const out = await executeOrderInfoSync({
      job: makeJob({ jobType: "sync_order_info", attempts: 1, maxAttempts: 6 }),
      transport,
      repo,
    });
    assert.equal(out.kind, "requeue");
    // It still persists what it has (synced_at), but does not claim completion.
    assert.ok(calls.some((c) => c.type === "storeOrderInfo"));
  });

  test("ok but HCN never arrives at max attempts -> terminal manual-review, not success", async () => {
    const { repo } = makeRepo(makeContext({ providerOrderStatus: "confirmed" }));
    const { transport } = makeTransport([
      { httpStatus: 200, status: "ok", data: { orders: [{ hotel_data: {} }] } },
    ]);
    const out = await executeOrderInfoSync({
      job: makeJob({ jobType: "sync_order_info", attempts: 6, maxAttempts: 6 }),
      transport,
      repo,
    });
    assert.equal(out.kind, "terminal");
    assert.equal(out.errorCode, "order_info_hcn_unavailable");
  });

  test("poll under max -> requeue (bounded)", async () => {
    const { repo } = makeRepo(makeContext());
    const { transport } = makeTransport([{ httpStatus: 200, status: null, error: "timeout" }]);
    const out = await executeOrderInfoSync({
      job: makeJob({ jobType: "sync_order_info", attempts: 1, maxAttempts: 6 }),
      transport,
      repo,
    });
    assert.equal(out.kind, "requeue");
  });

  test("poll at max -> terminal order_info_unavailable (no infinite loop)", async () => {
    const { repo } = makeRepo(makeContext());
    const { transport } = makeTransport([{ httpStatus: 503, status: null }]);
    const out = await executeOrderInfoSync({
      job: makeJob({ jobType: "sync_order_info", attempts: 6, maxAttempts: 6 }),
      transport,
      repo,
    });
    assert.equal(out.kind, "terminal");
    assert.equal(out.errorCode, "order_info_unavailable");
  });

  test("coded error -> terminal, booking state untouched", async () => {
    const { repo, calls } = makeRepo(makeContext({ providerOrderStatus: "confirmed" }));
    const { transport } = makeTransport([{ httpStatus: 200, status: null, error: "not_found" }]);
    const out = await executeOrderInfoSync({
      job: makeJob({ jobType: "sync_order_info" }),
      transport,
      repo,
    });
    assert.equal(out.kind, "terminal");
    assert.equal(calls.filter((c) => c.type === "transitionState").length, 0);
  });
});

// ---- extractOrderInfoDetails (no PII) --------------------------------------

describe("extractOrderInfoDetails", () => {
  test("reads ONLY the documented hotel_data.order_id for HCN; ignores guest PII", () => {
    const details = extractOrderInfoDetails({
      orders: [
        {
          hotel_data: { order_id: "HCN-999" },
          guests: [{ first_name: "Jane", last_name: "Doe", passport: "X1234" }],
          customer_email: "jane@example.com",
        },
      ],
    });
    assert.equal(details.hotelConfirmationNumber, "HCN-999");
    assert.equal(details.complete, true);
    const serialized = JSON.stringify(details);
    assert.ok(!serialized.includes("Jane"));
    assert.ok(!serialized.includes("jane@example.com"));
    assert.ok(!serialized.includes("X1234"));
  });

  test("does NOT guess HCN from undocumented keys -> stays null + incomplete", () => {
    const details = extractOrderInfoDetails({
      orders: [
        {
          // speculative keys the prior code guessed from:
          hotel_confirmation_number: "GUESS-1",
          supplier_confirmation_number: "GUESS-2",
          hotel_confirmation_id: "GUESS-3",
        },
      ],
    });
    assert.equal(details.hotelConfirmationNumber, null);
    assert.equal(details.complete, false);
  });

  test("penalty is never guessed from order-info -> stays null (unknown)", () => {
    const details = extractOrderInfoDetails({
      orders: [{ hotel_data: { order_id: "HCN-1" }, penalty_amount: 25, cancellation_info: { penalty_amount: 30 } }],
    });
    assert.equal(details.penaltyAmount, null, "penalty not collapsed from a guessed field");
    assert.equal(details.penaltyCurrency, null);
  });

  test("missing data.orders envelope -> all null, incomplete (requires reconciliation)", () => {
    assert.deepEqual(extractOrderInfoDetails(null), {
      hotelConfirmationNumber: null,
      penaltyAmount: null,
      penaltyCurrency: null,
      complete: false,
    });
    assert.deepEqual(extractOrderInfoDetails("nope"), {
      hotelConfirmationNumber: null,
      penaltyAmount: null,
      penaltyCurrency: null,
      complete: false,
    });
    // A bare object without the documented orders[] envelope is not parsed.
    assert.equal(extractOrderInfoDetails({ hotel_data: { order_id: "X" } }).complete, false);
  });
});

// ---- Refund policy ---------------------------------------------------------

describe("evaluateRefundEligibility", () => {
  test("unpaid -> none", () => {
    const d = evaluateRefundEligibility({
      paymentStatus: "pending",
      paidAmount: null,
      paidCurrency: null,
      cancellationPenaltyAmount: null,
      cancellationPenaltyCurrency: null,
      providerOrderStatus: "cancelled",
    });
    assert.equal(d.action, "none");
  });

  test("paid but order not cancelled -> none", () => {
    const d = evaluateRefundEligibility({
      paymentStatus: "paid",
      paidAmount: 100,
      paidCurrency: "USD",
      cancellationPenaltyAmount: 0,
      cancellationPenaltyCurrency: "USD",
      providerOrderStatus: "confirmed",
    });
    assert.equal(d.action, "none");
  });

  test("paid + cancelled -> review with paid minus penalty, never auto", () => {
    const d = evaluateRefundEligibility({
      paymentStatus: "paid",
      paidAmount: 100,
      paidCurrency: "usd",
      cancellationPenaltyAmount: 30,
      cancellationPenaltyCurrency: "USD",
      providerOrderStatus: "cancelled",
    });
    assert.equal(d.action, "review");
    assert.equal(d.suggestedAmount, 70);
    assert.equal(d.currency, "USD");
  });

  test("currency mismatch -> review with no suggested amount", () => {
    const d = evaluateRefundEligibility({
      paymentStatus: "paid",
      paidAmount: 100,
      paidCurrency: "USD",
      cancellationPenaltyAmount: 30,
      cancellationPenaltyCurrency: "EUR",
      providerOrderStatus: "cancelled",
    });
    assert.equal(d.action, "review");
    assert.equal(d.suggestedAmount, null);
  });

  test("penalty UNKNOWN (null) -> review with NO suggested amount (never assume zero)", () => {
    const d = evaluateRefundEligibility({
      paymentStatus: "paid",
      paidAmount: 100,
      paidCurrency: "USD",
      cancellationPenaltyAmount: null,
      cancellationPenaltyCurrency: null,
      providerOrderStatus: "cancelled",
    });
    assert.equal(d.action, "review");
    assert.equal(d.reason, "penalty_unknown");
    assert.equal(d.suggestedAmount, null, "unknown penalty must not be treated as zero");
  });

  test("penalty EXPLICIT zero -> review with full amount (only when ETG returns 0)", () => {
    const d = evaluateRefundEligibility({
      paymentStatus: "paid",
      paidAmount: 100,
      paidCurrency: "USD",
      cancellationPenaltyAmount: 0,
      cancellationPenaltyCurrency: "USD",
      providerOrderStatus: "cancelled",
    });
    assert.equal(d.action, "review");
    assert.equal(d.suggestedAmount, 100);
  });

  test("never returns an auto-refund action", () => {
    const actions = new Set<string>();
    for (const status of ["paid", "pending", null]) {
      for (const order of ["cancelled", "confirmed", null]) {
        const d = evaluateRefundEligibility({
          paymentStatus: status,
          paidAmount: 100,
          paidCurrency: "USD",
          cancellationPenaltyAmount: 10,
          cancellationPenaltyCurrency: "USD",
          providerOrderStatus: order,
        });
        actions.add(d.action);
      }
    }
    assert.ok(!actions.has("auto" as never));
    assert.deepEqual([...actions].sort(), ["none", "review"]);
  });
});

// ---- Cancellation guards (ownership + state) -------------------------------

describe("evaluateCancellationRequest", () => {
  test("admin may cancel a confirmed booking", () => {
    const d = evaluateCancellationRequest({
      providerOrderStatus: "confirmed",
      bookingCustomerEmail: "owner@example.com",
      requester: { kind: "admin" },
    });
    assert.equal(d.allowed, true);
  });

  test("customer may cancel only their own confirmed booking", () => {
    const ok = evaluateCancellationRequest({
      providerOrderStatus: "confirmed",
      bookingCustomerEmail: "Owner@Example.com",
      requester: { kind: "customer", verifiedEmail: "owner@example.com" },
    });
    assert.equal(ok.allowed, true);
  });

  test("customer cancelling another person's booking -> ownership_failed", () => {
    const d = evaluateCancellationRequest({
      providerOrderStatus: "confirmed",
      bookingCustomerEmail: "owner@example.com",
      requester: { kind: "customer", verifiedEmail: "attacker@example.com" },
    });
    assert.equal(d.allowed, false);
    assert.equal(d.allowed === false && d.code, "ownership_failed");
  });

  test("customer with no verified identity -> no_verified_identity", () => {
    const d = evaluateCancellationRequest({
      providerOrderStatus: "confirmed",
      bookingCustomerEmail: "owner@example.com",
      requester: { kind: "customer", verifiedEmail: null },
    });
    assert.equal(d.allowed === false && d.code, "no_verified_identity");
  });

  test("cancel_pending -> already_cancelling (no duplicate)", () => {
    const d = evaluateCancellationRequest({
      providerOrderStatus: "cancel_pending",
      bookingCustomerEmail: null,
      requester: { kind: "admin" },
    });
    assert.equal(d.allowed === false && d.code, "already_cancelling");
  });

  test("cancelled -> already_terminal", () => {
    const d = evaluateCancellationRequest({
      providerOrderStatus: "cancelled",
      bookingCustomerEmail: null,
      requester: { kind: "admin" },
    });
    assert.equal(d.allowed === false && d.code, "already_terminal");
  });

  test("processing -> not_confirmed", () => {
    const d = evaluateCancellationRequest({
      providerOrderStatus: "processing",
      bookingCustomerEmail: null,
      requester: { kind: "admin" },
    });
    assert.equal(d.allowed === false && d.code, "not_confirmed");
  });
});

// ---- Cancel route atomicity (RPC) ------------------------------------------

describe("cancel route atomicity", () => {
  test("mapCancellationOutcome maps every RPC result to the right HTTP status", () => {
    assert.deepEqual(mapCancellationOutcome("requested"), {
      httpStatus: 200,
      status: "cancellation_requested",
    });
    assert.equal(mapCancellationOutcome("already_cancelling").httpStatus, 409);
    assert.equal(mapCancellationOutcome("already_terminal").httpStatus, 409);
    assert.equal(mapCancellationOutcome("not_confirmed").httpStatus, 409);
    assert.equal(mapCancellationOutcome("missing_partner_order_id").httpStatus, 409);
    assert.equal(mapCancellationOutcome("not_found").httpStatus, 404);
    assert.equal(mapCancellationOutcome(null).httpStatus, 500);
    assert.equal(mapCancellationOutcome("garbage").httpStatus, 500);
  });

  test("migration defines an ATOMIC cancel RPC: state transition AND job insert in one function", () => {
    const sql = readFileSync(
      "supabase/migrations/20260622100000_provider_postbooking.sql",
      "utf8",
    );

    // The atomic function must exist.
    assert.match(sql, /create or replace function public\.request_provider_cancellation/);

    // Both the cancel_pending transition AND the durable cancel_booking job
    // insert must live inside that single function body (one transaction), so a
    // booking can never reach cancel_pending without its durable job.
    const fnStart = sql.indexOf("function public.request_provider_cancellation");
    const fnBody = sql.slice(fnStart);
    assert.match(fnBody, /provider_order_status\s*=\s*'cancel_pending'/);
    assert.match(fnBody, /insert into public\.provider_booking_jobs/);
    assert.match(fnBody, /'cancel_booking'/);

    // The partner_order_id guard must run BEFORE the cancel_pending transition.
    const guardIdx = fnBody.indexOf("missing_partner_order_id");
    const transitionIdx = fnBody.search(/provider_order_status\s*=\s*'cancel_pending'/);
    assert.ok(guardIdx > -1, "missing_partner_order_id guard present");
    assert.ok(
      guardIdx < transitionIdx,
      "partner_order_id is validated before moving to cancel_pending",
    );

    // Execute is granted to service_role.
    assert.match(sql, /grant execute on function public\.request_provider_cancellation\(uuid, text\)\s*\n?\s*to service_role/);
  });

  test("trip_option_selections.status is added in the booking-state migration the DAL depends on", () => {
    const sql = readFileSync(
      "supabase/migrations/20260613090000_provider_booking_state.sql",
      "utf8",
    );
    assert.match(
      sql,
      /alter table public\.trip_option_selections\s+add column if not exists status text not null default 'selected'/,
    );
    assert.match(sql, /check \(status in \('selected', 'dismissed', 'expired'\)\)/);
    assert.match(sql, /trip_option_selections_session_status_idx/);
  });

  test("jobs table carries lease fields (locked_at + leased_until) for crash-safe claiming", () => {
    const sql = readFileSync(
      "supabase/migrations/20260613090000_provider_booking_state.sql",
      "utf8",
    );
    assert.match(sql, /lease_owner text/);
    assert.match(sql, /leased_until timestamptz/);
    assert.match(sql, /locked_at timestamptz/);
    // dedupe uniqueness backs idempotent enqueue.
    assert.match(sql, /provider_booking_jobs_dedupe_uidx[\s\S]*unique|unique index[\s\S]*dedupe_key/);
  });
});

// ---- Webhook receipt state migration (fix 1) -------------------------------

describe("webhook receipt processing-state migration", () => {
  test("receipt table has lifecycle + lease columns", () => {
    const sql = readFileSync(
      "supabase/migrations/20260622090000_provider_booking_webhook_events.sql",
      "utf8",
    );
    assert.match(sql, /status text not null default 'received'/);
    assert.match(sql, /check \(status in \(\s*'received', 'processing', 'processed', 'failed'\s*\)\)/);
    assert.match(sql, /attempt_count integer not null default 0/);
    assert.match(sql, /locked_until timestamptz/);
    assert.match(sql, /locked_by text/);
    assert.match(sql, /processed_at timestamptz/);
    assert.match(sql, /error_message text/);
    // dedupe uniqueness still enforces at-most-once recording.
    assert.match(sql, /provider_booking_webhook_events_dedupe_uidx/);
  });
});
