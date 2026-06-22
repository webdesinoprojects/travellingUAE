/**
 * ETG v3 booking-chain contracts and PURE response-classification helpers.
 *
 * This module is intentionally dependency-free (only `node:crypto`). It must NOT
 * import `server-only`, `@/` aliases, or the provider client, so it can be unit
 * tested directly with `node --test` and reused on any runtime. It performs NO
 * network IO and NEVER calls ETG.
 *
 * Contract source of truth: dev/ratehawk-booking-doc-verification.md
 * (verified against docs.emergingtravel.com on 2026-06-13). Exact JSON field
 * names for the finish `user`/`rooms` objects must still be confirmed verbatim
 * at certification; the request builders below assemble the documented fields.
 */

import { randomUUID } from "node:crypto";

// ---- Endpoint paths (reference only; the transport seam calls these) -------

export const BOOKING_ENDPOINTS = {
  /** Create booking process. Side-effecting, NOT idempotent. */
  createBookingForm: "/api/b2b/v3/hotel/order/booking/form/",
  /** Start booking process. */
  bookingFinish: "/api/b2b/v3/hotel/order/booking/finish/",
  /** Check booking process. Poll every 5s, bounded by cut-off. */
  bookingFinishStatus: "/api/b2b/v3/hotel/order/booking/finish/status/",
  /** Cancel an order. Retry once on timeout. */
  orderCancel: "/api/b2b/v3/hotel/order/cancel/",
  /** Post-booking details (HCN/voucher). Never used for status decisions. */
  orderInfo: "/api/b2b/v3/hotel/order/info/",
} as const;

/** Recommended status poll cadence (verified: 5s), bounded by booking cut-off. */
export const STATUS_POLL_INTERVAL_MS = 5_000;
/** Booking-form lifetime (verified: 60 minutes). */
export const BOOKING_FORM_LIFETIME_MS = 60 * 60 * 1000;
/** Max create-booking retries before the search must be restarted. */
export const MAX_CREATE_BOOKING_RETRIES = 10;
/** partner_order_id length bound (verified: 1-256 chars). */
export const PARTNER_ORDER_ID_MAX_LEN = 256;

// ---- Booking state machine -------------------------------------------------

export const BOOKING_STATES = [
  "pending",
  "creating",
  "starting",
  "processing",
  "requires_3ds",
  "confirmed",
  "failed",
  "cancel_pending",
  "cancelled",
  "pending_review",
] as const;

export type BookingState = (typeof BOOKING_STATES)[number];

export const TERMINAL_BOOKING_STATES: ReadonlySet<BookingState> = new Set([
  "confirmed",
  "failed",
  "cancelled",
]);

export type BookingStep =
  | "booking_form"
  | "booking_finish"
  | "booking_status"
  | "webhook"
  | "cancel"
  | "order_info";

export type PaymentType = "hotel" | "now" | "deposit";

// ---- Allowlisted provider result codes (verified) --------------------------

/** Create booking process: transient errors -> retry with a NEW partner_order_id. */
export const CREATE_RETRY_CODES: ReadonlySet<string> = new Set([
  "duplicate_reservation",
  "double_booking_form",
  "unknown",
  "timeout",
]);

/** Create booking process: terminal errors -> stop. */
export const CREATE_TERMINAL_CODES: ReadonlySet<string> = new Set([
  "contract_mismatch",
  "hotel_not_found",
  "insufficient_b2b_balance",
  "reservation_is_not_allowed",
  "rate_not_found",
  "sandbox_restriction",
]);

/** Start booking process: transient -> proceed to Check booking anyway. */
export const FINISH_PROCEED_CODES: ReadonlySet<string> = new Set([
  "timeout",
  "unknown",
]);

/** Start booking process: terminal -> stop. */
export const FINISH_TERMINAL_CODES: ReadonlySet<string> = new Set([
  "booking_form_expired",
  "rate_not_found",
  "return_path_required",
]);

/** Check booking process: transient errors -> keep polling. */
export const STATUS_POLL_CODES: ReadonlySet<string> = new Set([
  "timeout",
  "unknown",
]);

/** Check booking process: terminal errors -> stop. */
export const STATUS_TERMINAL_CODES: ReadonlySet<string> = new Set([
  "soldout",
  "provider",
  "book_limit",
  "block",
  "charge",
  "3ds", // 3ds as an ERROR (not the status) is a terminal failure
  "not_allowed",
  "booking_finish_did_not_succeed",
]);

/** Success spellings: webhook uses `confirmed`, finish/status uses `completed`. */
export const SUCCESS_STATUS_VALUES: ReadonlySet<string> = new Set([
  "ok",
  "completed",
  "confirmed",
]);

// ---- Normalized provider signal + classification ---------------------------

/**
 * Normalized view of one provider response, produced by the transport seam from
 * either a success envelope or a caught provider error. Classifiers are pure
 * over this shape so they can be tested without any network/transport.
 */
export type ProviderResponseSignal = {
  /** HTTP status if known (e.g. 200, 429, 503). */
  httpStatus: number | null;
  /** ETG envelope `status` value, lowercased/trimmed (e.g. "ok","processing","3ds"). */
  status: string | null;
  /** ETG envelope `error` slug, lowercased/trimmed (e.g. "soldout"). */
  error: string | null;
};

export type BookingClassification =
  | { kind: "success" }
  | { kind: "proceed" }
  | { kind: "poll" }
  | { kind: "retry"; strategy: "new_partner_order_id" | "single" }
  | { kind: "requires_3ds" }
  | { kind: "failed"; code: string | null }
  | { kind: "unknown" };

function norm(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed === "" ? null : trimmed;
}

/** 429 and 5xx are transient at the HTTP layer regardless of envelope. */
function isTransientHttp(httpStatus: number | null): boolean {
  if (httpStatus === null) {
    return false;
  }
  return httpStatus === 429 || (httpStatus >= 500 && httpStatus <= 599);
}

/** True when the envelope reports a plain success (`status: ok`). */
function isOkStatus(signal: ProviderResponseSignal): boolean {
  return norm(signal.status) === "ok" && norm(signal.error) === null;
}

export function normalizeSignal(input: {
  httpStatus?: number | null;
  status?: string | null;
  error?: string | null;
}): ProviderResponseSignal {
  return {
    httpStatus: typeof input.httpStatus === "number" ? input.httpStatus : null,
    status: norm(input.status),
    error: norm(input.error),
  };
}

// ---- Step classifiers ------------------------------------------------------

/** Create booking process (`booking/form/`). */
export function classifyCreateBooking(
  signal: ProviderResponseSignal,
): BookingClassification {
  if (isOkStatus(signal)) {
    return { kind: "proceed" };
  }

  const error = norm(signal.error);

  if (error && CREATE_TERMINAL_CODES.has(error)) {
    return { kind: "failed", code: error };
  }

  if (error && CREATE_RETRY_CODES.has(error)) {
    return { kind: "retry", strategy: "new_partner_order_id" };
  }

  if (isTransientHttp(signal.httpStatus)) {
    return { kind: "retry", strategy: "new_partner_order_id" };
  }

  return { kind: "unknown" };
}

/** Start booking process (`booking/finish/`). */
export function classifyBookingFinish(
  signal: ProviderResponseSignal,
): BookingClassification {
  if (isOkStatus(signal)) {
    return { kind: "proceed" };
  }

  const error = norm(signal.error);

  if (error && FINISH_TERMINAL_CODES.has(error)) {
    return { kind: "failed", code: error };
  }

  if (error && FINISH_PROCEED_CODES.has(error)) {
    return { kind: "proceed" };
  }

  if (isTransientHttp(signal.httpStatus)) {
    return { kind: "proceed" };
  }

  return { kind: "unknown" };
}

/** Check booking process (`booking/finish/status/`). */
export function classifyBookingStatus(
  signal: ProviderResponseSignal,
): BookingClassification {
  const status = norm(signal.status);
  const error = norm(signal.error);

  // The `3ds` STATUS means redirect the user; the `3ds` ERROR is terminal.
  if (status === "3ds" && !error) {
    return { kind: "requires_3ds" };
  }

  if (status && SUCCESS_STATUS_VALUES.has(status) && !error) {
    return { kind: "success" };
  }

  if (status === "processing" && !error) {
    return { kind: "poll" };
  }

  if (error && STATUS_TERMINAL_CODES.has(error)) {
    return { kind: "failed", code: error };
  }

  if (error && STATUS_POLL_CODES.has(error)) {
    return { kind: "poll" };
  }

  if (isTransientHttp(signal.httpStatus)) {
    return { kind: "poll" };
  }

  return { kind: "unknown" };
}

/** Receive booking status webhook. */
export function classifyWebhookStatus(
  signal: ProviderResponseSignal,
): BookingClassification {
  const status = norm(signal.status);

  if (status && (status === "confirmed" || status === "completed" || status === "ok")) {
    return { kind: "success" };
  }

  if (status === "failed" || norm(signal.error) === "failed") {
    return { kind: "failed", code: "failed" };
  }

  return { kind: "unknown" };
}

/** Cancel booking (`order/cancel/`). Timeout -> retry exactly once. */
export function classifyCancel(
  signal: ProviderResponseSignal,
): BookingClassification {
  if (isOkStatus(signal)) {
    return { kind: "success" };
  }

  const error = norm(signal.error);

  if (error === "timeout") {
    return { kind: "retry", strategy: "single" };
  }

  if (isTransientHttp(signal.httpStatus)) {
    return { kind: "retry", strategy: "single" };
  }

  if (error) {
    return { kind: "failed", code: error };
  }

  return { kind: "unknown" };
}

/** Post-booking order info (`order/info/`). Not a status source; may be delayed. */
export function classifyOrderInfo(
  signal: ProviderResponseSignal,
): BookingClassification {
  if (isOkStatus(signal)) {
    return { kind: "success" };
  }

  const error = norm(signal.error);

  // Data can be unavailable immediately after confirmation -> try again later.
  if (error === "timeout" || error === "unknown" || isTransientHttp(signal.httpStatus)) {
    return { kind: "poll" };
  }

  if (error) {
    return { kind: "failed", code: error };
  }

  return { kind: "unknown" };
}

// ---- Pure state transition -------------------------------------------------

/**
 * Pure mapping from (current state, step, classification) to the next state.
 * No IO, no retry counting (the durable job owns attempt counts). Returns the
 * current state unchanged for transitions that are not meaningful for the step.
 */
export function nextBookingState(
  current: BookingState,
  step: BookingStep,
  classification: BookingClassification,
): BookingState {
  // Terminal states never transition further here.
  if (TERMINAL_BOOKING_STATES.has(current)) {
    return current;
  }

  switch (step) {
    case "booking_form":
      if (classification.kind === "proceed") return "starting";
      if (classification.kind === "retry") return "creating";
      if (classification.kind === "failed") return "failed";
      if (classification.kind === "unknown") return "pending_review";
      return current;

    case "booking_finish":
      if (classification.kind === "proceed") return "processing";
      if (classification.kind === "failed") return "failed";
      if (classification.kind === "unknown") return "pending_review";
      return current;

    case "booking_status":
      if (classification.kind === "success") return "confirmed";
      if (classification.kind === "requires_3ds") return "requires_3ds";
      if (classification.kind === "poll") return "processing";
      if (classification.kind === "failed") return "failed";
      if (classification.kind === "unknown") return "pending_review";
      return current;

    case "webhook":
      if (classification.kind === "success") return "confirmed";
      if (classification.kind === "failed") return "failed";
      return current;

    case "cancel":
      if (classification.kind === "success") return "cancelled";
      if (classification.kind === "retry") return "cancel_pending";
      // A cancel that fails or is ambiguous needs a human, not an auto-fail.
      if (classification.kind === "failed" || classification.kind === "unknown") {
        return "pending_review";
      }
      return current;

    case "order_info":
      // Order info never changes booking state; it only enriches details.
      return current;

    default:
      return current;
  }
}

// ---- Request types + pure builders -----------------------------------------

export type GuestName = {
  firstName: string;
  lastName: string;
  /** Child age; set only for child occupants. */
  age?: number;
  isChild?: boolean;
};

export type RoomGuests = {
  guests: GuestName[];
};

export type CreateBookingInput = {
  /** Prebook `p-...` hash. Server-only; never logged or sent to the browser. */
  bookHash: string;
  partnerOrderId: string;
  language: string;
  userIp: string;
};

export type StartBookingInput = {
  partnerOrderId: string;
  language: string;
  userEmail: string;
  userComment?: string;
  rooms: RoomGuests[];
  paymentType: PaymentType;
  /** Only for `now`: redirect target after 3DS. */
  returnPath?: string;
  payUuid?: string;
  initUuid?: string;
};

export class BookingContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingContractError";
  }
}

/** Generate a fresh, unique partner_order_id. New value on every attempt. */
export function generatePartnerOrderId(): string {
  return randomUUID();
}

export function isValidPartnerOrderId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= PARTNER_ORDER_ID_MAX_LEN
  );
}

function assertNonEmpty(label: string, value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new BookingContractError(`${label} is required`);
  }
  return value;
}

/**
 * Build the create-booking-process request body. Pure assembler: validates
 * shape only and never performs IO. Field names follow the documented contract
 * and must be re-confirmed verbatim at certification.
 */
export function buildCreateBookingRequest(
  input: CreateBookingInput,
): Record<string, unknown> {
  assertNonEmpty("bookHash", input.bookHash);
  assertNonEmpty("language", input.language);
  assertNonEmpty("userIp", input.userIp);

  if (!isValidPartnerOrderId(input.partnerOrderId)) {
    throw new BookingContractError("partnerOrderId must be 1-256 chars");
  }

  return {
    partner_order_id: input.partnerOrderId,
    book_hash: input.bookHash,
    language: input.language,
    user_ip: input.userIp,
  };
}

/** Build the start-booking-process request body. Pure assembler. */
export function buildStartBookingRequest(
  input: StartBookingInput,
): Record<string, unknown> {
  if (!isValidPartnerOrderId(input.partnerOrderId)) {
    throw new BookingContractError("partnerOrderId must be 1-256 chars");
  }
  assertNonEmpty("language", input.language);
  assertNonEmpty("userEmail", input.userEmail);

  if (!Array.isArray(input.rooms) || input.rooms.length === 0) {
    throw new BookingContractError("at least one room is required");
  }

  const rooms = input.rooms.map((room) => {
    if (!Array.isArray(room.guests) || room.guests.length === 0) {
      throw new BookingContractError("each room needs at least one guest");
    }

    return {
      guests: room.guests.map((g) => {
        assertNonEmpty("guest.firstName", g.firstName);
        assertNonEmpty("guest.lastName", g.lastName);
        const guest: Record<string, unknown> = {
          first_name: g.firstName,
          last_name: g.lastName,
        };
        if (g.isChild) {
          guest.is_child = true;
          if (typeof g.age === "number") {
            guest.age = g.age;
          }
        }
        return guest;
      }),
    };
  });

  const body: Record<string, unknown> = {
    partner_order_id: input.partnerOrderId,
    language: input.language,
    user: {
      email: input.userEmail,
      ...(input.userComment ? { comment: input.userComment } : {}),
    },
    rooms,
    payment_type: { type: input.paymentType },
  };

  if (input.paymentType === "now") {
    // 3DS-related fields are mandatory for `now`; the orchestrator must supply
    // them. We validate presence here so a misconfigured call fails fast.
    assertNonEmpty("returnPath", input.returnPath);
    assertNonEmpty("payUuid", input.payUuid);
    assertNonEmpty("initUuid", input.initUuid);
    body.return_path = input.returnPath;
    body.pay_uuid = input.payUuid;
    body.init_uuid = input.initUuid;
  }

  return body;
}

/** Build the check-booking-process request body. */
export function buildBookingStatusRequest(
  partnerOrderId: string,
): Record<string, unknown> {
  if (!isValidPartnerOrderId(partnerOrderId)) {
    throw new BookingContractError("partnerOrderId must be 1-256 chars");
  }
  return { partner_order_id: partnerOrderId };
}

/** Build the cancel request body (by partner order id). */
export function buildCancelRequest(
  partnerOrderId: string,
): Record<string, unknown> {
  if (!isValidPartnerOrderId(partnerOrderId)) {
    throw new BookingContractError("partnerOrderId must be 1-256 chars");
  }
  return { partner_order_id: partnerOrderId };
}

/** Build the order-info request body (by partner order id). */
export function buildOrderInfoRequest(
  partnerOrderId: string,
): Record<string, unknown> {
  if (!isValidPartnerOrderId(partnerOrderId)) {
    throw new BookingContractError("partnerOrderId must be 1-256 chars");
  }
  return { ordering: { partner_order_ids: [partnerOrderId] } };
}
