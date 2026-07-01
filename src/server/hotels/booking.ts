import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { requireEmail } from "@/server/http/validation";
import {
  getHotelQuoteSnapshotForBooking,
  getOwnedHotelSearchSessionForBooking,
  HOTEL_SEARCH_COOKIE,
} from "@/server/hotels/search";
import {
  DEFAULT_STANDALONE_CONFIRMATION_WINDOW_SECONDS,
  STANDALONE_STRIPE_CLAIM_STALE_MS,
  decideStandaloneStripeCheckoutClaim,
  getStandaloneBookingCutoffAt,
  isStandaloneBookingCutoffReached,
  isStandaloneStatusPollEligible,
  nextStandaloneStatusAfterFinishException,
  nextStandaloneStatusFromStatusClassification,
  type StandaloneHotelBookingStatus,
} from "@/server/hotels/booking-state";
import {
  getStripe,
  hasStripeEnv,
  toStripeAmount,
  fromStripeAmount,
} from "@/server/payments/stripe";
import {
  isRateHawkConfigured,
  resolveRateHawkEnv,
} from "@/server/providers/ratehawk/config";
import { rateHawkBookingRequest } from "@/server/providers/ratehawk/client";
import {
  mapMealToBoardBasis,
  prebookHotelRate,
  type HotelPrebookResult,
} from "@/server/providers/ratehawk/hotels";
import {
  BOOKING_ENDPOINTS,
  BOOKING_FORM_LIFETIME_MS,
  MAX_CREATE_BOOKING_RETRIES,
  STATUS_POLL_INTERVAL_MS,
  buildBookingStatusRequest,
  buildCreateBookingRequest,
  buildStartBookingRequest,
  classifyBookingFinish,
  classifyBookingStatus,
  classifyCreateBooking,
  decideStandaloneFinishAfterStripe,
  generatePartnerOrderId,
  isHotelPageBookHash,
  isPrebookBookHash,
  parseCreateBookingResponse,
  selectDepositPaymentType,
  type GuestName,
  type ParsedPaymentType,
  type RoomGuests,
  type SelectedPaymentType,
} from "@/server/providers/ratehawk/booking/contracts";
import {
  validateCheckoutGuestRooms,
  type ValidatedCheckoutGuestRoom,
} from "@/server/providers/ratehawk/booking/checkout-guests";
import { extractTrustedUserIp } from "@/server/providers/ratehawk/booking/ip-trust";
import { getSupabaseAdminClient } from "@/server/supabase/client";
import type { HotelGuestRoom } from "@/types/hotels";
import type { CheckoutGuestRoom } from "@/types/itinerary";

export const HOTEL_CHECKOUT_COOKIE = "flytime_hotel_checkout";
export const HOTEL_CHECKOUT_TTL_SECONDS = 30 * 60;
export const STANDALONE_PREBOOK_PUBLIC_ERROR_MESSAGE =
  "The hotel rate cannot be booked right now.";

export type StandaloneHotelPrebookErrorCode =
  | "invalid_payload"
  | "hotelpage_snapshot_missing"
  | "rate_not_found"
  | "selected_rate_missing_hash"
  | "provider_prebook_http_error"
  | "provider_prebook_rejected"
  | "provider_prebook_parse_error"
  | "provider_booking_form_http_error"
  | "provider_booking_form_rejected"
  | "provider_booking_form_parse_error"
  | "unsupported_payment_type"
  | "price_currency_mismatch"
  | "booking_session_create_failed";

type StandalonePrebookProviderFailureLog = {
  status?: string | number | null;
  httpStatus?: number | null;
  code?: string | null;
  message?: string | null;
  transportCode?: string | null;
};

export type StandaloneHotelProviderDebug = {
  providerStage: "prebook" | "booking_form";
  providerStatus: number | null;
  providerCode: string | null;
  providerMessage: string | null;
};

type StandalonePrebookFailureLog = {
  hotelId?: string | null;
  searchId?: string | null;
  rateId?: string | null;
  provider?: StandalonePrebookProviderFailureLog | null;
  selectedRateExists?: boolean | null;
  selectedRateHasProviderHash?: boolean | null;
  hotelpageSnapshotExists?: boolean | null;
  prebookReturnedProviderHash?: boolean | null;
  paymentTypeNames?: string[] | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

type StandaloneStatus = StandaloneHotelBookingStatus;

type StandaloneSessionRow = {
  id: string;
  search_session_id: string;
  provider_id: string | null;
  booking_id: string | null;
  hotelpage_quote_id: string | null;
  prebook_snapshot_id: string | null;
  checkout_token_hash: string;
  hotel_id: string;
  hotel_name: string;
  room_name: string | null;
  board_basis: string | null;
  checkin: string;
  checkout: string;
  residency: string;
  guests: HotelGuestRoom[];
  language: string;
  status: StandaloneStatus;
  price_at_hotelpage: number | string | null;
  price_at_prebook: number | string | null;
  currency: string;
  price_changed: boolean;
  cancellation_summary: string | null;
  cancellation_free_before: string | null;
  partner_order_id: string;
  provider_order_id: string | null;
  provider_order_item_id: string | null;
  payment_types: ParsedPaymentType[];
  selected_payment_type: SelectedPaymentType | null;
  is_gender_specification_required: boolean;
  supplier_data_requirements: Record<string, unknown> | null;
  upsell_data: Record<string, unknown> | null;
  user_ip: string | null;
  contact: Record<string, unknown> | null;
  guest_rooms: ValidatedCheckoutGuestRoom[] | null;
  stripe_checkout_claim_id: string | null;
  stripe_checkout_claimed_at: string | null;
  stripe_checkout_session_id: string | null;
  stripe_checkout_url: string | null;
  stripe_payment_intent_id: string | null;
  stripe_completed_event_id: string | null;
  paid_amount: number | string | null;
  paid_currency: string | null;
  paid_at: string | null;
  booking_cutoff_at: string | null;
  finish_started_at: string | null;
  finish_status_last_checked_at: string | null;
  finish_status_poll_count: number;
  provider_result_code: string | null;
  confirmed_at: string | null;
  failed_at: string | null;
  expires_at: string;
};

export type StandaloneHotelPrebookResult = {
  checkoutId: string;
  checkoutToken: string;
  checkoutUrl: string;
  paymentMode: "deposit" | "unsupported";
  unsupportedReason: string | null;
  priceChanged: boolean;
  oldPrice: { amount: number; currency: string };
  newPrice: { amount: number; currency: string };
};

export type StandaloneHotelCheckoutSummary = {
  checkoutId: string;
  status: StandaloneStatus;
  hotel: { id: string; name: string; roomName: string | null; boardBasis: string | null };
  checkIn: string;
  checkOut: string;
  residency: string;
  rooms: CheckoutGuestRoom[];
  price: { amount: number; currency: string };
  originalPrice: { amount: number; currency: string } | null;
  priceChanged: boolean;
  cancellationSummary: string | null;
  cancellationFreeBefore: string | null;
  payment:
    | { mode: "deposit"; amount: string; currencyCode: string }
    | { mode: "unsupported"; reason: string; returnedTypes: string[] };
  isGenderSpecificationRequired: boolean;
};

export type StandaloneCheckoutLookupDebug = {
  checkoutTokenPresent: boolean;
  tokenHashGenerated: boolean;
  sessionFound: boolean;
  expiresAtExpired: boolean | null;
  sessionStatus: StandaloneStatus | null;
};

export type StandaloneHotelPublicStatus = {
  checkoutId: string;
  state: "pending" | "in_progress" | "confirmed" | "failed" | "review" | "unsupported";
  message: string;
  nextAction: "wait" | "contact_support" | null;
};

export class StandaloneHotelBookingError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly providerDebug: StandaloneHotelProviderDebug | null;

  constructor(
    status: number,
    message: string,
    code: string | null = null,
    providerDebug: StandaloneHotelProviderDebug | null = null,
  ) {
    super(message);
    this.name = "StandaloneHotelBookingError";
    this.status = status;
    this.code = code;
    this.providerDebug = providerDebug;
  }
}

export function logStandalonePrebookFailure(
  code: StandaloneHotelPrebookErrorCode,
  context: StandalonePrebookFailureLog,
): void {
  console.error("[standalone.hotel.prebook.failure]", {
    code,
    hotelId: safeLogText(context.hotelId, 160),
    searchId: safeLogText(context.searchId, 80),
    rateId: safeLogText(context.rateId, 80),
    provider: context.provider
      ? {
          status: safeLogText(context.provider.status, 80),
          code: safeLogText(context.provider.code, 80),
          message: safeLogText(context.provider.message, 240),
        }
      : null,
    selectedRateExists: context.selectedRateExists ?? null,
    selectedRateHasProviderHash: context.selectedRateHasProviderHash ?? null,
    hotelpageSnapshotExists: context.hotelpageSnapshotExists ?? null,
    prebookReturnedProviderHash: context.prebookReturnedProviderHash ?? null,
    paymentTypeNames: safePaymentTypeNames(context.paymentTypeNames ?? []),
  });
}

function logStandaloneCheckoutLookup(debug: StandaloneCheckoutLookupDebug): void {
  console.error("[standalone.hotel.checkout.lookup]", debug);
}

export function isStandaloneHotelBookingEnabled(): boolean {
  return getStandaloneHotelBookingDisabledReason() === null;
}

export function getStandaloneHotelBookingDisabledReason(): string | null {
  if ((process.env.RATEHAWK_BOOKING_ENABLED ?? "").trim().toLowerCase() !== "true") {
    return "RATEHAWK_BOOKING_ENABLED is not 'true'";
  }

  const env = resolveRateHawkEnv().toLowerCase();
  if (env === "prod" || env === "production") {
    return "real ETG booking is not enabled in production";
  }

  if (!isRateHawkConfigured()) {
    return "RateHawk provider credentials are not configured";
  }

  return null;
}

export async function startStandaloneHotelPrebook(input: {
  searchId: string;
  hotelId: string;
  rateId: string;
  hotelSearchToken: string | undefined;
  headers: Headers;
  signal?: AbortSignal;
}): Promise<StandaloneHotelPrebookResult> {
  const disabled = getStandaloneHotelBookingDisabledReason();
  if (disabled) {
    throw new StandaloneHotelBookingError(
      503,
      `Hotel booking is not enabled: ${disabled}.`,
    );
  }

  const userIp = extractTrustedUserIp(input.headers);
  if (!userIp) {
    throw new StandaloneHotelBookingError(
      400,
      "We could not verify your network details. Please contact us to book this hotel.",
    );
  }

  const session = await getOwnedHotelSearchSessionForBooking(
    input.searchId,
    input.hotelSearchToken,
  );
  if (!session) {
    throw new StandaloneHotelBookingError(404, "This hotel search has expired.");
  }

  const hotelpageQuote = await getHotelQuoteSnapshotForBooking({
    searchId: session.id,
    hotelId: input.hotelId,
    quoteId: input.rateId,
    stage: "hotelpage",
  });
  if (!hotelpageQuote) {
    const snapshotDebug = await inspectStandalonePrebookSnapshot({
      searchId: session.id,
      hotelId: input.hotelId,
      rateId: input.rateId,
    });
    const code =
      snapshotDebug.selectedRateExists === false
        ? "rate_not_found"
        : "hotelpage_snapshot_missing";
    logStandalonePrebookFailure(code, {
      hotelId: input.hotelId,
      searchId: input.searchId,
      rateId: input.rateId,
      ...snapshotDebug,
    });
    throw new StandaloneHotelBookingError(
      409,
      STANDALONE_PREBOOK_PUBLIC_ERROR_MESSAGE,
      code,
    );
  }

  const hotelpageHash =
    typeof hotelpageQuote.metadata?.book_hash === "string"
      ? hotelpageQuote.metadata.book_hash
      : null;
  const baseFailureLog = {
    hotelId: input.hotelId,
    searchId: input.searchId,
    rateId: input.rateId,
    selectedRateExists: true,
    selectedRateHasProviderHash: isHotelPageBookHash(hotelpageHash),
    hotelpageSnapshotExists: true,
  } satisfies StandalonePrebookFailureLog;
  if (!isHotelPageBookHash(hotelpageHash)) {
    logStandalonePrebookFailure("selected_rate_missing_hash", baseFailureLog);
    throw new StandaloneHotelBookingError(
      409,
      STANDALONE_PREBOOK_PUBLIC_ERROR_MESSAGE,
      "selected_rate_missing_hash",
    );
  }

  let prebook: HotelPrebookResult;
  try {
    prebook = await prebookHotelRate(
      hotelpageHash,
      session.language,
      input.signal,
    );
  } catch (error) {
    const failure = classifyProviderException("prebook", error);
    logStandalonePrebookFailure(failure.code, {
      ...baseFailureLog,
      provider: failure.provider,
      prebookReturnedProviderHash: false,
    });
    throw new StandaloneHotelBookingError(
      409,
      STANDALONE_PREBOOK_PUBLIC_ERROR_MESSAGE,
      failure.code,
      failure.debug,
    );
  }

  if (!isPrebookBookHash(prebook.prebookHash)) {
    const debug = buildProviderDebug("prebook", {
      code: "missing_prebook_hash",
      message: "Provider prebook response missing booking hash",
    });
    logStandalonePrebookFailure("provider_prebook_parse_error", {
      ...baseFailureLog,
      provider: {
        code: debug.providerCode,
        message: debug.providerMessage,
      },
      prebookReturnedProviderHash: false,
    });
    throw new StandaloneHotelBookingError(
      409,
      STANDALONE_PREBOOK_PUBLIC_ERROR_MESSAGE,
      "provider_prebook_parse_error",
      debug,
    );
  }

  const prebookFailureLog = {
    ...baseFailureLog,
    prebookReturnedProviderHash: true,
  } satisfies StandalonePrebookFailureLog;
  const form = await createBookingFormWithRetries({
    prebookHash: prebook.prebookHash,
    language: session.language,
    userIp,
    failureLog: prebookFailureLog,
  });
  const deposit = selectDepositPaymentType(form.paymentTypes);
  const checkoutToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + Math.min(HOTEL_CHECKOUT_TTL_SECONDS * 1000, BOOKING_FORM_LIFETIME_MS),
  ).toISOString();
  const priceAtHotelpage = money(hotelpageQuote.price_amount);
  const priceAtPrebook = prebook.priceAmount;
  const hotelpageCurrency = readText(hotelpageQuote.currency) ?? session.currency;
  const prebookCurrency = readText(prebook.currency);
  if (
    prebookCurrency &&
    hotelpageCurrency &&
    prebookCurrency.toUpperCase() !== hotelpageCurrency.toUpperCase()
  ) {
    logStandalonePrebookFailure("price_currency_mismatch", {
      ...prebookFailureLog,
      paymentTypeNames: form.paymentTypes.map((paymentType) => paymentType.type),
    });
    throw new StandaloneHotelBookingError(
      409,
      STANDALONE_PREBOOK_PUBLIC_ERROR_MESSAGE,
      "price_currency_mismatch",
    );
  }
  const currency = prebookCurrency ?? hotelpageCurrency;
  const priceChanged = Math.abs(priceAtHotelpage - priceAtPrebook) >= 0.01;
  const searchQuote = await readStandaloneSearchQuote(session.id, input.hotelId);
  const hotelName =
    readText(searchQuote?.safe_payload?.name) ??
    readText(hotelpageQuote.safe_payload?.name) ??
    readText(hotelpageQuote.safe_payload?.hotel_name) ??
    "Hotel";
  const roomName =
    prebook.roomName ??
    readText(hotelpageQuote.safe_payload?.room_name);
  const boardBasis =
    (prebook.meal ? mapMealToBoardBasis(prebook.meal) : undefined) ??
    readText(hotelpageQuote.safe_payload?.board_basis);

  const admin = getSupabaseAdminClient();
  const prebookSnapshot = await admin
    .from("provider_quote_snapshots")
    .insert({
      provider_id: session.provider_id,
      search_session_id: session.id,
      service_type: "hotel",
      request_hash: `standalone-prebook:${hotelpageQuote.id}`,
      provider_reference: input.hotelId,
      currency,
      price_amount: priceAtPrebook,
      price_delta_amount: priceAtPrebook,
      expires_at: expiresAt,
      status: "selected",
      safe_payload: {
        stage: "prebook",
        room_name: roomName,
        board_basis: boardBasis,
        cancellation_summary: buildCancellationSummary(
          prebook.cancellationFreeBefore,
          prebook.cancellationPolicies.length,
        ),
        cancellation_free_before: prebook.cancellationFreeBefore,
        policies_count: prebook.cancellationPolicies.length,
        price_at_prebook: priceAtPrebook,
        price_at_hotelpage: priceAtHotelpage,
      },
      metadata: {
        prebook_hash: prebook.prebookHash,
        quote_snapshot_id: hotelpageQuote.id,
        hotelpage_book_hash_used: hotelpageHash,
      },
    })
    .select("id")
    .single();
  if (prebookSnapshot.error || !prebookSnapshot.data) {
    logStandalonePrebookFailure("booking_session_create_failed", {
      ...prebookFailureLog,
      paymentTypeNames: form.paymentTypes.map((paymentType) => paymentType.type),
    });
    throw new StandaloneHotelBookingError(
      500,
      STANDALONE_PREBOOK_PUBLIC_ERROR_MESSAGE,
      "booking_session_create_failed",
    );
  }

  const status: StandaloneStatus = deposit ? "form_created" : "unsupported_payment";
  const insert = await admin
    .from("standalone_hotel_booking_sessions")
    .insert({
      search_session_id: session.id,
      provider_id: session.provider_id,
      hotelpage_quote_id: hotelpageQuote.id,
      prebook_snapshot_id: (prebookSnapshot.data as { id: string }).id,
      checkout_token_hash: hashToken(checkoutToken),
      hotel_id: input.hotelId,
      hotel_name: hotelName,
      room_name: roomName,
      board_basis: boardBasis,
      checkin: session.checkin,
      checkout: session.checkout,
      residency: session.residency,
      guests: session.guests,
      language: session.language,
      status,
      price_at_hotelpage: priceAtHotelpage,
      price_at_prebook: priceAtPrebook,
      currency,
      price_changed: priceChanged,
      cancellation_summary: buildCancellationSummary(
        prebook.cancellationFreeBefore,
        prebook.cancellationPolicies.length,
      ),
      cancellation_free_before: prebook.cancellationFreeBefore,
      partner_order_id: form.partnerOrderId,
      provider_order_id: form.orderId,
      provider_order_item_id: form.itemId,
      payment_types: form.paymentTypes,
      selected_payment_type: deposit,
      is_gender_specification_required: form.isGenderSpecificationRequired,
      supplier_data_requirements: form.supplierDataRequirements,
      upsell_data: form.upsellData,
      user_ip: userIp,
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (insert.error || !insert.data) {
    logStandalonePrebookFailure("booking_session_create_failed", {
      ...prebookFailureLog,
      paymentTypeNames: form.paymentTypes.map((paymentType) => paymentType.type),
    });
    throw new StandaloneHotelBookingError(
      500,
      STANDALONE_PREBOOK_PUBLIC_ERROR_MESSAGE,
      "booking_session_create_failed",
    );
  }

  const checkoutId = (insert.data as { id: string }).id;
  return {
    checkoutId,
    checkoutToken,
    checkoutUrl: `/hotels/checkout?checkout=${encodeURIComponent(checkoutId)}`,
    paymentMode: deposit ? "deposit" : "unsupported",
    unsupportedReason: deposit
      ? null
      : unsupportedPaymentReason(form.paymentTypes.map((p) => p.type)),
    priceChanged,
    oldPrice: { amount: priceAtHotelpage, currency: hotelpageCurrency },
    newPrice: { amount: priceAtPrebook, currency },
  };
}

export async function getStandaloneHotelCheckoutSummary(
  checkoutId: string,
  checkoutToken: string | undefined,
): Promise<StandaloneHotelCheckoutSummary | null> {
  const row = await loadStandaloneSession(checkoutId, checkoutToken);
  if (!row) return null;
  await mirrorBookingTerminalState(row);

  const selected = row.selected_payment_type;
  return {
    checkoutId: row.id,
    status: row.status,
    hotel: {
      id: row.hotel_id,
      name: row.hotel_name,
      roomName: row.room_name,
      boardBasis: row.board_basis,
    },
    checkIn: row.checkin,
    checkOut: row.checkout,
    residency: row.residency,
    rooms: buildCheckoutGuestRooms(row.guests),
    price: { amount: money(row.price_at_prebook), currency: row.currency },
    originalPrice: row.price_changed
      ? { amount: money(row.price_at_hotelpage), currency: row.currency }
      : null,
    priceChanged: row.price_changed,
    cancellationSummary: row.cancellation_summary,
    cancellationFreeBefore: row.cancellation_free_before,
    payment:
      selected?.type === "deposit"
        ? { mode: "deposit", amount: selected.amount, currencyCode: selected.currencyCode }
        : {
            mode: "unsupported",
            reason: unsupportedPaymentReason(row.payment_types.map((p) => p.type)),
            returnedTypes: row.payment_types.map((p) => p.type),
          },
    isGenderSpecificationRequired: row.is_gender_specification_required,
  };
}

export async function inspectStandaloneHotelCheckoutLookup(
  checkoutId: string,
  checkoutToken: string | undefined,
): Promise<StandaloneCheckoutLookupDebug> {
  const checkoutTokenPresent = Boolean(checkoutToken);
  const tokenHash =
    checkoutToken && checkoutToken.length <= 160 ? hashToken(checkoutToken) : null;
  const debug: StandaloneCheckoutLookupDebug = {
    checkoutTokenPresent,
    tokenHashGenerated: Boolean(tokenHash),
    sessionFound: false,
    expiresAtExpired: null,
    sessionStatus: null,
  };

  if (!UUID_RE.test(checkoutId)) {
    logStandaloneCheckoutLookup(debug);
    return debug;
  }

  const result = await getSupabaseAdminClient()
    .from("standalone_hotel_booking_sessions")
    .select("checkout_token_hash,status,expires_at")
    .eq("id", checkoutId)
    .maybeSingle();

  if (result.error) throw result.error;

  const row = (result.data ?? null) as Record<string, unknown> | null;
  if (!row) {
    logStandaloneCheckoutLookup(debug);
    return debug;
  }

  const expiresAt = readText(row.expires_at);
  const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : Number.NaN;
  const expired = Number.isFinite(expiresAtMs) ? expiresAtMs <= Date.now() : null;
  const storedHash = readText(row.checkout_token_hash);

  debug.expiresAtExpired = expired;
  debug.sessionStatus = normalizeStatus(row.status);
  debug.sessionFound = Boolean(tokenHash && storedHash === tokenHash && expired === false);

  logStandaloneCheckoutLookup(debug);
  return debug;
}

export async function createStandaloneHotelStripeSession(input: {
  checkoutId: string;
  checkoutToken: string | undefined;
  contact: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    comment?: string | null;
  };
  guestRooms: unknown;
}): Promise<{ url: string }> {
  if (!hasStripeEnv()) {
    throw new StandaloneHotelBookingError(503, "Payment service is not available.");
  }

  const disabled = getStandaloneHotelBookingDisabledReason();
  if (disabled) {
    throw new StandaloneHotelBookingError(
      503,
      `Hotel booking is not enabled: ${disabled}.`,
    );
  }

  const row = await loadStandaloneSession(input.checkoutId, input.checkoutToken);
  if (!row) {
    throw new StandaloneHotelBookingError(404, "This hotel checkout has expired.");
  }

  if (row.status === "unsupported_payment") {
    throw new StandaloneHotelBookingError(
      409,
      unsupportedPaymentReason(row.payment_types.map((p) => p.type)),
    );
  }

  if (!row.selected_payment_type || row.selected_payment_type.type !== "deposit") {
    throw new StandaloneHotelBookingError(
      409,
      "Card payment is unavailable because ETG did not return a deposit payment option.",
    );
  }

  if (row.status === "payment_pending" && row.stripe_checkout_url) {
    return { url: row.stripe_checkout_url };
  }

  const expectedRooms = buildCheckoutGuestRooms(row.guests);
  const validated = validateCheckoutGuestRooms(input.guestRooms, expectedRooms);
  if (!validated.ok || !validated.rooms) {
    throw new StandaloneHotelBookingError(400, "Please review guest details and try again.");
  }
  if (
    row.is_gender_specification_required &&
    validated.rooms.some((room) => room.guests.some((guest) => guest.gender === "unknown"))
  ) {
    throw new StandaloneHotelBookingError(400, "Guest gender is required for this hotel rate.");
  }

  const email = requireEmail(input.contact.email);
  const firstName = cleanRequiredText(input.contact.firstName, "firstName");
  const lastName = cleanRequiredText(input.contact.lastName, "lastName");
  const phone = cleanRequiredText(input.contact.phone, "phone");
  const comment = cleanOptionalText(input.contact.comment, 2000);
  const selectedPayment = row.selected_payment_type;
  const stripeCurrency = selectedPayment.currencyCode.toLowerCase();
  const amount = Number(selectedPayment.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new StandaloneHotelBookingError(409, "The provider returned an invalid payment amount.");
  }

  const claimId = randomBytes(18).toString("base64url");
  const contact = { firstName, lastName, email, phone, ...(comment ? { comment } : {}) };
  const claim = await claimStandaloneStripeCheckout({
    row,
    claimId,
    contact,
    guestRooms: validated.rooms,
  });

  if ("url" in claim) {
    return { url: claim.url };
  }

  let claimed = claim.row;
  let sessionId: string | null = null;

  try {
    const bookingId = claimed.booking_id ?? (await createStandaloneBookingRow({
      row: claimed,
      firstName,
      lastName,
      email,
      phone,
      comment,
      guestRooms: validated.rooms,
    }));

    if (!claimed.booking_id) {
      claimed = await attachBookingToStandaloneCheckout({
        row: claimed,
        claimId,
        bookingId,
      });
    }

    const stripe = getStripe();
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: stripeCurrency,
              product_data: {
                name: `${claimed.hotel_name} - Hotel booking`,
                description:
                  [claimed.room_name, claimed.board_basis].filter(Boolean).join(" - ") ||
                  undefined,
              },
              unit_amount: toStripeAmount(amount, stripeCurrency),
            },
            quantity: 1,
          },
        ],
        customer_email: email,
        success_url: `${siteUrl}/hotels/checkout/success?checkout_id=${claimed.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/hotels/checkout?checkout=${claimed.id}`,
        client_reference_id: bookingId,
        metadata: {
          booking_id: bookingId,
          standalone_checkout_id: claimed.id,
          charge_type: "standalone_hotel_deposit",
        },
        payment_intent_data: {
          metadata: {
            booking_id: bookingId,
            standalone_checkout_id: claimed.id,
            charge_type: "standalone_hotel_deposit",
          },
        },
        expires_at: Math.floor(Date.now() / 1000) + HOTEL_CHECKOUT_TTL_SECONDS,
      },
      {
        idempotencyKey: `standalone-hotel-stripe:${claimed.id}:${claimId}`,
      },
    );

    sessionId = session.id;
    if (!session.url) {
      throw new Error("Stripe session returned no URL");
    }

    await persistStandaloneStripeSession({
      row: claimed,
      claimId,
      bookingId,
      stripeSessionId: session.id,
      stripeUrl: session.url,
    });

    return { url: session.url };
  } catch (error) {
    if (sessionId) {
      await expireStripeSessionQuietly(sessionId);
      await markStandaloneReview(claimed, "stripe_session_persist_failed");
    } else {
      await releaseStandaloneStripeClaim(claimed, claimId);
    }

    throw error;
  }
}

export async function handleStandaloneHotelStripePaymentSucceeded(input: {
  checkoutId: string | null | undefined;
  stripeSessionId: string;
  stripePaymentIntentId: string | null;
  amountTotal: number | null;
  currency: string | null;
  eventId: string;
}): Promise<"started" | "ignored" | "failed"> {
  if (!input.checkoutId || !UUID_RE.test(input.checkoutId)) return "ignored";

  const admin = getSupabaseAdminClient();
  const loaded = await admin
    .from("standalone_hotel_booking_sessions")
    .select("*")
    .eq("id", input.checkoutId)
    .eq("stripe_checkout_session_id", input.stripeSessionId)
    .maybeSingle();
  if (loaded.error) throw loaded.error;
  if (!loaded.data) return "ignored";

  const row = normalizeStandaloneRow(loaded.data as Record<string, unknown>);
  const selected = row.selected_payment_type;
  if (!selected || selected.type !== "deposit") return "ignored";

  if (!stripeAmountMatches({ row, amountTotal: input.amountTotal, currency: input.currency })) {
    await markStandaloneFailed(row, "stripe_amount_mismatch");
    return "failed";
  }

  const decision = decideStandaloneFinishAfterStripe({
    status: row.status,
    stripePaid: true,
  });
  if (decision !== "start") return "ignored";

  const paidAmount =
    input.amountTotal != null && input.currency
      ? fromStripeAmount(input.amountTotal, input.currency)
      : Number(selected.amount);
  const paidCurrency = (input.currency ?? selected.currencyCode).toUpperCase();

  const claim = await admin
    .from("standalone_hotel_booking_sessions")
    .update({
      status: "finish_started",
      stripe_payment_intent_id: input.stripePaymentIntentId,
      stripe_completed_event_id: input.eventId,
      paid_amount: paidAmount,
      paid_currency: paidCurrency,
      paid_at: new Date().toISOString(),
      finish_started_at: new Date().toISOString(),
      booking_cutoff_at: getStandaloneBookingCutoffAt({
        bookingCutoffAt: null,
        finishStartedAt: new Date().toISOString(),
        confirmationWindowMs: getStandaloneBookingConfirmationWindowMs(),
      }),
    })
    .eq("id", row.id)
    .eq("status", "payment_pending")
    .select("*")
    .maybeSingle();

  if (claim.error) throw claim.error;
  if (!claim.data) return "ignored";

  const claimed = normalizeStandaloneRow(claim.data as Record<string, unknown>);
  if (claimed.booking_id) {
    const booking = await admin
      .from("bookings")
      .update({
        payment_status: "paid",
        stripe_payment_intent_id: input.stripePaymentIntentId,
        paid_amount: paidAmount,
        paid_currency: paidCurrency,
        paid_at: new Date().toISOString(),
        provider_order_status: "starting",
        provider_last_status_at: new Date().toISOString(),
      })
      .eq("id", claimed.booking_id);
    if (booking.error) throw booking.error;
  }

  try {
    await startStandaloneBookingFinish(claimed);
  } catch {
    await updateStandaloneAndBooking(claimed, {
      session: {
        status: nextStandaloneStatusAfterFinishException(),
        provider_result_code: "booking_finish_exception",
      },
      booking: {
        provider_order_status: "processing",
        provider_result_code: "booking_finish_exception",
        provider_last_status_at: new Date().toISOString(),
      },
    });
  }
  return "started";
}

export async function ensureStandaloneHotelStripeSuccessFromSession(input: {
  checkoutId: string;
  stripeSessionId: string;
}): Promise<void> {
  if (!hasStripeEnv()) return;

  const session = await getStripe().checkout.sessions.retrieve(input.stripeSessionId);
  if (session.payment_status !== "paid") return;

  await handleStandaloneHotelStripePaymentSucceeded({
    checkoutId: input.checkoutId,
    stripeSessionId: session.id,
    stripePaymentIntentId:
      typeof session.payment_intent === "string" ? session.payment_intent : null,
    amountTotal: session.amount_total,
    currency: session.currency,
    eventId: `success:${session.id}`,
  });
}

export async function getStandaloneHotelPublicStatus(input: {
  checkoutId: string;
  checkoutToken: string | undefined;
  stripeSessionId?: string | null;
}): Promise<StandaloneHotelPublicStatus | null> {
  if (input.stripeSessionId) {
    await ensureStandaloneHotelStripeSuccessFromSession({
      checkoutId: input.checkoutId,
      stripeSessionId: input.stripeSessionId,
    });
  }

  const row = await loadStandaloneSession(input.checkoutId, input.checkoutToken, {
    allowExpired: true,
  });
  if (!row) return null;

  await mirrorBookingTerminalState(row);
  const fresh = await loadStandaloneSession(input.checkoutId, input.checkoutToken, {
    allowExpired: true,
  });
  const current = fresh ?? row;

  if (isStandaloneStatusPollEligible(current.status)) {
    await maybePollStandaloneStatus(current);
  }

  const latest = await loadStandaloneSession(input.checkoutId, input.checkoutToken, {
    allowExpired: true,
  });
  return toPublicStatus(latest ?? current);
}

export function getHotelSearchCookieName() {
  return HOTEL_SEARCH_COOKIE;
}

async function createBookingFormWithRetries(input: {
  prebookHash: string;
  language: string;
  userIp: string;
  failureLog: StandalonePrebookFailureLog;
}): Promise<{
  partnerOrderId: string;
  orderId: string | null;
  itemId: string | null;
  paymentTypes: ParsedPaymentType[];
  isGenderSpecificationRequired: boolean;
  supplierDataRequirements: Record<string, unknown> | null;
  upsellData: Record<string, unknown> | null;
}> {
  let lastCode: string | null = null;
  let lastProvider: StandalonePrebookProviderFailureLog | null = null;

  for (let attempt = 0; attempt < MAX_CREATE_BOOKING_RETRIES; attempt += 1) {
    const partnerOrderId = generatePartnerOrderId();
    const body = buildCreateBookingRequest({
      bookHash: input.prebookHash,
      partnerOrderId,
      language: input.language,
      userIp: input.userIp,
    });

    let signal: Awaited<ReturnType<typeof rateHawkBookingRequest>>;
    try {
      signal = await rateHawkBookingRequest(BOOKING_ENDPOINTS.createBookingForm, body);
    } catch (error) {
      const failure = classifyProviderException("booking_form", error);
      logStandalonePrebookFailure(failure.code, {
        ...input.failureLog,
        provider: failure.provider,
        paymentTypeNames: [],
      });
      throw new StandaloneHotelBookingError(
        409,
        STANDALONE_PREBOOK_PUBLIC_ERROR_MESSAGE,
        failure.code,
        failure.debug,
      );
    }
    const classification = classifyCreateBooking(signal);
    lastCode = signal.error ?? signal.status;
    lastProvider = readProviderFailure(signal);

    if (classification.kind === "proceed") {
      const parsed = parseCreateBookingResponse(signal.data);
      return {
        partnerOrderId,
        orderId: parsed.orderId,
        itemId: parsed.itemId,
        paymentTypes: parsed.paymentTypes,
        isGenderSpecificationRequired: parsed.isGenderSpecificationRequired,
        supplierDataRequirements: readRecord(signal.data, "supplier_data"),
        upsellData: readRecord(signal.data, "upsell_data"),
      };
    }

    if (classification.kind !== "retry") {
      const kind = classification.kind === "failed" ? "rejected" : "parse_error";
      const code = providerStageErrorCode("booking_form", kind);
      const debug = buildProviderDebug("booking_form", readProviderFailure(signal), {
        fallbackCode:
          classification.kind === "failed"
            ? (classification.code ?? "booking_form_rejected")
            : "unsupported_booking_form_response",
        fallbackMessage:
          classification.kind === "failed"
            ? "Provider rejected the booking form request"
            : "Provider returned an unsupported booking form response",
      });
      logStandalonePrebookFailure(code, {
        ...input.failureLog,
        provider: readProviderFailure(signal),
        paymentTypeNames: [],
      });
      throw new StandaloneHotelBookingError(
        409,
        STANDALONE_PREBOOK_PUBLIC_ERROR_MESSAGE,
        code,
        debug,
      );
    }
  }

  const exhaustedKind = isHttpLikeProviderFailure(lastProvider) ? "http_error" : "rejected";
  const exhaustedCode = providerStageErrorCode("booking_form", exhaustedKind);
  const exhaustedDebug = buildProviderDebug(
    "booking_form",
    lastProvider ?? { code: lastCode ?? "retry_exhausted" },
    {
      fallbackCode: lastCode ?? "retry_exhausted",
      fallbackMessage: "Provider booking form retries were exhausted",
    },
  );
  logStandalonePrebookFailure(exhaustedCode, {
    ...input.failureLog,
    provider: {
      status: exhaustedDebug.providerStatus,
      code: exhaustedDebug.providerCode,
      message: exhaustedDebug.providerMessage,
    },
    paymentTypeNames: [],
  });
  throw new StandaloneHotelBookingError(
    409,
    STANDALONE_PREBOOK_PUBLIC_ERROR_MESSAGE,
    exhaustedCode,
    exhaustedDebug,
  );
}

async function claimStandaloneStripeCheckout(input: {
  row: StandaloneSessionRow;
  claimId: string;
  contact: Record<string, unknown>;
  guestRooms: ValidatedCheckoutGuestRoom[];
}): Promise<{ row: StandaloneSessionRow } | { url: string }> {
  const nowMs = Date.now();
  const decision = decideStandaloneStripeCheckoutClaim({
    status: input.row.status,
    stripeCheckoutUrl: input.row.stripe_checkout_url,
    stripeCheckoutClaimedAt: input.row.stripe_checkout_claimed_at,
    nowMs,
  });

  if (decision.kind === "return_existing") {
    return { url: decision.url };
  }

  if (decision.kind === "wait") {
    throw new StandaloneHotelBookingError(
      409,
      "Payment is already being prepared. Please wait a moment and try again.",
    );
  }

  if (decision.kind !== "claim") {
    throw new StandaloneHotelBookingError(409, "This checkout is already in progress.");
  }

  const nowIso = new Date(nowMs).toISOString();
  const patch = {
    status: "payment_pending",
    contact: input.contact,
    guest_rooms: input.guestRooms,
    stripe_checkout_claim_id: input.claimId,
    stripe_checkout_claimed_at: nowIso,
  };

  const admin = getSupabaseAdminClient();
  let query = admin
    .from("standalone_hotel_booking_sessions")
    .update(patch)
    .eq("id", input.row.id)
    .select("*");

  if (input.row.status === "form_created") {
    query = query.eq("status", "form_created");
  } else {
    const staleIso = new Date(nowMs - STANDALONE_STRIPE_CLAIM_STALE_MS).toISOString();
    query = query
      .eq("status", "payment_pending")
      .is("stripe_checkout_session_id", null)
      .or(`stripe_checkout_claimed_at.is.null,stripe_checkout_claimed_at.lt.${staleIso}`);
  }

  const result = await query;
  if (result.error) throw result.error;

  const rows = Array.isArray(result.data) ? result.data : [];
  if (rows.length === 1) {
    return { row: normalizeStandaloneRow(rows[0] as Record<string, unknown>) };
  }

  const current = await loadStandaloneSessionById(input.row.id);
  if (current?.stripe_checkout_url) {
    return { url: current.stripe_checkout_url };
  }

  throw new StandaloneHotelBookingError(
    409,
    "Payment is already being prepared. Please wait a moment and try again.",
  );
}

async function attachBookingToStandaloneCheckout(input: {
  row: StandaloneSessionRow;
  claimId: string;
  bookingId: string;
}): Promise<StandaloneSessionRow> {
  const result = await getSupabaseAdminClient()
    .from("standalone_hotel_booking_sessions")
    .update({ booking_id: input.bookingId })
    .eq("id", input.row.id)
    .eq("status", "payment_pending")
    .eq("stripe_checkout_claim_id", input.claimId)
    .select("*");
  if (result.error) throw result.error;

  const rows = Array.isArray(result.data) ? result.data : [];
  if (rows.length !== 1) {
    throw new StandaloneHotelBookingError(
      409,
      "Payment could not be prepared because this checkout was not claimed.",
    );
  }

  return normalizeStandaloneRow(rows[0] as Record<string, unknown>);
}

async function persistStandaloneStripeSession(input: {
  row: StandaloneSessionRow;
  claimId: string;
  bookingId: string;
  stripeSessionId: string;
  stripeUrl: string;
}): Promise<void> {
  const admin = getSupabaseAdminClient();
  const booking = await admin
    .from("bookings")
    .update({ stripe_checkout_session_id: input.stripeSessionId })
    .eq("id", input.bookingId)
    .eq("payment_status", "pending")
    .select("id");
  if (booking.error) throw booking.error;

  const bookingRows = Array.isArray(booking.data) ? booking.data : [];
  if (bookingRows.length !== 1) {
    throw new StandaloneHotelBookingError(
      409,
      "Payment could not be prepared because the booking row was not updated.",
    );
  }

  const session = await admin
    .from("standalone_hotel_booking_sessions")
    .update({
      booking_id: input.bookingId,
      stripe_checkout_session_id: input.stripeSessionId,
      stripe_checkout_url: input.stripeUrl,
    })
    .eq("id", input.row.id)
    .eq("status", "payment_pending")
    .eq("stripe_checkout_claim_id", input.claimId)
    .is("stripe_checkout_session_id", null)
    .select("id");
  if (session.error) throw session.error;

  const sessionRows = Array.isArray(session.data) ? session.data : [];
  if (sessionRows.length !== 1) {
    throw new StandaloneHotelBookingError(
      409,
      "Payment could not be prepared because this checkout was not claimed.",
    );
  }
}

async function releaseStandaloneStripeClaim(
  row: StandaloneSessionRow,
  claimId: string,
): Promise<void> {
  const result = await getSupabaseAdminClient()
    .from("standalone_hotel_booking_sessions")
    .update({
      status: "form_created",
      stripe_checkout_claim_id: null,
      stripe_checkout_claimed_at: null,
    })
    .eq("id", row.id)
    .eq("status", "payment_pending")
    .eq("stripe_checkout_claim_id", claimId)
    .is("stripe_checkout_session_id", null);
  if (result.error) throw result.error;
}

async function expireStripeSessionQuietly(sessionId: string): Promise<void> {
  try {
    await getStripe().checkout.sessions.expire(sessionId);
  } catch {
    // Best effort only. The checkout URL is not returned unless persistence succeeds.
  }
}

async function createStandaloneBookingRow(input: {
  row: StandaloneSessionRow;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  comment: string | null;
  guestRooms: ValidatedCheckoutGuestRoom[];
}): Promise<string> {
  const travelersCount = input.row.guests.reduce(
    (sum, room) => sum + room.adults + room.children.length,
    0,
  );
  const selected = input.row.selected_payment_type;
  const admin = getSupabaseAdminClient();
  const insert = await admin
    .from("bookings")
    .insert({
      customer_name: `${input.firstName} ${input.lastName}`.trim(),
      customer_first_name: input.firstName,
      customer_last_name: input.lastName,
      customer_email: input.email,
      customer_phone: input.phone,
      travelers_count: travelersCount,
      travel_date: input.row.checkin,
      message: input.comment,
      payment_status: "pending",
      provider_order_status: "pending",
      provider_partner_order_id: input.row.partner_order_id,
      provider_order_id: input.row.provider_order_id,
      provider_order_item_id: input.row.provider_order_item_id,
      provider_payment_type: "deposit",
      provider_payment_types: input.row.payment_types,
      provider_is_gender_specification_required: input.row.is_gender_specification_required,
      metadata: {
        source: "standalone_hotel",
        charge_type: "standalone_hotel_deposit",
        standalone_checkout_id: input.row.id,
        hotel_id: input.row.hotel_id,
        hotel_name: input.row.hotel_name,
        room_name: input.row.room_name,
        checkin: input.row.checkin,
        checkout: input.row.checkout,
        planned_charge_amount: selected?.amount,
        planned_charge_currency: selected?.currencyCode,
        user_ip: input.row.user_ip,
        checkout_guest_rooms: input.guestRooms,
      },
    })
    .select("id")
    .single();

  if (insert.error || !insert.data) {
    throw insert.error ?? new Error("Standalone booking row was not created");
  }

  return (insert.data as { id: string }).id;
}

async function startStandaloneBookingFinish(row: StandaloneSessionRow): Promise<void> {
  const selected = row.selected_payment_type;
  if (!selected || selected.type !== "deposit") {
    await markStandaloneFailed(row, "deposit_payment_missing");
    return;
  }
  if (!row.guest_rooms || row.guest_rooms.length === 0) {
    await markStandaloneFailed(row, "guest_data_missing");
    return;
  }
  if (!row.contact) {
    await markStandaloneFailed(row, "contact_data_missing");
    return;
  }

  const contact = row.contact;
  const rooms = toBookingRooms(row.guest_rooms, row.is_gender_specification_required);
  const supplierData =
    row.supplier_data_requirements && Object.keys(row.supplier_data_requirements).length > 0
      ? {
          firstNameOriginal: readText(contact.firstName) ?? undefined,
          lastNameOriginal: readText(contact.lastName) ?? undefined,
          phone: readText(contact.phone) ?? undefined,
          email: readText(contact.email) ?? undefined,
        }
      : undefined;

  const body = buildStartBookingRequest({
    partner: { partnerOrderId: row.partner_order_id },
    language: row.language,
    user: {
      email: String(contact.email),
      ...(readText(contact.phone) ? { phone: readText(contact.phone)! } : {}),
      ...(readText(contact.comment) ? { comment: readText(contact.comment)! } : {}),
    },
    rooms,
    payment: selected,
    supplierData,
  });

  const signal = await rateHawkBookingRequest(BOOKING_ENDPOINTS.bookingFinish, body);
  const classification = classifyBookingFinish(signal);

  if (classification.kind === "proceed") {
    await updateStandaloneAndBooking(row, {
      session: {
        status: "processing",
        provider_result_code: signal.error ?? signal.status,
      },
      booking: {
        provider_order_status: "processing",
        provider_last_status_at: new Date().toISOString(),
      },
    });
    return;
  }

  if (classification.kind === "failed") {
    await markStandaloneFailed(row, classification.code ?? "booking_finish_failed");
    return;
  }

  await markStandaloneReview(row, "booking_finish_unknown");
}

async function maybePollStandaloneStatus(row: StandaloneSessionRow): Promise<void> {
  if (
    isStandaloneBookingCutoffReached({
      bookingCutoffAt: row.booking_cutoff_at,
      finishStartedAt: row.finish_started_at,
      confirmationWindowMs: getStandaloneBookingConfirmationWindowMs(),
      nowMs: Date.now(),
    })
  ) {
    await markStandaloneReview(row, "booking_status_cutoff");
    return;
  }

  const last = row.finish_status_last_checked_at
    ? new Date(row.finish_status_last_checked_at).getTime()
    : 0;
  if (Date.now() - last < STATUS_POLL_INTERVAL_MS - 250) return;

  const body = buildBookingStatusRequest(row.partner_order_id);
  const signal = await rateHawkBookingRequest(BOOKING_ENDPOINTS.bookingFinishStatus, body);
  const classification = classifyBookingStatus(signal);
  const nextStatus = nextStandaloneStatusFromStatusClassification(classification);
  const basePatch = {
    finish_status_last_checked_at: new Date().toISOString(),
    finish_status_poll_count: row.finish_status_poll_count + 1,
    provider_result_code: signal.error ?? signal.status,
  };

  if (nextStatus === "confirmed") {
    await updateStandaloneAndBooking(row, {
      session: {
        ...basePatch,
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
      },
      booking: {
        provider_order_status: "confirmed",
        provider_confirmed_at: new Date().toISOString(),
        provider_last_status_at: new Date().toISOString(),
      },
    });
    return;
  }

  if (nextStatus === "processing") {
    await updateStandaloneAndBooking(row, {
      session: { ...basePatch, status: "processing" },
      booking: {
        provider_order_status: "processing",
        provider_last_status_at: new Date().toISOString(),
      },
    });
    return;
  }

  if (nextStatus === "pending_review") {
    await markStandaloneReview(row, "unexpected_3ds_for_deposit");
    return;
  }

  await markStandaloneFailed(
    row,
    classification.kind === "failed" ? (classification.code ?? "booking_status_failed") : "booking_status_failed",
  );
}

async function mirrorBookingTerminalState(row: StandaloneSessionRow): Promise<void> {
  if (!row.booking_id) return;
  const admin = getSupabaseAdminClient();
  const booking = await admin
    .from("bookings")
    .select("provider_order_status")
    .eq("id", row.booking_id)
    .maybeSingle();
  if (booking.error || !booking.data) return;
  const status = (booking.data as { provider_order_status?: string | null }).provider_order_status;
  if (status === "confirmed" && row.status !== "confirmed") {
    await admin
      .from("standalone_hotel_booking_sessions")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("id", row.id);
  } else if (status === "failed" && row.status !== "failed") {
    await admin
      .from("standalone_hotel_booking_sessions")
      .update({ status: "failed", failed_at: new Date().toISOString() })
      .eq("id", row.id);
  } else if (status === "pending_review" && row.status !== "pending_review") {
    await admin
      .from("standalone_hotel_booking_sessions")
      .update({ status: "pending_review" })
      .eq("id", row.id);
  }
}

async function loadStandaloneSession(
  checkoutId: string,
  checkoutToken: string | undefined,
  options?: { allowExpired?: boolean },
): Promise<StandaloneSessionRow | null> {
  if (!UUID_RE.test(checkoutId) || !checkoutToken || checkoutToken.length > 160) {
    return null;
  }
  const query = getSupabaseAdminClient()
    .from("standalone_hotel_booking_sessions")
    .select("*")
    .eq("id", checkoutId)
    .eq("checkout_token_hash", hashToken(checkoutToken));
  const result = options?.allowExpired
    ? await query.maybeSingle()
    : await query.gt("expires_at", new Date().toISOString()).maybeSingle();

  if (result.error) throw result.error;
  return result.data ? normalizeStandaloneRow(result.data as Record<string, unknown>) : null;
}

async function loadStandaloneSessionById(
  checkoutId: string,
): Promise<StandaloneSessionRow | null> {
  if (!UUID_RE.test(checkoutId)) return null;
  const result = await getSupabaseAdminClient()
    .from("standalone_hotel_booking_sessions")
    .select("*")
    .eq("id", checkoutId)
    .maybeSingle();

  if (result.error) throw result.error;
  return result.data ? normalizeStandaloneRow(result.data as Record<string, unknown>) : null;
}

function normalizeStandaloneRow(raw: Record<string, unknown>): StandaloneSessionRow {
  return {
    id: String(raw.id),
    search_session_id: String(raw.search_session_id),
    provider_id: typeof raw.provider_id === "string" ? raw.provider_id : null,
    booking_id: typeof raw.booking_id === "string" ? raw.booking_id : null,
    hotelpage_quote_id:
      typeof raw.hotelpage_quote_id === "string" ? raw.hotelpage_quote_id : null,
    prebook_snapshot_id:
      typeof raw.prebook_snapshot_id === "string" ? raw.prebook_snapshot_id : null,
    checkout_token_hash: String(raw.checkout_token_hash),
    hotel_id: String(raw.hotel_id),
    hotel_name: String(raw.hotel_name),
    room_name: readText(raw.room_name),
    board_basis: readText(raw.board_basis),
    checkin: String(raw.checkin),
    checkout: String(raw.checkout),
    residency: String(raw.residency),
    guests: Array.isArray(raw.guests) ? (raw.guests as HotelGuestRoom[]) : [],
    language: typeof raw.language === "string" ? raw.language : "en",
    status: normalizeStatus(raw.status),
    price_at_hotelpage: valueOrNull(raw.price_at_hotelpage),
    price_at_prebook: valueOrNull(raw.price_at_prebook),
    currency: typeof raw.currency === "string" ? raw.currency : "SAR",
    price_changed: raw.price_changed === true,
    cancellation_summary: readText(raw.cancellation_summary),
    cancellation_free_before: readText(raw.cancellation_free_before),
    partner_order_id: String(raw.partner_order_id),
    provider_order_id: readText(raw.provider_order_id),
    provider_order_item_id: readText(raw.provider_order_item_id),
    payment_types: Array.isArray(raw.payment_types)
      ? (raw.payment_types as ParsedPaymentType[])
      : [],
    selected_payment_type:
      raw.selected_payment_type && typeof raw.selected_payment_type === "object"
        ? (raw.selected_payment_type as SelectedPaymentType)
        : null,
    is_gender_specification_required: raw.is_gender_specification_required === true,
    supplier_data_requirements:
      raw.supplier_data_requirements && typeof raw.supplier_data_requirements === "object"
        ? (raw.supplier_data_requirements as Record<string, unknown>)
        : null,
    upsell_data:
      raw.upsell_data && typeof raw.upsell_data === "object"
        ? (raw.upsell_data as Record<string, unknown>)
        : null,
    user_ip: readText(raw.user_ip),
    contact: raw.contact && typeof raw.contact === "object" ? (raw.contact as Record<string, unknown>) : null,
    guest_rooms: Array.isArray(raw.guest_rooms)
      ? (raw.guest_rooms as ValidatedCheckoutGuestRoom[])
      : null,
    stripe_checkout_claim_id: readText(raw.stripe_checkout_claim_id),
    stripe_checkout_claimed_at: readText(raw.stripe_checkout_claimed_at),
    stripe_checkout_session_id: readText(raw.stripe_checkout_session_id),
    stripe_checkout_url: readText(raw.stripe_checkout_url),
    stripe_payment_intent_id: readText(raw.stripe_payment_intent_id),
    stripe_completed_event_id: readText(raw.stripe_completed_event_id),
    paid_amount: valueOrNull(raw.paid_amount),
    paid_currency: readText(raw.paid_currency),
    paid_at: readText(raw.paid_at),
    booking_cutoff_at: readText(raw.booking_cutoff_at),
    finish_started_at: readText(raw.finish_started_at),
    finish_status_last_checked_at: readText(raw.finish_status_last_checked_at),
    finish_status_poll_count:
      typeof raw.finish_status_poll_count === "number" ? raw.finish_status_poll_count : 0,
    provider_result_code: readText(raw.provider_result_code),
    confirmed_at: readText(raw.confirmed_at),
    failed_at: readText(raw.failed_at),
    expires_at: String(raw.expires_at),
  };
}

function normalizeStatus(value: unknown): StandaloneStatus {
  const text = typeof value === "string" ? value : "";
  switch (text) {
    case "form_created":
    case "unsupported_payment":
    case "payment_pending":
    case "finish_started":
    case "processing":
    case "confirmed":
    case "failed":
    case "pending_review":
    case "expired":
      return text;
    default:
      return "pending_review";
  }
}

function toBookingRooms(
  rooms: ValidatedCheckoutGuestRoom[],
  includeGender: boolean,
): RoomGuests[] {
  return rooms.map((room) => ({
    guests: room.guests.map((guest) => {
      const mapped: GuestName = {
        firstName: guest.firstName,
        lastName: guest.lastName,
        ...(guest.isChild ? { isChild: true } : {}),
        ...(guest.age != null ? { age: guest.age } : {}),
      };
      if (includeGender && guest.gender !== "unknown") {
        mapped.gender = guest.gender;
      }
      return mapped;
    }),
  }));
}

function buildCheckoutGuestRooms(rooms: HotelGuestRoom[]): CheckoutGuestRoom[] {
  return rooms.map((room, index) => ({
    roomIndex: index,
    guests: [
      ...Array.from({ length: room.adults }, () => ({ kind: "adult" as const })),
      ...room.children.map((age) => ({ kind: "child" as const, age })),
    ],
  }));
}

function stripeAmountMatches(input: {
  row: StandaloneSessionRow;
  amountTotal: number | null;
  currency: string | null;
}): boolean {
  const selected = input.row.selected_payment_type;
  if (!selected || input.amountTotal == null || !input.currency) return false;
  if (selected.currencyCode.toUpperCase() !== input.currency.toUpperCase()) return false;
  const paid = fromStripeAmount(input.amountTotal, input.currency);
  return Math.abs(paid - Number(selected.amount)) < 0.01;
}

async function updateStandaloneAndBooking(
  row: StandaloneSessionRow,
  patch: {
    session: Record<string, unknown>;
    booking?: Record<string, unknown>;
  },
): Promise<void> {
  const admin = getSupabaseAdminClient();
  const session = await admin
    .from("standalone_hotel_booking_sessions")
    .update(patch.session)
    .eq("id", row.id);
  if (session.error) throw session.error;

  if (row.booking_id && patch.booking) {
    const booking = await admin.from("bookings").update(patch.booking).eq("id", row.booking_id);
    if (booking.error) throw booking.error;
  }
}

async function markStandaloneFailed(row: StandaloneSessionRow, code: string): Promise<void> {
  await updateStandaloneAndBooking(row, {
    session: {
      status: "failed",
      failed_at: new Date().toISOString(),
      provider_result_code: code,
    },
    booking: {
      provider_order_status: "failed",
      provider_result_code: code,
      provider_last_status_at: new Date().toISOString(),
    },
  });
}

async function markStandaloneReview(row: StandaloneSessionRow, code: string): Promise<void> {
  await updateStandaloneAndBooking(row, {
    session: {
      status: "pending_review",
      provider_result_code: code,
    },
    booking: {
      provider_order_status: "pending_review",
      provider_result_code: code,
      provider_last_status_at: new Date().toISOString(),
    },
  });
}

function toPublicStatus(row: StandaloneSessionRow): StandaloneHotelPublicStatus {
  switch (row.status) {
    case "unsupported_payment":
      return {
        checkoutId: row.id,
        state: "unsupported",
        message: unsupportedPaymentReason(row.payment_types.map((p) => p.type)),
        nextAction: "contact_support",
      };
    case "confirmed":
      return {
        checkoutId: row.id,
        state: "confirmed",
        message: "Your hotel booking is confirmed.",
        nextAction: null,
      };
    case "failed":
      return {
        checkoutId: row.id,
        state: "failed",
        message: "We were unable to complete your hotel booking. Our team will contact you.",
        nextAction: "contact_support",
      };
    case "pending_review":
      return {
        checkoutId: row.id,
        state: "review",
        message: "Your hotel booking requires manual review. Our team will contact you.",
        nextAction: "contact_support",
      };
    case "finish_started":
    case "processing":
      return {
        checkoutId: row.id,
        state: "in_progress",
        message: "Your hotel booking is being confirmed with the provider.",
        nextAction: "wait",
      };
    default:
      return {
        checkoutId: row.id,
        state: "pending",
        message: "Your hotel payment is pending.",
        nextAction: "wait",
      };
  }
}

function unsupportedPaymentReason(types: string[]): string {
  const returned = types.length ? types.join(", ") : "none";
  return `Card payment is unavailable because ETG booking/form did not return a deposit payment option. Returned payment type(s): ${returned}.`;
}

function buildCancellationSummary(freeBefore: string | null, policiesCount: number): string | null {
  if (freeBefore) return `Free cancellation before ${freeBefore}`;
  if (policiesCount > 0) return "Cancellation penalties apply";
  return null;
}

async function readStandaloneSearchQuote(
  searchId: string,
  hotelId: string,
): Promise<{ safe_payload: Record<string, unknown> | null } | null> {
  const result = await getSupabaseAdminClient()
    .from("provider_quote_snapshots")
    .select("safe_payload")
    .eq("search_session_id", searchId)
    .eq("provider_reference", hotelId)
    .eq("service_type", "hotel")
    .eq("status", "available")
    .eq("safe_payload->>stage", "serp")
    .order("price_amount", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (result.error) throw result.error;
  return (result.data as { safe_payload: Record<string, unknown> | null } | null) ?? null;
}

async function inspectStandalonePrebookSnapshot(input: {
  searchId: string;
  hotelId: string;
  rateId: string;
}): Promise<{
  selectedRateExists: boolean | null;
  selectedRateHasProviderHash: boolean | null;
  hotelpageSnapshotExists: boolean | null;
}> {
  const result = await getSupabaseAdminClient()
    .from("provider_quote_snapshots")
    .select("id,search_session_id,provider_reference,status,safe_payload,metadata,expires_at")
    .eq("id", input.rateId)
    .eq("service_type", "hotel")
    .maybeSingle();

  if (result.error) {
    return {
      selectedRateExists: null,
      selectedRateHasProviderHash: null,
      hotelpageSnapshotExists: null,
    };
  }

  const row = result.data as Record<string, unknown> | null;
  if (!row) {
    return {
      selectedRateExists: false,
      selectedRateHasProviderHash: false,
      hotelpageSnapshotExists: false,
    };
  }

  const safePayload =
    row.safe_payload && typeof row.safe_payload === "object"
      ? (row.safe_payload as Record<string, unknown>)
      : null;
  const metadata =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : null;
  const expiresAt = readText(row.expires_at);
  const isUnexpired = expiresAt ? new Date(expiresAt).getTime() > Date.now() : false;
  const isHotelpageSnapshot =
    row.search_session_id === input.searchId &&
    row.provider_reference === input.hotelId &&
    row.status === "available" &&
    safePayload?.stage === "hotelpage" &&
    isUnexpired;

  return {
    selectedRateExists: true,
    selectedRateHasProviderHash: isHotelPageBookHash(metadata?.book_hash),
    hotelpageSnapshotExists: isHotelpageSnapshot,
  };
}

type ProviderFailureKind = "http_error" | "rejected" | "parse_error";

function classifyProviderException(
  stage: StandaloneHotelProviderDebug["providerStage"],
  error: unknown,
): {
  code: StandaloneHotelPrebookErrorCode;
  provider: StandalonePrebookProviderFailureLog;
  debug: StandaloneHotelProviderDebug;
} {
  const provider = readProviderFailure(error);
  let kind: ProviderFailureKind = "http_error";

  if (provider.transportCode === "invalid_response") {
    kind = "parse_error";
  } else if (
    provider.transportCode === "provider_error" ||
    (typeof provider.httpStatus === "number" &&
      provider.httpStatus >= 400 &&
      provider.httpStatus < 500 &&
      provider.httpStatus !== 401 &&
      provider.httpStatus !== 403 &&
      provider.httpStatus !== 429)
  ) {
    kind = "rejected";
  }

  return {
    code: providerStageErrorCode(stage, kind),
    provider,
    debug: buildProviderDebug(stage, provider),
  };
}

function providerStageErrorCode(
  stage: StandaloneHotelProviderDebug["providerStage"],
  kind: ProviderFailureKind,
): StandaloneHotelPrebookErrorCode {
  if (stage === "prebook") {
    if (kind === "rejected") return "provider_prebook_rejected";
    if (kind === "parse_error") return "provider_prebook_parse_error";
    return "provider_prebook_http_error";
  }

  if (kind === "rejected") return "provider_booking_form_rejected";
  if (kind === "parse_error") return "provider_booking_form_parse_error";
  return "provider_booking_form_http_error";
}

function buildProviderDebug(
  stage: StandaloneHotelProviderDebug["providerStage"],
  provider: StandalonePrebookProviderFailureLog,
  fallback?: { fallbackCode?: string | null; fallbackMessage?: string | null },
): StandaloneHotelProviderDebug {
  return {
    providerStage: stage,
    providerStatus: provider.httpStatus ?? null,
    providerCode:
      sanitizeProviderCode(provider.code) ??
      sanitizeProviderCode(provider.transportCode) ??
      sanitizeProviderCode(fallback?.fallbackCode),
    providerMessage:
      sanitizeProviderMessage(provider.message) ??
      sanitizeProviderMessage(fallback?.fallbackMessage),
  };
}

function isHttpLikeProviderFailure(
  provider: StandalonePrebookProviderFailureLog | null,
): boolean {
  if (!provider) return true;
  if (typeof provider.httpStatus === "number") {
    return provider.httpStatus === 0 || provider.httpStatus === 429 || provider.httpStatus >= 500;
  }

  const code = sanitizeProviderCode(provider.code ?? provider.transportCode);
  return code === "timeout" || code === "network_error" || code === "http_error";
}

function readProviderFailure(value: unknown): StandalonePrebookProviderFailureLog {
  if (!value || typeof value !== "object") {
    return { message: value instanceof Error ? sanitizeProviderMessage(value.message) : null };
  }

  const record = value as Record<string, unknown>;
  const httpStatus = readHttpStatus(record.httpStatus);
  const status = record.status ?? httpStatus;
  const transportCode = sanitizeProviderCode(record.code);
  const code = sanitizeProviderCode(record.providerCode ?? record.error ?? record.code);
  const message = sanitizeProviderMessage(record.message);

  return {
    status: safeLogText(status, 80),
    httpStatus,
    code,
    message,
    transportCode,
  };
}

function readHttpStatus(value: unknown): number | null {
  const status = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(status) || status < 0 || status > 599) return null;
  return status;
}

function readRecord(value: unknown, key: string): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const child = (value as Record<string, unknown>)[key];
  return child && typeof child === "object" && !Array.isArray(child)
    ? (child as Record<string, unknown>)
    : null;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function money(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function valueOrNull(value: unknown): string | number | null {
  return value == null ? null : typeof value === "string" || typeof value === "number" ? value : null;
}

function readText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeLogText(value: unknown, max: number): string | null {
  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    typeof value !== "boolean"
  ) {
    return null;
  }

  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

function sanitizeProviderCode(value: unknown): string | null {
  const text = safeLogText(value, 80);
  if (!text) return null;

  const cleaned = text.toLowerCase().replace(/[^a-z0-9_.:-]/g, "_");
  return cleaned ? cleaned.slice(0, 80) : null;
}

function sanitizeProviderMessage(value: unknown): string | null {
  const text = safeLogText(value, 600);
  if (!text) return null;

  const withoutHashes = text.replace(/\b[hp]-[A-Za-z0-9._:-]{4,}\b/g, "[redacted_hash]");
  const withoutAuth = withoutHashes
    .replace(/\b(Basic|Bearer)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [redacted]")
    .replace(
      /\b(token|secret|password|api[_-]?key|authorization)\b\s*[:=]\s*[^,\s}]+/gi,
      "$1=[redacted]",
    );

  return withoutAuth.slice(0, 300);
}

function safePaymentTypeNames(values: string[]): string[] {
  const names = values
    .map((value) => safeLogText(value, 80))
    .filter((value): value is string => value !== null);
  return Array.from(new Set(names)).slice(0, 20);
}

function cleanRequiredText(value: string, key: string): string {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (cleaned.length < 1 || cleaned.length > 120) {
    throw new StandaloneHotelBookingError(400, `${key} is invalid.`);
  }
  return cleaned;
}

function cleanOptionalText(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;
  return cleaned.slice(0, max);
}

function getStandaloneBookingConfirmationWindowMs(): number {
  const seconds = Number(process.env.RATEHAWK_BOOKING_CONFIRMATION_WINDOW_SECONDS);
  if (Number.isFinite(seconds) && seconds >= 30 && seconds <= 3600) {
    return Math.round(seconds * 1000);
  }

  return DEFAULT_STANDALONE_CONFIRMATION_WINDOW_SECONDS * 1000;
}

export function getStandaloneCheckoutCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: HOTEL_CHECKOUT_TTL_SECONDS,
  };
}
