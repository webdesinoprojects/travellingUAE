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

/** Check-booking-process success status. Webhook success uses `completed` separately. */
export const SUCCESS_STATUS_VALUES: ReadonlySet<string> = new Set([
  "ok",
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

/**
 * Receive booking status webhook.
 *
 * The webhook reports the FINAL booking status. Per the verified ETG docs, the
 * documented completion states are exactly `completed` (success) and `failed`.
 * This classifier therefore accepts ONLY those two spellings:
 *   - `completed` -> success
 *   - `failed`    -> failed
 *   - anything else (including `ok`, `confirmed`, `processing`) -> unknown
 *
 * `ok` is the Check-booking-process (finish/status) polling value, NOT a webhook
 * value, so it must not be treated as webhook success.
 *
 * DOCS QUESTION (open, for ETG): our earlier handoff claimed the webhook sends
 * `confirmed`, but the live endpoint contract documents `completed`. Until ETG
 * confirms in writing that this exact callback can send `confirmed`, we DO NOT
 * accept `confirmed` as success here. See dev/ratehawk-booking-doc-verification.md.
 */
export function classifyWebhookStatus(
  signal: ProviderResponseSignal,
): BookingClassification {
  const status = norm(signal.status);

  if (status === "completed") {
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
  gender?: "male" | "female" | "unknown";
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

/** One room's occupancy, preserved exactly from the searched/prebooked rate. */
export type RoomOccupancy = {
  adults: number;
  /** Child ages (years). Length = number of children in the room. */
  childrenAges: number[];
};

/**
 * One `payment_types[]` entry returned by Create Booking, sanitized (no card
 * data). The chosen entry is resent verbatim (type/amount/currency_code) on
 * Start Booking. `is_need_credit_card_data`/`is_need_cvc` flags drive the `now`
 * card-token flow (not implemented in this slice).
 */
export type ParsedPaymentType = {
  type: string;
  amount: string;
  currencyCode: string;
  isNeedCreditCardData: boolean;
  isNeedCvc: boolean;
};

/** Parsed, non-secret view of the Create Booking (booking/form) response. */
export type CreateBookingResponse = {
  orderId: string | null;
  itemId: string | null;
  paymentTypes: ParsedPaymentType[];
  isGenderSpecificationRequired: boolean;
};

/** The payment_type entry resent on Start Booking (one of create's payment_types). */
export type SelectedPaymentType = {
  type: string;
  amount: string;
  currencyCode: string;
  /** ETG card-token/3DS flow identifiers for `now` rates only. */
  initUuid?: string;
  payUuid?: string;
  returnPath?: string;
  /**
   * Sanitized card-requirement flags carried over from the create-booking
   * payment_types entry. Drive the `now` card-token UI/validation. These are
   * NEVER sent back to ETG on Start Booking (buildStartBookingRequest ignores
   * them); they only describe what the checkout form must collect.
   */
  isNeedCreditCardData?: boolean;
  isNeedCvc?: boolean;
};

/** `supplier_data` block. Only real, collected values are sent; never invented. */
export type SupplierData = {
  firstNameOriginal?: string;
  lastNameOriginal?: string;
  phone?: string;
  email?: string;
};

export type StartBookingInput = {
  /** ETG nests partner_order_id under `partner` (NOT top-level). */
  partner: { partnerOrderId: string; comment?: string; amountSellB2b2c?: string };
  language: string;
  user: { email: string; comment?: string; phone?: string };
  rooms: RoomGuests[];
  /** One complete payment_types entry returned by Create Booking, resent. */
  payment: SelectedPaymentType;
  supplierData?: SupplierData;
};

export class BookingContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingContractError";
  }
}

export function isHotelPageBookHash(value: unknown): value is string {
  return typeof value === "string" && value.trim().startsWith("h-");
}

export function isPrebookBookHash(value: unknown): value is string {
  return typeof value === "string" && value.trim().startsWith("p-");
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
  const bookHash = assertNonEmpty("bookHash", input.bookHash);
  if (!isPrebookBookHash(bookHash)) {
    throw new BookingContractError("bookHash must be a prebook p-* hash");
  }
  assertNonEmpty("language", input.language);
  assertNonEmpty("userIp", input.userIp);

  if (!isValidPartnerOrderId(input.partnerOrderId)) {
    throw new BookingContractError("partnerOrderId must be 1-256 chars");
  }

  return {
    partner_order_id: input.partnerOrderId,
    book_hash: bookHash,
    language: input.language,
    user_ip: input.userIp,
  };
}

/** Names ETG must never receive: empty or the placeholder "guest". */
const PLACEHOLDER_GUEST_NAMES: ReadonlySet<string> = new Set(["guest", "n/a", "na"]);

function assertRealGuestName(label: string, value: unknown): string {
  const v = assertNonEmpty(label, value).trim();
  if (PLACEHOLDER_GUEST_NAMES.has(v.toLowerCase())) {
    throw new BookingContractError(`${label} must be a real guest name, not a placeholder`);
  }
  return v;
}

/**
 * Build the Start-booking-process (`booking/finish/`) request body.
 *
 * Exact ETG-compliant shape (verified against the official endpoint):
 *   - `partner.partner_order_id` (NESTED, not top-level), optional comment /
 *     amount_sell_b2b2c.
 *   - `payment_type` = one complete `payment_types` entry from Create Booking,
 *     resent as { type, amount, currency_code }; `now`/3DS token fields are
 *     top-level (`return_path`, `init_uuid`, `pay_uuid`).
 *   - `supplier_data` with documented fields, included only when real values
 *     exist (never invented).
 *   - `user` { email, comment?, phone? } and `rooms[].guests[]` with real names.
 */
export function buildStartBookingRequest(
  input: StartBookingInput,
): Record<string, unknown> {
  if (!isValidPartnerOrderId(input.partner?.partnerOrderId)) {
    throw new BookingContractError("partner.partnerOrderId must be 1-256 chars");
  }
  assertNonEmpty("language", input.language);
  assertNonEmpty("user.email", input.user?.email);

  if (!Array.isArray(input.rooms) || input.rooms.length === 0) {
    throw new BookingContractError("at least one room is required");
  }

  const rooms = input.rooms.map((room) => {
    if (!Array.isArray(room.guests) || room.guests.length === 0) {
      throw new BookingContractError("each room needs at least one guest");
    }

    return {
      guests: room.guests.map((g) => {
        const guest: Record<string, unknown> = {
          first_name: assertRealGuestName("guest.firstName", g.firstName),
          last_name: assertRealGuestName("guest.lastName", g.lastName),
        };
        if (g.gender) {
          guest.gender = g.gender;
        }
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

  // payment_type: resend the selected create-booking entry verbatim.
  assertNonEmpty("payment.type", input.payment?.type);
  assertNonEmpty("payment.amount", input.payment.amount);
  assertNonEmpty("payment.currencyCode", input.payment.currencyCode);
  const paymentType: Record<string, unknown> = {
    type: input.payment.type,
    amount: input.payment.amount,
    currency_code: input.payment.currencyCode,
  };

  const partner: Record<string, unknown> = {
    partner_order_id: input.partner.partnerOrderId,
  };
  if (input.partner.comment) partner.comment = input.partner.comment;
  if (input.partner.amountSellB2b2c) partner.amount_sell_b2b2c = input.partner.amountSellB2b2c;

  const user: Record<string, unknown> = { email: input.user.email };
  if (input.user.comment) user.comment = input.user.comment;
  if (input.user.phone) user.phone = input.user.phone;

  const body: Record<string, unknown> = {
    user,
    partner,
    language: input.language,
    rooms,
    payment_type: paymentType,
  };

  if (input.payment.type === "now") {
    // Standalone hotel booking does not use `now`; this preserves the shared
    // helper shape for the separate ETG card-token/3DS implementation.
    body.return_path = assertNonEmpty("payment.returnPath", input.payment.returnPath);
    if (input.payment.initUuid) {
      body.init_uuid = input.payment.initUuid;
    }
    if (input.payment.payUuid) {
      body.pay_uuid = input.payment.payUuid;
    }
  }

  // supplier_data: only include fields we actually have (never invent values).
  if (input.supplierData) {
    const sd: Record<string, unknown> = {};
    if (input.supplierData.firstNameOriginal) sd.first_name_original = input.supplierData.firstNameOriginal;
    if (input.supplierData.lastNameOriginal) sd.last_name_original = input.supplierData.lastNameOriginal;
    if (input.supplierData.phone) sd.phone = input.supplierData.phone;
    if (input.supplierData.email) sd.email = input.supplierData.email;
    if (Object.keys(sd).length > 0) body.supplier_data = sd;
  }

  return body;
}

/**
 * Parse the Create Booking (booking/form) response into a non-secret view.
 * Stores order_id, item_id, payment_types (sanitized: no card data) and
 * is_gender_specification_required. Defensive: never throws on shape.
 */
export function parseCreateBookingResponse(data: unknown): CreateBookingResponse {
  const result: CreateBookingResponse = {
    orderId: null,
    itemId: null,
    paymentTypes: [],
    isGenderSpecificationRequired: false,
  };
  if (!data || typeof data !== "object") return result;

  const root = data as Record<string, unknown>;

  const idToString = (v: unknown): string | null => {
    if (typeof v === "string" && v.trim() !== "") return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    return null;
  };

  result.orderId = idToString(root.order_id);
  result.itemId = idToString(root.item_id);
  result.isGenderSpecificationRequired = root.is_gender_specification_required === true;

  const rawTypes = Array.isArray(root.payment_types) ? root.payment_types : [];
  for (const entry of rawTypes) {
    if (!entry || typeof entry !== "object") continue;
    const rec = entry as Record<string, unknown>;
    const type = typeof rec.type === "string" ? rec.type.trim() : "";
    const amount =
      typeof rec.amount === "string"
        ? rec.amount.trim()
        : typeof rec.amount === "number"
          ? String(rec.amount)
          : "";
    const currencyCode = typeof rec.currency_code === "string" ? rec.currency_code.trim() : "";
    if (!type || !amount || !currencyCode) continue;
    result.paymentTypes.push({
      type,
      amount,
      currencyCode,
      isNeedCreditCardData: rec.is_need_credit_card_data === true,
      isNeedCvc: rec.is_need_cvc === true,
    });
  }

  return result;
}

/** Select the create-booking payment_types entry matching the configured model. */
export function selectPaymentType(
  paymentTypes: ParsedPaymentType[],
  model: string,
): SelectedPaymentType | null {
  const match = paymentTypes.find((p) => p.type === model);
  if (!match) return null;
  return { type: match.type, amount: match.amount, currencyCode: match.currencyCode };
}

export function selectDepositPaymentType(
  paymentTypes: ParsedPaymentType[],
): SelectedPaymentType | null {
  return selectPaymentType(paymentTypes, "deposit");
}

export type StandaloneFinishDecision = "start" | "already_started" | "not_paid";

export function decideStandaloneFinishAfterStripe(input: {
  status: string | null;
  stripePaid: boolean;
}): StandaloneFinishDecision {
  if (!input.stripePaid) return "not_paid";
  if (input.status === "payment_pending") return "start";
  return "already_started";
}

/**
 * Build `rooms[].guests[]` from the EXACT searched/prebooked occupancy and the
 * real guest names collected at checkout.
 *
 * Faithfulness rules (no fabrication):
 *   - Occupancy (adults + child ages + room grouping) is preserved exactly: one
 *     guest object per occupant, children flagged with age + is_child.
 *   - One real collected name is required per occupant (ETG lists every occupant
 *     in finish; a nameless guest cannot be sent and names must never be faked).
 *   - Names are validated as real (non-empty, not "guest"/placeholder).
 * Throws BookingContractError if occupancy is invalid or names are insufficient,
 * so the orchestrator can reject BEFORE any ETG call.
 */
export function buildBookingRooms(
  occupancy: RoomOccupancy[],
  guestNames: GuestName[],
): RoomGuests[] {
  if (!Array.isArray(occupancy) || occupancy.length === 0) {
    throw new BookingContractError("occupancy is required");
  }

  let required = 0;
  for (const room of occupancy) {
    if (!room || typeof room.adults !== "number" || room.adults < 1) {
      throw new BookingContractError("each room needs at least one adult");
    }
    const ages = Array.isArray(room.childrenAges) ? room.childrenAges : [];
    for (const age of ages) {
      if (typeof age !== "number" || age < 0 || age > 17) {
        throw new BookingContractError("child age must be 0-17");
      }
    }
    required += room.adults + ages.length;
  }

  const names = Array.isArray(guestNames) ? guestNames : [];
  if (names.length !== required) {
    throw new BookingContractError(
      `occupancy needs ${required} real guest name(s); have ${names.length}`,
    );
  }

  let cursor = 0;
  return occupancy.map((room) => {
    const guests: GuestName[] = [];
    for (let i = 0; i < room.adults; i += 1) {
      const n = names[cursor++];
      const guest: GuestName = { firstName: n.firstName, lastName: n.lastName };
      if (n.gender) {
        guest.gender = n.gender;
      }
      guests.push(guest);
    }
    for (const age of room.childrenAges) {
      const n = names[cursor++];
      const guest: GuestName = {
        firstName: n.firstName,
        lastName: n.lastName,
        isChild: true,
        age,
      };
      if (n.gender) {
        guest.gender = n.gender;
      }
      guests.push(guest);
    }
    return { guests };
  });
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

/**
 * Build the order-info / retrieve-bookings request body (by partner order id).
 *
 * Per the verified ETG docs, `partner_order_ids` belongs under `search` (NOT
 * `ordering`). `ordering` and `pagination` are required; `language` is optional.
 * page_size is bounded 1..50; we ask for a single record.
 */
export function buildOrderInfoRequest(
  partnerOrderId: string,
): Record<string, unknown> {
  if (!isValidPartnerOrderId(partnerOrderId)) {
    throw new BookingContractError("partnerOrderId must be 1-256 chars");
  }
  return {
    ordering: { ordering_type: "desc", ordering_by: "created_at" },
    pagination: { page_size: 1, page_number: 1 },
    search: { partner_order_ids: [partnerOrderId] },
    language: "en",
  };
}

// ---- ETG `now` card payment (Payota) - pure builders ----------------------
//
// The `now` payment type means ETG charges the end-user card. It requires the
// "Create credit card token" call to the Payota gateway BEFORE Start Booking,
// then Start Booking is sent with the same init_uuid/pay_uuid + return_path.
//
// Contract source: official ETG docs (verified 2026-07-01):
//   - Create credit card token: POST https://api.payota.net/api/public/v1/manage/init_partners
//       body: object_id (= booking item_id), pay_uuid (UUID4), init_uuid (UUID4),
//       user_first_name, user_last_name, is_cvc_required, cvc (when required),
//       credit_card_data_core { card_number, card_holder, month, year }.
//       Auth: HTTP Basic KEY_ID:API_KEY (same credentials as the ETG API).
//   - Start Booking (now): return_path (required), pay_uuid + init_uuid when the
//       payment_types entry has is_need_credit_card_data = true.
//   - Finish Status (3ds): status "3ds" with data.data_3ds { action_url, method,
//       data:{ MD, PaReq, TermUrl } }; after 3DS the gateway redirects to
//       return_path and the integrator re-polls Finish Status until `ok`.
//
// PCI NOTE: raw card fields (card_number, cvc, expiry, holder) exist ONLY inside
// the object returned by buildCreateCreditCardTokenRequest, which is handed
// straight to the Payota transport. They are never persisted or logged. The
// stored SelectedPaymentType (buildStoredNowSelectedPayment) is card-data-free.

/** Payota (ETG card gateway) endpoint paths. Host is separate from the ETG API. */
export const PAYOTA_ENDPOINTS = {
  /** Create credit card token. Side-effecting, NOT idempotent. */
  createCreditCardToken: "/api/public/v1/manage/init_partners",
} as const;

const UUID4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID4_RE.test(value);
}

/** Fresh UUID4 for a Payota payment (init_uuid / pay_uuid). Unique per attempt. */
export function generatePaymentUuid(): string {
  return randomUUID();
}

/**
 * Select the `now` payment_types entry to use for a standalone booking.
 * Prefers a USD-denominated entry (used for the ETG certification test), then
 * falls back to the first `now` entry. Returns a card-data-free selection with
 * the is_need_* flags preserved so the checkout form knows what to collect.
 */
export function selectNowPaymentType(
  paymentTypes: ParsedPaymentType[],
): SelectedPaymentType | null {
  const nowTypes = paymentTypes.filter((p) => p.type === "now");
  if (nowTypes.length === 0) return null;

  const usd = nowTypes.find((p) => p.currencyCode.toUpperCase() === "USD");
  const chosen = usd ?? nowTypes[0];
  return {
    type: chosen.type,
    amount: chosen.amount,
    currencyCode: chosen.currencyCode,
    isNeedCreditCardData: chosen.isNeedCreditCardData,
    isNeedCvc: chosen.isNeedCvc,
  };
}

export type StandalonePaymentSelection =
  | { mode: "deposit"; selected: SelectedPaymentType }
  | { mode: "now"; selected: SelectedPaymentType }
  | { mode: "unsupported"; selected: null };

/**
 * Decide the standalone checkout payment path from the create-booking
 * payment_types. `deposit` (B2B, Stripe) keeps priority for backwards
 * compatibility; `now` is used only when the feature flag is enabled. Anything
 * else stays unsupported.
 */
export function decideStandalonePaymentSelection(input: {
  paymentTypes: ParsedPaymentType[];
  nowEnabled: boolean;
}): StandalonePaymentSelection {
  const deposit = selectDepositPaymentType(input.paymentTypes);
  if (deposit) {
    return { mode: "deposit", selected: deposit };
  }

  if (input.nowEnabled) {
    const now = selectNowPaymentType(input.paymentTypes);
    if (now) {
      return { mode: "now", selected: now };
    }
  }

  return { mode: "unsupported", selected: null };
}

/**
 * Build the card-data-free SelectedPaymentType to persist for a `now` rate.
 * Whitelists exactly the safe fields, so no card number / cvc / expiry can ever
 * be written to the database even if the input object is polluted.
 */
export function buildStoredNowSelectedPayment(
  selected: SelectedPaymentType,
  tokens?: { initUuid?: string; payUuid?: string; returnPath?: string },
): SelectedPaymentType {
  const stored: SelectedPaymentType = {
    type: selected.type,
    amount: selected.amount,
    currencyCode: selected.currencyCode,
  };
  if (typeof selected.isNeedCreditCardData === "boolean") {
    stored.isNeedCreditCardData = selected.isNeedCreditCardData;
  }
  if (typeof selected.isNeedCvc === "boolean") {
    stored.isNeedCvc = selected.isNeedCvc;
  }
  if (tokens?.initUuid) stored.initUuid = tokens.initUuid;
  if (tokens?.payUuid) stored.payUuid = tokens.payUuid;
  if (tokens?.returnPath) stored.returnPath = tokens.returnPath;
  return stored;
}

/**
 * Raw card fields collected at checkout. Exists ONLY transiently: it is validated
 * and folded into the Payota request body, then discarded. Never persisted,
 * never logged, never returned to the browser.
 */
export type CreditCardData = {
  cardNumber: string;
  cardHolder: string;
  expiryMonth: string;
  expiryYear: string;
  cvc?: string;
};

export type CreateCreditCardTokenInput = {
  /** Booking item id from Create Booking (`item_id`). Sent as `object_id`. */
  objectId: string;
  payUuid: string;
  initUuid: string;
  userFirstName: string;
  userLastName: string;
  isCvcRequired: boolean;
  card: CreditCardData;
};

const MONTH_RE = /^(0[1-9]|1[0-2])$/;
const YEAR_RE = /^(\d{2}|\d{4})$/;
const CVC_RE = /^\d{3,4}$/;

function normalizeDigits(value: string): string {
  return value.replace(/[\s-]/g, "");
}

/**
 * Build the Payota "Create credit card token" request body. Pure assembler:
 * validates shape/format only, performs NO IO, and NEVER logs. The returned
 * object is the only place raw card data lives; the caller hands it straight to
 * the Payota transport and never stores it.
 */
export function buildCreateCreditCardTokenRequest(
  input: CreateCreditCardTokenInput,
): Record<string, unknown> {
  assertNonEmpty("objectId", input.objectId);
  if (!isUuid(input.payUuid)) {
    throw new BookingContractError("payUuid must be a UUID4");
  }
  if (!isUuid(input.initUuid)) {
    throw new BookingContractError("initUuid must be a UUID4");
  }

  const firstName = assertNonEmpty("userFirstName", input.userFirstName).trim();
  const lastName = assertNonEmpty("userLastName", input.userLastName).trim();
  if (firstName.length > 120 || lastName.length > 120) {
    throw new BookingContractError("cardholder name is too long");
  }

  const card = input.card ?? ({} as CreditCardData);
  const cardNumber = normalizeDigits(assertNonEmpty("card.cardNumber", card.cardNumber));
  if (!/^\d{12,19}$/.test(cardNumber)) {
    throw new BookingContractError("card number must be 12-19 digits");
  }
  const cardHolder = assertNonEmpty("card.cardHolder", card.cardHolder).trim();
  if (cardHolder.length > 120) {
    throw new BookingContractError("card holder is too long");
  }
  const month = assertNonEmpty("card.expiryMonth", card.expiryMonth).trim();
  if (!MONTH_RE.test(month)) {
    throw new BookingContractError("expiry month must be 01-12");
  }
  const year = assertNonEmpty("card.expiryYear", card.expiryYear).trim();
  if (!YEAR_RE.test(year)) {
    throw new BookingContractError("expiry year must be 2 or 4 digits");
  }

  const body: Record<string, unknown> = {
    object_id: input.objectId,
    pay_uuid: input.payUuid,
    init_uuid: input.initUuid,
    user_first_name: firstName,
    user_last_name: lastName,
    is_cvc_required: input.isCvcRequired === true,
    credit_card_data_core: {
      year,
      month,
      card_number: cardNumber,
      card_holder: cardHolder,
    },
  };

  if (input.isCvcRequired) {
    const cvc = normalizeDigits(assertNonEmpty("card.cvc", card.cvc ?? ""));
    if (!CVC_RE.test(cvc)) {
      throw new BookingContractError("cvc must be 3-4 digits");
    }
    body.cvc = cvc;
  }

  return body;
}

/** Classify the Payota "Create credit card token" response. */
export function classifyCreditCardToken(
  signal: ProviderResponseSignal,
): BookingClassification {
  if (isOkStatus(signal)) {
    return { kind: "success" };
  }

  const error = norm(signal.error);
  if (error) {
    return { kind: "failed", code: error };
  }

  if (typeof signal.httpStatus === "number" && signal.httpStatus >= 400) {
    return { kind: "failed", code: "http_error" };
  }

  return { kind: "unknown" };
}

/**
 * Parse the data.data_3ds block from a Finish Status "3ds" response into a
 * browser-safe redirect instruction. Returns null when the block is absent or
 * malformed (caller then keeps polling). Contains NO card data - only the ETG
 * 3DS ACS redirect (action_url + opaque MD/PaReq/TermUrl fields).
 */
export type ThreeDsRedirect = {
  actionUrl: string;
  method: "get" | "post";
  fields: Record<string, string>;
};

export function parseThreeDsRedirect(data: unknown): ThreeDsRedirect | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;
  const block = root.data_3ds;
  if (!block || typeof block !== "object") return null;

  const rec = block as Record<string, unknown>;
  const actionUrl = typeof rec.action_url === "string" ? rec.action_url.trim() : "";
  if (!/^https:\/\//i.test(actionUrl)) return null;

  const method = norm(typeof rec.method === "string" ? rec.method : "post") === "get" ? "get" : "post";

  const fields: Record<string, string> = {};
  const inner = rec.data;
  if (inner && typeof inner === "object") {
    for (const [key, value] of Object.entries(inner as Record<string, unknown>)) {
      if (typeof value === "string") {
        fields[key] = value;
      } else if (typeof value === "number" || typeof value === "boolean") {
        fields[key] = String(value);
      }
    }
  }

  return { actionUrl, method, fields };
}
