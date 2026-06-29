/**
 * ETG booking chain orchestrator - pure state-machine logic.
 *
 * No server-only import, no @/ aliases, no direct DB or HTTP calls.
 * All side-effects are injected via BookingRepository and OrchestratorTransport,
 * which lets this module be imported directly by node --test with mock implementations.
 *
 * Implements three steps of the verified ETG v3 booking chain:
 *   1. create_booking  - POST booking/form/ (non-idempotent; new partner_order_id per attempt)
 *   2. start_booking   - POST booking/finish/ (guest/room data + payment_type)
 *   3. poll_status     - POST booking/finish/status/ (5s poll; bounded by cut-off)
 *
 * The outbox worker (job-worker.ts, server-only) wires this to the real DB and transport.
 */

import {
  BOOKING_ENDPOINTS,
  STATUS_POLL_INTERVAL_MS,
  BOOKING_FORM_LIFETIME_MS,
  MAX_CREATE_BOOKING_RETRIES,
  TERMINAL_BOOKING_STATES,
  type BookingState,
  type BookingStep,
  type ProviderResponseSignal,
  type PaymentType,
  type GuestName,
  type RoomGuests,
  type RoomOccupancy,
  type ParsedPaymentType,
  classifyCreateBooking,
  classifyBookingFinish,
  classifyBookingStatus,
  nextBookingState,
  buildCreateBookingRequest,
  buildStartBookingRequest,
  buildBookingStatusRequest,
  buildBookingRooms,
  parseCreateBookingResponse,
  selectPaymentType,
  generatePartnerOrderId,
  BookingContractError,
} from "./contracts.ts";
import { reconcileToConfirmed } from "./reconcile.ts";
import { isPublicIp } from "./ip-trust.ts";

// ---- Injectable interfaces -------------------------------------------------

export type OrchestratorTransportResult = ProviderResponseSignal & { data: unknown };

export interface OrchestratorTransport {
  call(
    step: BookingStep,
    path: string,
    body: Record<string, unknown>,
  ): Promise<OrchestratorTransportResult>;
}

export type BookingContext = {
  bookingId: string;
  providerOrderStatus: BookingState | null;
  providerStatusVersion: number;
  providerAttemptCount: number;
  providerPartnerOrderId: string | null;
  providerBookingCutoffAt: string | null;
  prebookHash: string;
  customerEmail: string;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerPhone: string | null;
  travelersCount: number;
  language: string;
  paymentType: PaymentType;
  userIp: string | null;
  /** Exact occupancy from the searched/prebooked rate. Null when unavailable. */
  occupancy: RoomOccupancy[] | null;
  /** Sanitized per-room traveler details collected at checkout. */
  checkoutGuestRooms?: RoomGuests[] | null;
  /** payment_types[] persisted from the Create Booking response. */
  providerPaymentTypes: ParsedPaymentType[];
  /** From the Create Booking response; gender must be collected if true. */
  isGenderSpecificationRequired: boolean;
};

export type NewBookingAttempt = {
  bookingId: string;
  partnerOrderId: string;
  attemptNumber: number;
};

export type NewBookingEvent = {
  bookingId: string;
  jobId: string | null;
  step: string;
  outcome: string;
  providerResultCode: string | null;
  httpStatus: number | null;
  fromState: string | null;
  toState: string | null;
  attempt: number | null;
  note: string | null;
};

export type NewJob = {
  bookingId: string;
  jobType:
    | "create_booking"
    | "start_booking"
    | "poll_status"
    | "cancel_booking"
    | "sync_order_info";
  dedupeKey: string;
  runAfterMs: number;
  maxAttempts: number;
  partnerOrderId: string | null;
  payload: Record<string, unknown>;
};

export type BookingJob = {
  id: string;
  bookingId: string;
  jobType:
    | "create_booking"
    | "start_booking"
    | "poll_status"
    | "cancel_booking"
    | "sync_order_info";
  status: "queued" | "leased" | "processing" | "succeeded" | "failed" | "dead";
  attempts: number;
  maxAttempts: number;
  partnerOrderId: string | null;
  payload: Record<string, unknown>;
};

export type StatePatch = {
  providerPartnerOrderId?: string;
  providerAttemptCount?: number;
  providerResultCode?: string | null;
  providerBookingCutoffAt?: string;
  providerConfirmedAt?: string;
  providerCancelledAt?: string;
};

export interface BookingRepository {
  getBookingContext(bookingId: string): Promise<BookingContext | null>;
  transitionState(input: {
    bookingId: string;
    toState: BookingState;
    expectedVersion: number;
    patch?: StatePatch;
  }): Promise<boolean>;
  createAttempt(attempt: NewBookingAttempt): Promise<string>;
  updateAttemptStatus(
    partnerOrderId: string,
    status: "submitted" | "completed" | "failed",
    errorCode?: string,
  ): Promise<void>;
  appendEvent(event: NewBookingEvent): Promise<void>;
  enqueueJob(job: NewJob): Promise<string>;
  /** Persist the Create Booking response (order/item ids + payment_types + flags). */
  storeCreateBookingResult(input: {
    bookingId: string;
    orderId: string | null;
    itemId: string | null;
    paymentTypes: ParsedPaymentType[];
    isGenderSpecificationRequired: boolean;
  }): Promise<void>;
}

// ---- Step result -----------------------------------------------------------

export type StepOutcome =
  | { kind: "succeeded" }
  | { kind: "requeue"; runAfterMs: number; errorCode: string | null }
  | { kind: "terminal"; errorCode: string | null };

// ---- Helpers: guest names + pre-flight guest-data validation ---------------

/**
 * Legacy fallback for old checkout records. Current checkout stores per-room
 * traveler details; this fallback exists only so older pending rows do not crash.
 */
function collectGuestNames(ctx: BookingContext): GuestName[] {
  const first = (ctx.customerFirstName ?? "").trim();
  const last = (ctx.customerLastName ?? "").trim();
  if (!first || !last) return [];
  return [{ firstName: first, lastName: last }];
}

function collectBookingRooms(ctx: BookingContext): RoomGuests[] {
  if (ctx.checkoutGuestRooms && ctx.checkoutGuestRooms.length > 0) {
    return ctx.checkoutGuestRooms;
  }

  return buildBookingRooms(ctx.occupancy ?? [], collectGuestNames(ctx));
}

/**
 * Validate, BEFORE any ETG call, that checkout data can satisfy the exact
 * occupancy with real guest names. Returns a rejection code (sanitized) or null
 * when the booking can proceed. Never fabricates data.
 */
function preflightGuestDataRejection(ctx: BookingContext): string | null {
  if (!ctx.occupancy || ctx.occupancy.length === 0) {
    return "occupancy_unavailable";
  }
  try {
    collectBookingRooms(ctx);
  } catch (err) {
    if (err instanceof BookingContractError) {
      return "guest_data_incomplete";
    }
    throw err;
  }
  return null;
}

/**
 * Atomically move a booking to pending_review for a pre-ETG data gap and record
 * a sanitized event. No ETG endpoint is contacted on this path.
 */
async function rejectBeforeEtg(
  repo: BookingRepository,
  ctx: BookingContext,
  jobId: string,
  step: BookingStep,
  code: string,
): Promise<StepOutcome> {
  const locked = await repo.transitionState({
    bookingId: ctx.bookingId,
    toState: "pending_review",
    expectedVersion: ctx.providerStatusVersion,
    patch: { providerResultCode: code },
  });
  if (locked) {
    await repo.appendEvent({
      bookingId: ctx.bookingId,
      jobId,
      step,
      outcome: "terminal",
      providerResultCode: code,
      httpStatus: null,
      fromState: ctx.providerOrderStatus,
      toState: "pending_review",
      attempt: null,
      note: "rejected before ETG: checkout data incomplete",
    });
  }
  return { kind: "terminal", errorCode: code };
}

// ---- Step 1: create_booking -----------------------------------------------

export async function executeCreateBooking(input: {
  job: BookingJob;
  transport: OrchestratorTransport;
  repo: BookingRepository;
  nowMs?: number;
}): Promise<StepOutcome> {
  const { job, transport, repo } = input;
  const nowMs = input.nowMs ?? Date.now();

  const ctx = await repo.getBookingContext(job.bookingId);
  if (!ctx) return { kind: "terminal", errorCode: "booking_not_found" };

  // Terminal states never re-enter the chain.
  if (ctx.providerOrderStatus && TERMINAL_BOOKING_STATES.has(ctx.providerOrderStatus)) {
    return { kind: "succeeded" };
  }

  // Pre-flight, BEFORE any ETG call: require a trustworthy public end-user IP and
  // checkout data that can satisfy the exact occupancy with real guest names.
  // These are sent to human review (pending_review), not auto-failed, since they
  // are fixable data gaps rather than provider failures.
  if (!isPublicIp(ctx.userIp)) {
    return rejectBeforeEtg(repo, ctx, job.id, "booking_form", "missing_user_ip");
  }
  const guestRejection = preflightGuestDataRejection(ctx);
  if (guestRejection) {
    return rejectBeforeEtg(repo, ctx, job.id, "booking_form", guestRejection);
  }

  // Max retries exhausted: fail the booking so the search can be restarted.
  if (ctx.providerAttemptCount >= MAX_CREATE_BOOKING_RETRIES) {
    const locked = await repo.transitionState({
      bookingId: ctx.bookingId,
      toState: "failed",
      expectedVersion: ctx.providerStatusVersion,
      patch: { providerResultCode: "max_create_retries_exceeded" },
    });
    if (locked) {
      await repo.appendEvent({
        bookingId: ctx.bookingId,
        jobId: job.id,
        step: "booking_form",
        outcome: "terminal",
        providerResultCode: "max_create_retries_exceeded",
        httpStatus: null,
        fromState: ctx.providerOrderStatus,
        toState: "failed",
        attempt: ctx.providerAttemptCount,
        note: "restart search required",
      });
    }
    return { kind: "terminal", errorCode: "max_create_retries_exceeded" };
  }

  const partnerOrderId = generatePartnerOrderId();
  const attemptNumber = ctx.providerAttemptCount + 1;
  const cutoffAt = new Date(nowMs + BOOKING_FORM_LIFETIME_MS).toISOString();

  // Optimistic lock: transition to 'creating'.
  const locked = await repo.transitionState({
    bookingId: ctx.bookingId,
    toState: "creating",
    expectedVersion: ctx.providerStatusVersion,
    patch: {
      providerPartnerOrderId: partnerOrderId,
      providerAttemptCount: attemptNumber,
      providerBookingCutoffAt: cutoffAt,
    },
  });
  if (!locked) {
    // Another worker claimed this booking first.
    return { kind: "requeue", runAfterMs: STATUS_POLL_INTERVAL_MS, errorCode: null };
  }

  const versionAfterCreate = ctx.providerStatusVersion + 1;

  await repo.createAttempt({ bookingId: ctx.bookingId, partnerOrderId, attemptNumber });

  const body = buildCreateBookingRequest({
    bookHash: ctx.prebookHash,
    partnerOrderId,
    language: ctx.language,
    // Guaranteed public by the pre-flight isPublicIp() check above.
    userIp: ctx.userIp as string,
  });

  let signal: OrchestratorTransportResult;
  try {
    signal = await transport.call("booking_form", BOOKING_ENDPOINTS.createBookingForm, body);
  } catch {
    signal = { httpStatus: null, status: null, error: "transport_error", data: null };
  }

  const classification = classifyCreateBooking(signal);
  const toState = nextBookingState("creating", "booking_form", classification);

  if (classification.kind === "proceed") {
    // Persist the Create Booking response (order/item ids, payment_types, gender
    // flag) before advancing. No card data is stored; payment_types carry only
    // type/amount/currency_code + need-card flags.
    const created = parseCreateBookingResponse(signal.data);
    await repo.storeCreateBookingResult({
      bookingId: ctx.bookingId,
      orderId: created.orderId,
      itemId: created.itemId,
      paymentTypes: created.paymentTypes,
      isGenderSpecificationRequired: created.isGenderSpecificationRequired,
    });
    await repo.transitionState({
      bookingId: ctx.bookingId,
      toState: "starting",
      expectedVersion: versionAfterCreate,
    });
    await repo.updateAttemptStatus(partnerOrderId, "submitted");
    await repo.enqueueJob({
      bookingId: ctx.bookingId,
      jobType: "start_booking",
      dedupeKey: `start_booking:${ctx.bookingId}:${partnerOrderId}`,
      runAfterMs: 0,
      maxAttempts: 3,
      partnerOrderId,
      payload: {},
    });
    await repo.appendEvent({
      bookingId: ctx.bookingId,
      jobId: job.id,
      step: "booking_form",
      outcome: "proceed",
      providerResultCode: null,
      httpStatus: signal.httpStatus,
      fromState: "creating",
      toState: "starting",
      attempt: attemptNumber,
      note: null,
    });
    return { kind: "succeeded" };
  }

  if (classification.kind === "retry") {
    // Stay at 'creating' - next job run will generate a fresh partner_order_id.
    await repo.transitionState({
      bookingId: ctx.bookingId,
      toState: "creating",
      expectedVersion: versionAfterCreate,
    });
    await repo.updateAttemptStatus(
      partnerOrderId,
      "failed",
      classification.kind === "retry" ? (signal.error ?? "retry") : "retry",
    );
    await repo.appendEvent({
      bookingId: ctx.bookingId,
      jobId: job.id,
      step: "booking_form",
      outcome: "retry",
      providerResultCode: signal.error,
      httpStatus: signal.httpStatus,
      fromState: "creating",
      toState: "creating",
      attempt: attemptNumber,
      note: "new partner_order_id on next attempt",
    });
    return {
      kind: "requeue",
      runAfterMs: STATUS_POLL_INTERVAL_MS,
      errorCode: signal.error,
    };
  }

  // failed or unknown
  await repo.transitionState({
    bookingId: ctx.bookingId,
    toState,
    expectedVersion: versionAfterCreate,
    patch: {
      providerResultCode:
        classification.kind === "failed" ? (classification.code ?? null) : null,
    },
  });
  await repo.updateAttemptStatus(
    partnerOrderId,
    "failed",
    classification.kind === "failed" ? (classification.code ?? "failed") : "unknown",
  );
  await repo.appendEvent({
    bookingId: ctx.bookingId,
    jobId: job.id,
    step: "booking_form",
    outcome: classification.kind === "failed" ? "terminal" : "unknown",
    providerResultCode:
      classification.kind === "failed" ? (classification.code ?? null) : null,
    httpStatus: signal.httpStatus,
    fromState: "creating",
    toState,
    attempt: attemptNumber,
    note: null,
  });
  return {
    kind: "terminal",
    errorCode: classification.kind === "failed" ? (classification.code ?? null) : null,
  };
}

// ---- Step 2: start_booking -------------------------------------------------

export async function executeStartBooking(input: {
  job: BookingJob;
  transport: OrchestratorTransport;
  repo: BookingRepository;
}): Promise<StepOutcome> {
  const { job, transport, repo } = input;

  const ctx = await repo.getBookingContext(job.bookingId);
  if (!ctx) return { kind: "terminal", errorCode: "booking_not_found" };

  if (
    ctx.providerOrderStatus &&
    (TERMINAL_BOOKING_STATES.has(ctx.providerOrderStatus) ||
      ctx.providerOrderStatus === "processing")
  ) {
    return { kind: "succeeded" };
  }

  const partnerOrderId = job.partnerOrderId ?? ctx.providerPartnerOrderId;
  if (!partnerOrderId) {
    return { kind: "terminal", errorCode: "missing_partner_order_id" };
  }

  // Build rooms/guests from the EXACT occupancy + real collected names. This was
  // already validated at create time; re-validate to stay self-contained.
  if (!ctx.occupancy) {
    return rejectBeforeEtg(repo, ctx, job.id, "booking_finish", "occupancy_unavailable");
  }
  let rooms: RoomGuests[];
  try {
    rooms = collectBookingRooms(ctx);
  } catch (err) {
    if (err instanceof BookingContractError) {
      return rejectBeforeEtg(repo, ctx, job.id, "booking_finish", "guest_data_incomplete");
    }
    throw err;
  }

  if (
    ctx.isGenderSpecificationRequired &&
    rooms.some((room) => room.guests.some((guest) => !guest.gender))
  ) {
    return rejectBeforeEtg(repo, ctx, job.id, "booking_finish", "gender_required_not_collected");
  }

  // Resend ONE complete payment_types entry from Create Booking matching the
  // configured model. Without it we cannot build a compliant finish request.
  const payment = selectPaymentType(ctx.providerPaymentTypes, ctx.paymentType);
  if (!payment) {
    return rejectBeforeEtg(repo, ctx, job.id, "booking_finish", "payment_type_unavailable");
  }

  const locked = await repo.transitionState({
    bookingId: ctx.bookingId,
    toState: "starting",
    expectedVersion: ctx.providerStatusVersion,
  });
  if (!locked) {
    return { kind: "requeue", runAfterMs: STATUS_POLL_INTERVAL_MS, errorCode: null };
  }

  const versionAfterStart = ctx.providerStatusVersion + 1;

  // supplier_data carries only real, collected values (lead guest + contact).
  const leadFirst = (ctx.customerFirstName ?? "").trim();
  const leadLast = (ctx.customerLastName ?? "").trim();
  const supplierData =
    leadFirst || leadLast || ctx.customerPhone || ctx.customerEmail
      ? {
          firstNameOriginal: leadFirst || undefined,
          lastNameOriginal: leadLast || undefined,
          phone: ctx.customerPhone ?? undefined,
          email: ctx.customerEmail || undefined,
        }
      : undefined;

  const body = buildStartBookingRequest({
    partner: { partnerOrderId },
    language: ctx.language,
    user: {
      email: ctx.customerEmail,
      ...(ctx.customerPhone ? { phone: ctx.customerPhone } : {}),
    },
    rooms,
    payment,
    supplierData,
  });

  let signal: OrchestratorTransportResult;
  try {
    signal = await transport.call("booking_finish", BOOKING_ENDPOINTS.bookingFinish, body);
  } catch {
    signal = { httpStatus: null, status: null, error: "transport_error", data: null };
  }

  const classification = classifyBookingFinish(signal);
  const toState = nextBookingState("starting", "booking_finish", classification);

  if (classification.kind === "proceed") {
    await repo.transitionState({
      bookingId: ctx.bookingId,
      toState: "processing",
      expectedVersion: versionAfterStart,
    });
    await repo.enqueueJob({
      bookingId: ctx.bookingId,
      jobType: "poll_status",
      dedupeKey: `poll_status:${ctx.bookingId}:${partnerOrderId}:1`,
      runAfterMs: STATUS_POLL_INTERVAL_MS,
      maxAttempts: 120,
      partnerOrderId,
      payload: { pollCount: 1 },
    });
    await repo.appendEvent({
      bookingId: ctx.bookingId,
      jobId: job.id,
      step: "booking_finish",
      outcome: "proceed",
      providerResultCode: signal.error,
      httpStatus: signal.httpStatus,
      fromState: "starting",
      toState: "processing",
      attempt: null,
      note: null,
    });
    return { kind: "succeeded" };
  }

  // failed or unknown
  await repo.transitionState({
    bookingId: ctx.bookingId,
    toState,
    expectedVersion: versionAfterStart,
    patch: {
      providerResultCode:
        classification.kind === "failed" ? (classification.code ?? null) : null,
    },
  });
  await repo.appendEvent({
    bookingId: ctx.bookingId,
    jobId: job.id,
    step: "booking_finish",
    outcome: classification.kind === "failed" ? "terminal" : "unknown",
    providerResultCode:
      classification.kind === "failed" ? (classification.code ?? null) : null,
    httpStatus: signal.httpStatus,
    fromState: "starting",
    toState,
    attempt: null,
    note: null,
  });
  return {
    kind: "terminal",
    errorCode: classification.kind === "failed" ? (classification.code ?? null) : null,
  };
}

// ---- Step 3: poll_status ---------------------------------------------------

export async function executePollStatus(input: {
  job: BookingJob;
  transport: OrchestratorTransport;
  repo: BookingRepository;
  nowMs?: number;
}): Promise<StepOutcome> {
  const { job, transport, repo } = input;
  const nowMs = input.nowMs ?? Date.now();

  const ctx = await repo.getBookingContext(job.bookingId);
  if (!ctx) return { kind: "terminal", errorCode: "booking_not_found" };

  if (ctx.providerOrderStatus && TERMINAL_BOOKING_STATES.has(ctx.providerOrderStatus)) {
    return { kind: "succeeded" };
  }

  const partnerOrderId = job.partnerOrderId ?? ctx.providerPartnerOrderId;
  if (!partnerOrderId) {
    return { kind: "terminal", errorCode: "missing_partner_order_id" };
  }

  // Check booking cut-off before polling.
  if (ctx.providerBookingCutoffAt) {
    const cutoff = new Date(ctx.providerBookingCutoffAt).getTime();
    if (nowMs >= cutoff) {
      await repo.transitionState({
        bookingId: ctx.bookingId,
        toState: "pending_review",
        expectedVersion: ctx.providerStatusVersion,
        patch: { providerResultCode: "booking_cutoff_exceeded" },
      });
      await repo.appendEvent({
        bookingId: ctx.bookingId,
        jobId: job.id,
        step: "booking_status",
        outcome: "terminal",
        providerResultCode: "booking_cutoff_exceeded",
        httpStatus: null,
        fromState: ctx.providerOrderStatus,
        toState: "pending_review",
        attempt: null,
        note: "booking cut-off passed; manual review required",
      });
      return { kind: "terminal", errorCode: "booking_cutoff_exceeded" };
    }
  }

  const body = buildBookingStatusRequest(partnerOrderId);

  let signal: OrchestratorTransportResult;
  try {
    signal = await transport.call(
      "booking_status",
      BOOKING_ENDPOINTS.bookingFinishStatus,
      body,
    );
  } catch {
    signal = { httpStatus: null, status: null, error: "transport_error", data: null };
  }

  const classification = classifyBookingStatus(signal);
  const toState = nextBookingState("processing", "booking_status", classification);

  if (classification.kind === "success") {
    // Converge with the signed webhook success path through one atomic transition.
    await reconcileToConfirmed({
      repo,
      ctx,
      jobId: job.id,
      source: "booking_status",
      httpStatus: signal.httpStatus,
      rawCode: signal.status,
      nowMs,
    });
    return { kind: "succeeded" };
  }

  if (classification.kind === "poll") {
    const pollCount = (typeof job.payload.pollCount === "number" ? job.payload.pollCount : 0) + 1;
    await repo.enqueueJob({
      bookingId: ctx.bookingId,
      jobType: "poll_status",
      dedupeKey: `poll_status:${ctx.bookingId}:${partnerOrderId}:${pollCount}`,
      runAfterMs: STATUS_POLL_INTERVAL_MS,
      maxAttempts: 120,
      partnerOrderId,
      payload: { pollCount },
    });
    await repo.appendEvent({
      bookingId: ctx.bookingId,
      jobId: job.id,
      step: "booking_status",
      outcome: "poll",
      providerResultCode: signal.status ?? signal.error,
      httpStatus: signal.httpStatus,
      fromState: ctx.providerOrderStatus,
      toState: "processing",
      attempt: null,
      note: null,
    });
    return { kind: "succeeded" };
  }

  if (classification.kind === "requires_3ds") {
    await repo.transitionState({
      bookingId: ctx.bookingId,
      toState: "requires_3ds",
      expectedVersion: ctx.providerStatusVersion,
    });
    await repo.appendEvent({
      bookingId: ctx.bookingId,
      jobId: job.id,
      step: "booking_status",
      outcome: "requires_3ds",
      providerResultCode: "3ds",
      httpStatus: signal.httpStatus,
      fromState: ctx.providerOrderStatus,
      toState: "requires_3ds",
      attempt: null,
      note: null,
    });
    return { kind: "terminal", errorCode: "requires_3ds" };
  }

  // failed or unknown
  await repo.transitionState({
    bookingId: ctx.bookingId,
    toState,
    expectedVersion: ctx.providerStatusVersion,
    patch: {
      providerResultCode:
        classification.kind === "failed" ? (classification.code ?? null) : null,
    },
  });
  await repo.appendEvent({
    bookingId: ctx.bookingId,
    jobId: job.id,
    step: "booking_status",
    outcome: classification.kind === "failed" ? "terminal" : "unknown",
    providerResultCode:
      classification.kind === "failed" ? (classification.code ?? null) : null,
    httpStatus: signal.httpStatus,
    fromState: ctx.providerOrderStatus,
    toState,
    attempt: null,
    note: null,
  });
  return {
    kind: "terminal",
    errorCode: classification.kind === "failed" ? (classification.code ?? null) : null,
  };
}

// ---- Enqueue helper (used by external entry points, e.g., webhook) ---------

export function buildCreateBookingJobSpec(bookingId: string): NewJob {
  return {
    bookingId,
    jobType: "create_booking",
    dedupeKey: `create_booking:${bookingId}`,
    runAfterMs: 0,
    maxAttempts: MAX_CREATE_BOOKING_RETRIES,
    partnerOrderId: null,
    payload: {},
  };
}
