/**
 * Admin-facing eSIM order DTOs.
 *
 * These are the ONLY shapes that cross from the server DAL into React. They are
 * deliberately sanitized: sensitive fulfillment fields (activation_code,
 * lpa_code, qr_payload, sim_pin, apn, sim_id) are never included as raw values —
 * only presence booleans (see EsimFulfillmentPresence). The DB `lookup_token_hash`
 * and any raw lookup token are never surfaced here.
 */

export type EsimOrderStatus =
  | "draft"
  | "payment_pending"
  | "paid"
  | "purchase_started"
  | "fulfilled"
  | "purchase_failed"
  | "pending_review"
  | "expired"
  | "cancelled";

/** Row shown in the admin orders list. No sensitive fulfillment data. */
export type EsimOrderListItem = {
  id: string;
  publicReference: string;
  guestEmail: string;
  guestName: string | null;
  countryName: string | null;
  planName: string | null;
  planCode: string;
  price: number | null;
  currency: string | null;
  status: EsimOrderStatus;
  paidAt: string | null;
  createdAt: string;
};

export type EsimOrderListQuery = {
  status: EsimOrderStatus | "all";
  search: string;
  page: number;
  pageSize: number;
};

export type EsimOrderListResult = {
  items: EsimOrderListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

/** Presence-only view of the sensitive fulfillment fields. */
export type EsimFulfillmentPresence = {
  hasActivationCode: boolean;
  hasLpaCode: boolean;
  hasQrPayload: boolean;
  hasApn: boolean;
  hasSimId: boolean;
  hasSimPin: boolean;
};

/** Full admin order detail — sanitized (sensitive fields are booleans). */
export type EsimOrderDetail = {
  id: string;
  publicReference: string;
  status: EsimOrderStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;

  // Customer
  guestName: string | null;
  guestEmail: string;
  guestPhone: string | null;

  // Plan
  provider: string;
  partnerCode: string;
  countryCode: string | null;
  countryName: string | null;
  planCode: string;
  planName: string | null;
  travelDate: string | null;

  // Payment (identifiers only — no secret keys)
  price: number | null;
  currency: string | null;
  paidAmount: number | null;
  paidCurrency: string | null;
  paidAt: string | null;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeCompletedEventId: string | null;

  // Airhub fulfillment
  uniqueOrderId: string | null;
  providerOrderId: string | null;
  fulfillment: EsimFulfillmentPresence;
  providerResponsePresent: boolean;
  /** Top-level provider_response key NAMES only (never values). */
  providerResponseKeys: string[];
  errorCode: string | null;
};

export type EsimOrderStats = {
  total: number;
  paid: number;
  activationPending: number;
  fulfilled: number;
  purchaseFailed: number;
};
