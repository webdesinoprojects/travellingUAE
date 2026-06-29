import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  handleEtgWebhook,
  extractWebhookFields,
  MAX_WEBHOOK_BODY_BYTES,
  type WebhookEventStore,
  type WebhookReceipt,
  type WebhookRequest,
  type WebhookHandlerDeps,
} from "./webhook-handler.ts";
import { computeEtgSignature, computeWebhookDedupeKey } from "./webhook-signature.ts";
import type { BookingContext, BookingRepository } from "./orchestrator.ts";
import type { BookingState } from "./contracts.ts";

const API_KEY = "test-api-key-token";
const NOW_SECONDS = 1_700_000_000;

function makeBooking(overrides?: Partial<BookingContext>): BookingContext {
  return {
    bookingId: "booking-1",
    providerOrderStatus: "processing",
    providerStatusVersion: 2,
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

type RepoCall =
  | { type: "transitionState"; toState: BookingState }
  | { type: "appendEvent" }
  | { type: "enqueueJob"; jobType: string };

function makeRepo(transitionOk = true): { repo: BookingRepository; calls: RepoCall[] } {
  const calls: RepoCall[] = [];
  const repo: BookingRepository = {
    async getBookingContext() { return null; },
    async transitionState({ toState }) {
      calls.push({ type: "transitionState", toState });
      return transitionOk;
    },
    async createAttempt() { return "attempt"; },
    async updateAttemptStatus() {},
    async appendEvent() { calls.push({ type: "appendEvent" }); },
    async enqueueJob(job) {
      calls.push({ type: "enqueueJob", jobType: job.jobType });
      return "job-id";
    },
    async storeCreateBookingResult() {},
  };
  return { repo, calls };
}

type ReceiptRow = {
  receipt: WebhookReceipt;
  status: "processing" | "processed" | "failed";
  attemptCount: number;
  httpStatus?: number;
  errorMessage?: string;
};

function makeStore(
  booking: BookingContext | null,
  opts?: { failClaim?: boolean; seed?: { dedupeKey: string; status: "processed" | "failed" } },
): {
  store: WebhookEventStore;
  receipts: Map<string, ReceiptRow>;
} {
  const receipts = new Map<string, ReceiptRow>();
  if (opts?.seed) {
    receipts.set(opts.seed.dedupeKey, {
      receipt: {
        dedupeKey: opts.seed.dedupeKey,
        bookingId: null,
        partnerOrderId: "partner-1",
        rawStatus: "completed",
        normalizedOutcome: "success",
        signatureValid: true,
      },
      status: opts.seed.status,
      attemptCount: 1,
    });
  }

  const store: WebhookEventStore = {
    async claimReceipt(receipt) {
      if (opts?.failClaim) throw new Error("db down");
      const existing = receipts.get(receipt.dedupeKey);
      if (!existing) {
        receipts.set(receipt.dedupeKey, { receipt, status: "processing", attemptCount: 1 });
        return "claimed";
      }
      if (existing.status === "processed") return "already_processed";
      if (existing.status === "processing") return "in_progress";
      // 'failed' -> reclaim and retry.
      existing.status = "processing";
      existing.attemptCount += 1;
      return "claimed";
    },
    async markProcessed(dedupeKey, httpStatus, bookingId) {
      const e = receipts.get(dedupeKey);
      if (e) {
        e.status = "processed";
        e.httpStatus = httpStatus;
        if (bookingId) e.receipt.bookingId = bookingId;
      }
    },
    async markFailed(dedupeKey, httpStatus, errorMessage) {
      const e = receipts.get(dedupeKey);
      if (e) {
        e.status = "failed";
        e.httpStatus = httpStatus;
        e.errorMessage = errorMessage;
      }
    },
    async getBookingByPartnerOrderId() {
      return booking;
    },
  };

  return { store, receipts };
}

/**
 * Build the OFFICIAL nested ETG webhook payload:
 *   { data: { partner_order_id, status }, signature: { signature, timestamp, token } }
 * with a NUMERIC timestamp. HMAC is over String(timestamp) + token.
 */
function signedRequest(input: {
  timestampNum?: number;
  token?: string;
  partnerOrderId?: string;
  status?: string;
  env?: string;
  badSignature?: boolean;
  contentType?: string | null;
  bodyText?: string;
}): WebhookRequest {
  const timestampNum = input.timestampNum ?? NOW_SECONDS;
  const token = input.token ?? "nonce-token-abc";
  const signature = input.badSignature
    ? "deadbeef"
    : computeEtgSignature(String(timestampNum), token, API_KEY);

  const body: Record<string, unknown> = {
    data: {
      partner_order_id: input.partnerOrderId ?? "partner-1",
      status: input.status ?? "completed",
    },
    signature: { signature, timestamp: timestampNum, token },
  };
  if (input.env) body.environment = input.env;

  return {
    contentType: input.contentType === undefined ? "application/json" : input.contentType,
    bodyText: input.bodyText ?? JSON.stringify(body),
    getHeader: () => null,
  };
}

function deps(
  repo: BookingRepository,
  store: WebhookEventStore,
  env = "test",
): WebhookHandlerDeps {
  return { repo, store, apiKey: API_KEY, ratehawkEnv: env, nowSeconds: NOW_SECONDS };
}

// ---- Official payload happy path -------------------------------------------

describe("handleEtgWebhook official ETG payload", () => {
  test("exact nested payload, numeric timestamp, status 'completed' -> confirmed", async () => {
    const { repo, calls } = makeRepo();
    const { store, receipts } = makeStore(makeBooking());

    // Construct the literal official shape to be unambiguous.
    const timestamp = NOW_SECONDS; // number
    const token = "x".repeat(50);
    const signature = computeEtgSignature(String(timestamp), token, API_KEY);
    const bodyText = JSON.stringify({
      data: { partner_order_id: "partner-1", status: "completed" },
      signature: { signature, timestamp, token },
    });

    const res = await handleEtgWebhook(
      { contentType: "application/json", bodyText, getHeader: () => null },
      deps(repo, store),
    );

    assert.equal(res.httpStatus, 200);
    assert.equal(res.reason, "confirmed");
    const t = calls.find((c) => c.type === "transitionState") as { toState: string } | undefined;
    assert.equal(t?.toState, "confirmed");
    // Receipt is marked processed only after the side effect was applied.
    assert.equal([...receipts.values()][0].status, "processed");
  });

  test("status 'failed' -> 200, enqueues poll_status reconciliation (NOT order_info)", async () => {
    const { repo, calls } = makeRepo();
    const { store } = makeStore(makeBooking());

    const res = await handleEtgWebhook(signedRequest({ status: "failed" }), deps(repo, store));

    assert.equal(res.httpStatus, 200);
    assert.equal(res.reason, "failure_status_lookup_enqueued");
    // ETG: failure reason comes from Check booking process -> poll_status, not order/info.
    const enq = calls.filter((c) => c.type === "enqueueJob") as Array<{ jobType: string }>;
    assert.ok(enq.some((c) => c.jobType === "poll_status"), "must enqueue poll_status");
    assert.ok(!enq.some((c) => c.jobType === "sync_order_info"), "must NOT enqueue order_info");
    // Failure does not transition state directly; the status lookup is authoritative.
    assert.equal(calls.filter((c) => c.type === "transitionState").length, 0);
  });
});

// ---- Webhook status allowlist ----------------------------------------------

describe("handleEtgWebhook status allowlist (completed/failed only)", () => {
  test("'ok' is NOT success -> 200 durable manual review, no transition", async () => {
    const { repo, calls } = makeRepo();
    const { store, receipts } = makeStore(makeBooking());
    const res = await handleEtgWebhook(signedRequest({ status: "ok" }), deps(repo, store));
    assert.equal(res.httpStatus, 200);
    assert.equal(res.reason, "unknown_status_manual_review");
    // Durably recorded as 'unknown' for manual review; never treated as success.
    const row = [...receipts.values()][0];
    assert.equal(row.receipt.normalizedOutcome, "unknown");
    assert.equal(row.status, "processed");
    assert.equal(calls.filter((c) => c.type === "transitionState").length, 0);
  });

  test("'confirmed' is NOT accepted as success -> 200 manual review, no transition", async () => {
    const { repo, calls } = makeRepo();
    const { store, receipts } = makeStore(makeBooking());
    const res = await handleEtgWebhook(signedRequest({ status: "confirmed" }), deps(repo, store));
    assert.equal(res.httpStatus, 200);
    assert.equal(res.reason, "unknown_status_manual_review");
    assert.equal([...receipts.values()][0].receipt.normalizedOutcome, "unknown");
    assert.equal(calls.filter((c) => c.type === "transitionState").length, 0);
  });

  test("unknown status -> 200 durable manual review, no booking transition", async () => {
    const { repo, calls } = makeRepo();
    const { store, receipts } = makeStore(makeBooking());
    const res = await handleEtgWebhook(signedRequest({ status: "weird_value" }), deps(repo, store));
    assert.equal(res.httpStatus, 200);
    assert.equal(res.reason, "unknown_status_manual_review");
    assert.equal([...receipts.values()][0].receipt.normalizedOutcome, "unknown");
    assert.equal(calls.filter((c) => c.type === "transitionState").length, 0);
  });
});

// ---- Rejections ------------------------------------------------------------

describe("handleEtgWebhook rejections", () => {
  test("invalid signature -> 401, no receipt persisted, no side effects", async () => {
    const { repo, calls } = makeRepo();
    const { store, receipts } = makeStore(makeBooking());

    const res = await handleEtgWebhook(signedRequest({ badSignature: true }), deps(repo, store));

    assert.equal(res.httpStatus, 401);
    assert.equal(receipts.size, 0, "forged delivery must not be persisted");
    assert.equal(calls.length, 0, "no booking side effects");
  });

  test("stale timestamp -> 400", async () => {
    const { repo } = makeRepo();
    const { store } = makeStore(makeBooking());
    const res = await handleEtgWebhook(
      signedRequest({ timestampNum: NOW_SECONDS - 10_000 }),
      deps(repo, store),
    );
    assert.equal(res.httpStatus, 400);
    assert.equal(res.reason, "stale_timestamp");
  });

  test("wrong content type -> 400", async () => {
    const { repo } = makeRepo();
    const { store } = makeStore(makeBooking());
    const res = await handleEtgWebhook(
      signedRequest({ contentType: "text/plain" }),
      deps(repo, store),
    );
    assert.equal(res.httpStatus, 400);
    assert.equal(res.reason, "unsupported_content_type");
  });

  test("oversized body -> 400", async () => {
    const { repo } = makeRepo();
    const { store } = makeStore(makeBooking());
    const huge = "x".repeat(MAX_WEBHOOK_BODY_BYTES + 1);
    const res = await handleEtgWebhook(signedRequest({ bodyText: huge }), deps(repo, store));
    assert.equal(res.httpStatus, 400);
    assert.equal(res.reason, "body_too_large");
  });

  test("malformed JSON -> 400", async () => {
    const { repo } = makeRepo();
    const { store } = makeStore(makeBooking());
    const res = await handleEtgWebhook(signedRequest({ bodyText: "{not json" }), deps(repo, store));
    assert.equal(res.httpStatus, 400);
    assert.equal(res.reason, "malformed_body");
  });

  test("missing required fields -> 400", async () => {
    const { repo } = makeRepo();
    const { store } = makeStore(makeBooking());
    const res = await handleEtgWebhook(
      { contentType: "application/json", bodyText: JSON.stringify({ data: {} }), getHeader: () => null },
      deps(repo, store),
    );
    assert.equal(res.httpStatus, 400);
    assert.equal(res.reason, "missing_fields");
  });

  test("cross-environment callback -> 400", async () => {
    const { repo } = makeRepo();
    const { store } = makeStore(makeBooking());
    const res = await handleEtgWebhook(signedRequest({ env: "prod" }), deps(repo, store, "test"));
    assert.equal(res.httpStatus, 400);
    assert.equal(res.reason, "cross_environment");
  });
});

// ---- Idempotency / replay / race -------------------------------------------

describe("handleEtgWebhook idempotency", () => {
  test("duplicate valid delivery -> 200, no repeated side effects", async () => {
    const { repo, calls } = makeRepo();
    const { store } = makeStore(makeBooking());

    const req = signedRequest({ status: "completed" });
    const first = await handleEtgWebhook(req, deps(repo, store));
    const transitionsAfterFirst = calls.filter((c) => c.type === "transitionState").length;

    const second = await handleEtgWebhook(req, deps(repo, store));

    assert.equal(first.httpStatus, 200);
    assert.equal(second.httpStatus, 200);
    assert.equal(second.reason, "duplicate_ignored");
    assert.equal(
      calls.filter((c) => c.type === "transitionState").length,
      transitionsAfterFirst,
      "no second transition on replay",
    );
  });

  test("concurrent deliveries: one claims+applies, the other gets in_progress (500), not swallowed", async () => {
    const { repo, calls } = makeRepo();
    const { store } = makeStore(makeBooking());
    const req = signedRequest({ status: "completed" });

    const [a, b] = await Promise.all([
      handleEtgWebhook(req, deps(repo, store)),
      handleEtgWebhook(req, deps(repo, store)),
    ]);

    const reasons = [a.reason, b.reason].sort();
    assert.deepEqual(reasons, ["confirmed", "in_progress_retry"]);
    const statuses = [a.httpStatus, b.httpStatus].sort();
    assert.deepEqual(statuses, [200, 500]); // loser asks ETG to retry later
    assert.equal(calls.filter((c) => c.type === "transitionState").length, 1);
  });

  test("a previously FAILED receipt is re-claimed and retried, not swallowed", async () => {
    const token = "retry-token";
    const ts = NOW_SECONDS;
    const dedupeKey = computeWebhookDedupeKey(String(ts), token);
    const { repo, calls } = makeRepo();
    const { store, receipts } = makeStore(makeBooking(), { seed: { dedupeKey, status: "failed" } });

    const res = await handleEtgWebhook(
      signedRequest({ token, timestampNum: ts, status: "completed" }),
      deps(repo, store),
    );

    assert.equal(res.httpStatus, 200);
    assert.equal(res.reason, "confirmed");
    assert.equal(receipts.get(dedupeKey)!.status, "processed");
    assert.equal(receipts.get(dedupeKey)!.attemptCount, 2);
    assert.equal(calls.filter((c) => c.type === "transitionState").length, 1);
  });

  test("receipt claim persistence failure -> 500 (retryable)", async () => {
    const { repo } = makeRepo();
    const { store } = makeStore(makeBooking(), { failClaim: true });
    const res = await handleEtgWebhook(signedRequest({ status: "completed" }), deps(repo, store));
    assert.equal(res.httpStatus, 500);
  });
});

// ---- State guards / resurrection -------------------------------------------

describe("handleEtgWebhook state guards", () => {
  test("no matching booking -> 200, receipt processed, no transition", async () => {
    const { repo, calls } = makeRepo();
    const { store, receipts } = makeStore(null);
    const res = await handleEtgWebhook(signedRequest({ status: "completed" }), deps(repo, store));
    assert.equal(res.httpStatus, 200);
    assert.equal(res.reason, "no_matching_booking");
    assert.equal(calls.filter((c) => c.type === "transitionState").length, 0);
    assert.equal([...receipts.values()][0].status, "processed");
  });

  test("late failed webhook on confirmed booking -> 200 noop, no enqueue, no resurrection", async () => {
    const { repo, calls } = makeRepo();
    const { store } = makeStore(makeBooking({ providerOrderStatus: "confirmed" }));
    const res = await handleEtgWebhook(signedRequest({ status: "failed" }), deps(repo, store));
    assert.equal(res.httpStatus, 200);
    assert.equal(res.reason, "failed_terminal_noop");
    assert.equal(calls.filter((c) => c.type === "transitionState").length, 0);
    assert.equal(calls.filter((c) => c.type === "enqueueJob").length, 0);
  });

  test("late completed webhook on cancelled booking -> 200, no resurrection", async () => {
    const { repo, calls } = makeRepo();
    const { store } = makeStore(makeBooking({ providerOrderStatus: "cancelled" }));
    const res = await handleEtgWebhook(signedRequest({ status: "completed" }), deps(repo, store));
    assert.equal(res.httpStatus, 200);
    // reconcileToConfirmed sees a terminal record and does not transition it.
    assert.equal(calls.filter((c) => c.type === "transitionState").length, 0);
  });
});

// ---- No-secret guarantees --------------------------------------------------

describe("handleEtgWebhook no-secret guarantees", () => {
  test("dedupe key is a hash, not the raw token; receipt holds no secret", async () => {
    const { repo } = makeRepo();
    const { store, receipts } = makeStore(makeBooking());
    const token = "super-secret-nonce";
    const timestamp = NOW_SECONDS;

    await handleEtgWebhook(
      signedRequest({ token, timestampNum: timestamp, status: "completed" }),
      deps(repo, store),
    );

    const expectedKey = computeWebhookDedupeKey(String(timestamp), token);
    assert.ok(receipts.has(expectedKey), "dedupe key must be sha256(timestamp:token)");

    const signatureValue = computeEtgSignature(String(timestamp), token, API_KEY);
    const row = receipts.get(expectedKey)!;
    const serialized = JSON.stringify(row);
    assert.ok(!serialized.includes(token), "raw token must never be stored");
    assert.ok(!serialized.includes(signatureValue), "raw signature value must never be stored");
    assert.ok(!serialized.includes(API_KEY), "api key must never be stored");
    assert.ok(row.receipt.rawStatus.length <= 64, "status stored as short slug only");
  });
});

// ---- Field extraction (official nested shape) ------------------------------

describe("extractWebhookFields", () => {
  test("reads official nested signature object + data, numeric timestamp", () => {
    const fields = extractWebhookFields(
      {
        data: { partner_order_id: "po-1", status: "completed" },
        signature: { signature: "sig", timestamp: 1574146939, token: "tok" },
      },
      () => null,
    );
    assert.equal(fields?.partnerOrderId, "po-1");
    assert.equal(fields?.status, "completed");
    assert.equal(fields?.signature, "sig");
    assert.equal(fields?.token, "tok");
    assert.equal(fields?.timestamp, "1574146939", "numeric timestamp normalized to string");
  });

  test("accepts numeric-string timestamp too", () => {
    const fields = extractWebhookFields(
      {
        data: { partner_order_id: "po-1", status: "failed" },
        signature: { signature: "sig", timestamp: "1574146939", token: "tok" },
      },
      () => null,
    );
    assert.equal(fields?.timestamp, "1574146939");
  });

  test("returns null when a required field is missing", () => {
    const fields = extractWebhookFields(
      { data: { status: "completed" }, signature: { signature: "s", timestamp: 1, token: "t" } },
      () => null,
    );
    assert.equal(fields, null);
  });

  test("falls back to headers when signature object absent", () => {
    const headers: Record<string, string> = {
      "x-signature": "hdr-sig",
      "x-signature-token": "hdr-tok",
      "x-signature-timestamp": "999",
    };
    const fields = extractWebhookFields(
      { data: { partner_order_id: "po-1", status: "completed" } },
      (n) => headers[n] ?? null,
    );
    assert.equal(fields?.signature, "hdr-sig");
    assert.equal(fields?.token, "hdr-tok");
    assert.equal(fields?.timestamp, "999");
  });
});
