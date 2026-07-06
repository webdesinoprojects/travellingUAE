/**
 * Pure helpers for the admin eSIM orders feature.
 *
 * No IO, no `server-only`, no Supabase — safe to unit test directly. The row →
 * DTO mappers are the SECURITY BOUNDARY: they drop every sensitive fulfillment
 * value (activation_code, lpa_code, qr_payload, sim_pin, apn, sim_id) and expose
 * only presence booleans, so raw secrets can never reach the client.
 */

import type {
  EsimOrderDetail,
  EsimOrderListItem,
  EsimOrderListQuery,
  EsimOrderStatus,
} from "@/features/admin/esim/types";

/**
 * Canonical list of order statuses (mirrors the esim_orders CHECK constraint).
 * Lives here (a dependency-free module) so it can be unit tested with node
 * --test, and is re-used by the UI status catalog.
 */
export const ESIM_ORDER_STATUS_VALUES: readonly EsimOrderStatus[] = [
  "draft",
  "payment_pending",
  "paid",
  "purchase_started",
  "fulfilled",
  "purchase_failed",
  "pending_review",
  "expired",
  "cancelled",
] as const;

export function isEsimOrderStatus(value: string): value is EsimOrderStatus {
  return (ESIM_ORDER_STATUS_VALUES as readonly string[]).includes(value);
}

export const ESIM_ORDERS_PAGE_SIZE = 25;
const MAX_SEARCH_LEN = 80;
const MAX_PROVIDER_KEYS = 24;

/**
 * Strip characters that could break a PostgREST `.or()` filter or an ilike
 * pattern (comma/paren separators, `%`/`*`/`\` wildcards) and bound the length.
 * Keeps the term usable for a safe substring search.
 */
export function sanitizeEsimSearchTerm(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/[,()\\%*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SEARCH_LEN);
}

export function normalizeEsimListQuery(input: {
  status?: string | string[] | undefined;
  q?: string | string[] | undefined;
  page?: string | string[] | undefined;
}): EsimOrderListQuery {
  const statusRaw = firstParam(input.status);
  const status = isEsimOrderStatus(statusRaw) ? statusRaw : "all";
  return {
    status,
    search: sanitizeEsimSearchTerm(firstParam(input.q)),
    page: clampPage(firstParam(input.page)),
    pageSize: ESIM_ORDERS_PAGE_SIZE,
  };
}

export function computePageCount(total: number, pageSize: number): number {
  if (total <= 0 || pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

// ---- Row shapes (exact columns the DAL selects) ---------------------------

export type EsimOrderListRow = {
  id: string;
  public_reference: string;
  guest_email: string;
  guest_name: string | null;
  country_name: string | null;
  plan_name: string | null;
  plan_code: string;
  price: number | string | null;
  currency: string | null;
  status: string;
  paid_at: string | null;
  created_at: string;
};

export type EsimOrderDetailRow = EsimOrderListRow & {
  updated_at: string;
  expires_at: string | null;
  guest_phone: string | null;
  email_verified_at?: string | null;
  provider: string;
  partner_code: string;
  country_code: string | null;
  travel_date: string | null;
  paid_amount: number | string | null;
  paid_currency: string | null;
  supplier_price?: number | string | null;
  supplier_currency?: string | null;
  markup_amount?: number | string | null;
  pricing_rule_id?: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_completed_event_id: string | null;
  unique_order_id: string | null;
  provider_order_id: string | null;
  activation_code: string | null;
  lpa_code: string | null;
  qr_payload: string | null;
  apn: string | null;
  sim_id: string | null;
  sim_pin: string | null;
  provider_response: unknown;
  error_code: string | null;
};

export function toEsimOrderListItem(row: EsimOrderListRow): EsimOrderListItem {
  return {
    id: row.id,
    publicReference: row.public_reference,
    guestEmail: row.guest_email,
    guestName: emptyToNull(row.guest_name),
    countryName: emptyToNull(row.country_name),
    planName: emptyToNull(row.plan_name),
    planCode: row.plan_code,
    price: toNumberOrNull(row.price),
    currency: emptyToNull(row.currency),
    status: coerceStatus(row.status),
    paidAt: row.paid_at,
    createdAt: row.created_at,
  };
}

export function toEsimOrderDetail(row: EsimOrderDetailRow): EsimOrderDetail {
  return {
    id: row.id,
    publicReference: row.public_reference,
    status: coerceStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,

    guestName: emptyToNull(row.guest_name),
    guestEmail: row.guest_email,
    guestPhone: emptyToNull(row.guest_phone),
    emailVerifiedAt: row.email_verified_at ?? null,

    provider: row.provider,
    partnerCode: row.partner_code,
    countryCode: emptyToNull(row.country_code),
    countryName: emptyToNull(row.country_name),
    planCode: row.plan_code,
    planName: emptyToNull(row.plan_name),
    travelDate: row.travel_date,

    price: toNumberOrNull(row.price),
    currency: emptyToNull(row.currency),
    supplierPrice: toNumberOrNull(row.supplier_price),
    supplierCurrency: emptyToNull(row.supplier_currency),
    markupAmount: toNumberOrNull(row.markup_amount),
    pricingRuleId: emptyToNull(row.pricing_rule_id),
    paidAmount: toNumberOrNull(row.paid_amount),
    paidCurrency: emptyToNull(row.paid_currency),
    paidAt: row.paid_at,
    stripeCheckoutSessionId: emptyToNull(row.stripe_checkout_session_id),
    stripePaymentIntentId: emptyToNull(row.stripe_payment_intent_id),
    stripeCompletedEventId: emptyToNull(row.stripe_completed_event_id),

    uniqueOrderId: emptyToNull(row.unique_order_id),
    providerOrderId: emptyToNull(row.provider_order_id),
    fulfillment: {
      hasActivationCode: hasValue(row.activation_code),
      hasLpaCode: hasValue(row.lpa_code),
      hasQrPayload: hasValue(row.qr_payload),
      hasApn: hasValue(row.apn),
      hasSimId: hasValue(row.sim_id),
      hasSimPin: hasValue(row.sim_pin),
    },
    providerResponsePresent: isNonEmptyObject(row.provider_response),
    providerResponseKeys: safeTopLevelKeys(row.provider_response),
    errorCode: emptyToNull(row.error_code),
  };
}

// ---- internal ------------------------------------------------------------

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function clampPage(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

function coerceStatus(value: string): EsimOrderStatus {
  return isEsimOrderStatus(value) ? value : "pending_review";
}

function toNumberOrNull(value: number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function emptyToNull(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function hasValue(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonEmptyObject(value: unknown): boolean {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value as Record<string, unknown>).length > 0
  );
}

/** Top-level key NAMES only (never values), sanitized + capped. */
function safeTopLevelKeys(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.keys(value as Record<string, unknown>)
    .filter((key) => /^[A-Za-z0-9_]{1,40}$/.test(key))
    .slice(0, MAX_PROVIDER_KEYS);
}
