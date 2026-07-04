import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import { getStripe, hasStripeEnv, toStripeAmount } from "@/server/payments/stripe";
import type { EsimAppliedPricing } from "@/server/esim/pricing-helpers";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/server/supabase/client";

import type { EsimFulfillmentGuardView } from "@/features/admin/esim/types";

import { airhubJsonRequest } from "./client";
import { getAirhubConfig } from "./config";
import {
  AIRHUB_ENDPOINTS,
  type AirhubPublicOrder,
  type AirhubPublicPlan,
  buildEsimStripeMetadata,
  buildPublicOrderDto,
  buildPurchaseSimRequest,
  decideAirhubPurchaseStart,
  decidePurchaseOutcomeStatus,
  parsePurchaseSimResponse,
} from "./contracts";
import { AirhubError } from "./errors";
import {
  generateAirhubLookupToken,
  generateAirhubUniqueOrderId,
  hashAirhubLookupToken,
} from "./order-ids";

const CHECKOUT_EXPIRY_MINUTES = 30;

type EsimOrderRow = {
  id: string;
  public_reference: string;
  lookup_token_hash: string | null;
  guest_email: string;
  guest_name: string | null;
  guest_phone: string | null;
  partner_code: string;
  unique_order_id: string | null;
  provider_order_id: string | null;
  plan_code: string;
  plan_name: string | null;
  country_code: string | null;
  country_name: string | null;
  price: number | string | null;
  currency: string | null;
  supplier_price: number | string | null;
  supplier_currency: string | null;
  markup_amount: number | string | null;
  pricing_rule_id: string | null;
  travel_date: string | null;
  activation_code: string | null;
  apn: string | null;
  sim_id: string | null;
  sim_pin: string | null;
  qr_payload: string | null;
  status: string;
  stripe_checkout_claim_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_checkout_url: string | null;
  expires_at: string | null;
};

export type CreatedEsimOrder = {
  publicReference: string;
  lookupToken: string;
};

export async function createEsimOrderFromPlan(input: {
  plan: AirhubPublicPlan;
  countryCode: string;
  guestName?: string | null;
  guestEmail: string;
  guestPhone?: string | null;
  travelDate?: string | null;
  pricing?: EsimAppliedPricing | null;
}): Promise<CreatedEsimOrder> {
  assertSupabaseReady();

  const finalPrice = input.pricing?.finalPrice ?? input.plan.price;
  const finalCurrency = input.pricing?.finalCurrency ?? input.plan.currency;

  if (!finalPrice || finalPrice <= 0 || !finalCurrency) {
    throw new AirhubError(
      "stripe_payment_required",
      "This eSIM plan is not available for checkout.",
      400,
    );
  }

  const config = getAirhubConfig();
  const lookupToken = generateAirhubLookupToken();
  const publicReference = generatePublicReference();
  const uniqueOrderId = generateAirhubUniqueOrderId();
  const expiresAt = new Date(
    Date.now() + CHECKOUT_EXPIRY_MINUTES * 60 * 1000,
  ).toISOString();

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("esim_orders").insert({
    public_reference: publicReference,
    lookup_token_hash: hashAirhubLookupToken(lookupToken),
    guest_name: input.guestName ?? null,
    guest_email: input.guestEmail,
    guest_phone: input.guestPhone ?? null,
    provider: "airhub",
    partner_code: String(config.partnerCode),
    unique_order_id: uniqueOrderId,
    plan_code: input.plan.planCode,
    plan_name: input.plan.planName,
    country_code: input.countryCode.toUpperCase(),
    country_name: input.plan.countryName,
    price: finalPrice,
    currency: finalCurrency.toUpperCase(),
    supplier_price: input.pricing?.supplierPrice ?? input.plan.price,
    supplier_currency: input.pricing?.supplierCurrency ?? input.plan.currency?.toUpperCase() ?? null,
    markup_amount: input.pricing?.markupAmount ?? 0,
    pricing_rule_id: input.pricing?.pricingRuleId ?? null,
    travel_date: input.travelDate ?? null,
    status: "payment_pending",
    expires_at: expiresAt,
  });

  if (error) {
    throw error;
  }

  return { publicReference, lookupToken };
}

export async function getPublicEsimOrder(input: {
  publicReference: string;
  lookupToken: string;
}): Promise<AirhubPublicOrder> {
  const row = await readOrderForLookup(input.publicReference, input.lookupToken);
  if (!row) {
    throw new AirhubError("esim_lookup_invalid", "Invalid eSIM order lookup.", 404);
  }

  return buildPublicOrderDto(normalizePublicOrderRow(row));
}

export async function createEsimStripeSession(input: {
  publicReference: string;
  lookupToken: string;
}): Promise<{ url: string }> {
  assertSupabaseReady();

  if (!hasStripeEnv()) {
    throw new AirhubError(
      "stripe_payment_required",
      "Payment service is not available.",
      503,
    );
  }

  const order = await readOrderForLookup(input.publicReference, input.lookupToken);
  if (!order) {
    throw new AirhubError("esim_lookup_invalid", "Invalid eSIM order lookup.", 404);
  }

  if (isExpired(order)) {
    await markOrderExpired(order.id);
    throw new AirhubError("esim_order_not_found", "This eSIM checkout expired.", 410);
  }

  if (order.stripe_checkout_url && order.status === "payment_pending") {
    return { url: order.stripe_checkout_url };
  }

  if (order.status !== "payment_pending") {
    throw new AirhubError(
      "stripe_payment_required",
      "This eSIM order is not awaiting payment.",
      409,
    );
  }

  const price = normalizeMoney(order.price);
  if (!price || price <= 0 || !order.currency) {
    throw new AirhubError(
      "stripe_payment_required",
      "This eSIM plan is not available for checkout.",
      400,
    );
  }

  const claimId = randomUUID();
  const supabase = getSupabaseAdminClient();
  const { data: claimed, error: claimError } = await supabase
    .from("esim_orders")
    .update({
      stripe_checkout_claim_id: claimId,
      stripe_checkout_claimed_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .eq("status", "payment_pending")
    .is("stripe_checkout_claim_id", null)
    .is("stripe_checkout_session_id", null)
    .select("id")
    .maybeSingle();

  if (claimError) {
    throw claimError;
  }

  if (!claimed) {
    const latest = await readOrderForLookup(input.publicReference, input.lookupToken);
    if (latest?.stripe_checkout_url && latest.status === "payment_pending") {
      return { url: latest.stripe_checkout_url };
    }

    throw new AirhubError(
      "stripe_payment_required",
      "Payment setup is already in progress.",
      409,
    );
  }

  try {
    const stripeSession = await buildStripeCheckoutSession({
      order,
      lookupToken: input.lookupToken,
      price,
    });

    if (!stripeSession.url) {
      throw new Error("Stripe session returned no URL");
    }

    const { data: linked, error: linkError } = await supabase
      .from("esim_orders")
      .update({
        stripe_checkout_session_id: stripeSession.id,
        stripe_checkout_url: stripeSession.url,
      })
      .eq("id", order.id)
      .eq("stripe_checkout_claim_id", claimId)
      .select("id")
      .maybeSingle();

    if (linkError) {
      throw linkError;
    }

    if (!linked) {
      throw new AirhubError(
        "stripe_payment_required",
        "Payment setup could not be linked.",
        409,
      );
    }

    return { url: stripeSession.url };
  } catch (error) {
    await supabase
      .from("esim_orders")
      .update({
        stripe_checkout_claim_id: null,
        stripe_checkout_claimed_at: null,
      })
      .eq("id", order.id)
      .eq("stripe_checkout_claim_id", claimId);

    throw error;
  }
}

export async function handleEsimStripeCheckoutCompleted(input: {
  orderId?: string | null;
  stripeSessionId: string;
  stripePaymentIntentId: string | null;
  amountTotal: number | null;
  currency: string | null;
  eventId: string;
}) {
  if (!input.orderId || !hasSupabaseAdminEnv()) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("esim_orders")
    .select("*")
    .eq("id", input.orderId)
    .eq("stripe_checkout_session_id", input.stripeSessionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = data as EsimOrderRow | null;
  if (!row) {
    return;
  }

  if (
    row.status === "fulfilled" ||
    row.status === "purchase_started" ||
    row.status === "paid"
  ) {
    return;
  }

  const config = getAirhubConfig();
  const purchaseDecision = decideAirhubPurchaseStart({
    purchaseEnabled: config.purchaseEnabled,
    testPurchaseOnly: config.testPurchaseOnly,
    allowNonTestPlanPurchase: config.allowNonTestPlanPurchase,
    testPlanCode: config.testPlanCode,
    planCode: row.plan_code,
    status: row.status,
    hasActivationCode: Boolean(row.activation_code),
  });
  const paidAmount =
    typeof input.amountTotal === "number" && input.currency
      ? normalizePaidAmount(input.amountTotal, input.currency)
      : null;

  await supabase
    .from("esim_orders")
    .update({
      status: "paid",
      stripe_payment_intent_id: input.stripePaymentIntentId,
      stripe_completed_event_id: input.eventId,
      paid_amount: paidAmount,
      paid_currency: input.currency?.toUpperCase() ?? null,
      paid_at: new Date().toISOString(),
      error_code:
        purchaseDecision.kind === "disabled" ||
        purchaseDecision.kind === "blocked_plan"
          ? purchaseDecision.code
          : null,
    })
    .eq("id", row.id)
    .eq("stripe_checkout_session_id", input.stripeSessionId)
    .eq("status", "payment_pending");

  // Gated fulfillment: only when PurchaseSim is explicitly enabled AND the guard
  // already resolved to "ready" (test plan in test mode). Default = disabled, so
  // this is a no-op and the current behaviour (paid -> activation pending) is
  // unchanged. Fulfillment never blocks/fails the webhook: payment already
  // succeeded, so any fulfillment error is only logged.
  if (config.purchaseEnabled && purchaseDecision.kind === "ready") {
    try {
      await fulfillPaidEsimOrderWithAirhub(row.id);
    } catch {
      console.error("[airhub.fulfillment.webhook]", { code: "fulfillment_error" });
    }
  }
}

export function hashLookupToken(token: string) {
  return hashAirhubLookupToken(token);
}

function assertSupabaseReady() {
  if (!hasSupabaseAdminEnv()) {
    throw new Error("Supabase admin environment is not configured");
  }
}

async function readOrderForLookup(publicReference: string, lookupToken: string) {
  if (!hasSupabaseAdminEnv()) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("esim_orders")
    .select("*")
    .eq("public_reference", publicReference)
    .eq("lookup_token_hash", hashAirhubLookupToken(lookupToken))
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as EsimOrderRow | null;
}

async function buildStripeCheckoutSession(input: {
  order: EsimOrderRow;
  lookupToken: string;
  price: number;
}) {
  const stripe = getStripe();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const currency = input.order.currency!.toLowerCase();
  const productName = input.order.plan_name
    ? `eSIM - ${input.order.plan_name}`
    : `eSIM - ${input.order.plan_code}`;

  return stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency,
          product_data: {
            name: productName,
          },
          unit_amount: toStripeAmount(input.price, currency),
        },
        quantity: 1,
      },
    ],
    customer_email: input.order.guest_email,
    success_url: `${siteUrl}/esim/order/${input.order.public_reference}?token=${encodeURIComponent(input.lookupToken)}&payment=success`,
    cancel_url: `${siteUrl}/esim/checkout?countryCode=${encodeURIComponent(input.order.country_code ?? "")}&planCode=${encodeURIComponent(input.order.plan_code)}`,
    client_reference_id: input.order.id,
    metadata: buildEsimStripeMetadata({
      orderId: input.order.id,
      planCode: input.order.plan_code,
      countryCode: input.order.country_code,
    }),
    payment_intent_data: {
      metadata: {
        charge_type: "esim_airhub",
        internal_order_id: input.order.id,
      },
    },
    expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_EXPIRY_MINUTES * 60,
  });
}

function generatePublicReference() {
  return `ESIM-${Date.now().toString(36).toUpperCase()}-${randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;
}

function isExpired(order: EsimOrderRow) {
  return Boolean(order.expires_at && new Date(order.expires_at).getTime() < Date.now());
}

async function markOrderExpired(orderId: string) {
  if (!hasSupabaseAdminEnv()) {
    return;
  }

  await getSupabaseAdminClient()
    .from("esim_orders")
    .update({ status: "expired" })
    .eq("id", orderId)
    .eq("status", "payment_pending");
}

function normalizePublicOrderRow(row: EsimOrderRow) {
  return {
    public_reference: row.public_reference,
    status: row.status,
    guest_email: row.guest_email,
    provider_order_id: row.provider_order_id,
    plan_code: row.plan_code,
    plan_name: row.plan_name,
    country_code: row.country_code,
    country_name: row.country_name,
    price: normalizeMoney(row.price),
    currency: row.currency,
    travel_date: row.travel_date,
    activation_code: row.activation_code,
    apn: row.apn,
    sim_id: row.sim_id,
    sim_pin: row.sim_pin,
    qr_payload: row.qr_payload,
  };
}

function normalizeMoney(value: number | string | null) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizePaidAmount(amountUnits: number, currency: string) {
  const zeroDecimalCurrencies = new Set([
    "bif",
    "clp",
    "djf",
    "gnf",
    "jpy",
    "kmf",
    "krw",
    "mga",
    "pyg",
    "rwf",
    "ugx",
    "vnd",
    "vuv",
    "xaf",
    "xof",
    "xpf",
  ]);
  return zeroDecimalCurrencies.has(currency.toLowerCase())
    ? amountUnits
    : amountUnits / 100;
}

// ---- Phase 3A: guarded PurchaseSim fulfillment ----------------------------

type EsimFulfillmentRow = {
  id: string;
  provider: string;
  status: string;
  plan_code: string;
  travel_date: string | null;
  unique_order_id: string | null;
  provider_order_id: string | null;
  activation_code: string | null;
};

export type EsimFulfillmentOutcome =
  | { kind: "skipped"; reason: string }
  | { kind: "blocked"; reason: string }
  | { kind: "fulfilled" }
  | { kind: "pending_review"; reason: string }
  | { kind: "failed"; reason: string };

/**
 * Guarded fulfillment for a PAID eSIM order. Behaviour:
 *   - Only paid, provider=airhub orders proceed.
 *   - The test-plan guard (decideAirhubPurchaseStart) runs BEFORE any provider
 *     call. If PurchaseSim is disabled or the plan is not the test plan, NO
 *     provider call is made and the order stays paid.
 *   - paid -> purchase_started (atomic) -> fulfilled | pending_review |
 *     purchase_failed based on a defensive response parse. Never fakes success.
 *   - Activation/QR data is stored only if returned; it is never exposed beyond
 *     the existing token-gated customer order page.
 *   - GetActivationCode is NOT called in this phase.
 */
export async function fulfillPaidEsimOrderWithAirhub(
  orderId: string,
): Promise<EsimFulfillmentOutcome> {
  if (!hasSupabaseAdminEnv()) {
    return { kind: "skipped", reason: "db_not_configured" };
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("esim_orders")
    .select("id,provider,status,plan_code,travel_date,unique_order_id,provider_order_id,activation_code")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw error;

  const row = data as EsimFulfillmentRow | null;
  if (!row) return { kind: "skipped", reason: "not_found" };
  if (row.provider !== "airhub") return { kind: "skipped", reason: "not_airhub" };
  if (row.status === "pending_review") {
    return { kind: "skipped", reason: "pending_review_not_safe_to_retry" };
  }
  if (row.status !== "paid") return { kind: "skipped", reason: `not_paid:${row.status}` };

  const config = getAirhubConfig();
  const decision = decideAirhubPurchaseStart({
    purchaseEnabled: config.purchaseEnabled,
    testPurchaseOnly: config.testPurchaseOnly,
    allowNonTestPlanPurchase: config.allowNonTestPlanPurchase,
    testPlanCode: config.testPlanCode,
    planCode: row.plan_code,
    status: row.status,
    hasActivationCode: Boolean(row.activation_code),
  });

  if (decision.kind === "skip_existing") {
    return { kind: "skipped", reason: decision.reason };
  }
  if (decision.kind !== "ready") {
    // disabled / blocked_plan: NEVER call the provider. Order stays paid.
    return { kind: "blocked", reason: decision.code };
  }

  // Ensure a unique_order_id exists before the provider call.
  let uniqueOrderId = row.unique_order_id;
  if (!uniqueOrderId) {
    const generatedUniqueOrderId = generateAirhubUniqueOrderId();
    const persisted = await supabase
      .from("esim_orders")
      .update({ unique_order_id: generatedUniqueOrderId })
      .eq("id", row.id)
      .is("unique_order_id", null)
      .select("unique_order_id")
      .maybeSingle();
    if (persisted.error) throw persisted.error;
    uniqueOrderId =
      (persisted.data as { unique_order_id?: string } | null)?.unique_order_id ??
      (await readPersistedUniqueOrderId(row.id));
    if (!uniqueOrderId) {
      throw new Error("Unable to persist Airhub unique_order_id");
    }
  }

  // Atomic claim: paid -> purchase_started. Prevents a double purchase.
  const claim = await supabase
    .from("esim_orders")
    .update({ status: "purchase_started" })
    .eq("id", row.id)
    .eq("status", "paid")
    .select("id");
  if (claim.error) throw claim.error;
  if (!Array.isArray(claim.data) || claim.data.length !== 1) {
    return { kind: "skipped", reason: "already_claimed" };
  }

  const body = buildPurchaseSimRequest({
    partnerCode: config.partnerCode,
    planCode: row.plan_code,
    uniqueOrderId,
    travelDate: row.travel_date,
  });

  let response: unknown;
  try {
    response = await airhubJsonRequest<unknown>(AIRHUB_ENDPOINTS.purchaseSim, {
      method: "POST",
      body,
      errorCode: "airhub_purchase_failed",
    });
  } catch {
    // Ambiguous transport/provider error: the order may or may not have been
    // placed, so route to manual review rather than assuming failure.
    await supabase
      .from("esim_orders")
      .update({ status: "pending_review", error_code: "airhub_purchase_call_error" })
      .eq("id", row.id)
      .eq("status", "purchase_started");
    return { kind: "pending_review", reason: "provider_call_error" };
  }

  const parsed = parsePurchaseSimResponse(response);
  const outcome = decidePurchaseOutcomeStatus(parsed);

  const update: Record<string, unknown> = {
    status: outcome.status,
    provider_response: toProviderResponseJson(response),
    error_code: outcome.status === "purchase_failed" ? (parsed.errorCode ?? outcome.reason) : null,
  };
  if (parsed.providerOrderId) update.provider_order_id = parsed.providerOrderId;
  if (parsed.activationCode) update.activation_code = parsed.activationCode;
  if (parsed.lpaCode) update.lpa_code = parsed.lpaCode;
  if (parsed.apn) update.apn = parsed.apn;
  if (parsed.simId) update.sim_id = parsed.simId;
  if (parsed.simPin) update.sim_pin = parsed.simPin;
  if (parsed.qrPayload) update.qr_payload = parsed.qrPayload;

  const applied = await supabase
    .from("esim_orders")
    .update(update)
    .eq("id", row.id)
    .eq("status", "purchase_started");
  if (applied.error) throw applied.error;

  if (outcome.status === "fulfilled") return { kind: "fulfilled" };
  if (outcome.status === "purchase_failed") return { kind: "failed", reason: outcome.reason };
  return { kind: "pending_review", reason: outcome.reason };
}

/**
 * PurchaseSim guard summary for the admin order detail. Reads config flags +
 * the pure guard; returns booleans/labels only (no secrets).
 */
export function getEsimFulfillmentGuardView(input: {
  status: string;
  planCode: string;
  hasActivationCode: boolean;
}): EsimFulfillmentGuardView {
  const config = getAirhubConfig();
  const isTestPlan = input.planCode === config.testPlanCode;
  const decision = decideAirhubPurchaseStart({
    purchaseEnabled: config.purchaseEnabled,
    testPurchaseOnly: config.testPurchaseOnly,
    allowNonTestPlanPurchase: config.allowNonTestPlanPurchase,
    testPlanCode: config.testPlanCode,
    planCode: input.planCode,
    status: input.status,
    hasActivationCode: input.hasActivationCode,
  });

  let blockedReason: string | null = null;
  switch (decision.kind) {
    case "skip_existing":
      blockedReason =
        decision.reason === "already_fulfilled"
          ? "This order already has activation data."
          : "Fulfillment is already in progress.";
      break;
    case "disabled":
      blockedReason = "PurchaseSim is disabled (AIRHUB_PURCHASE_ENABLED is not true).";
      break;
    case "blocked_plan":
      blockedReason = `Test mode allows only the test plan (${config.testPlanCode}); this plan cannot be purchased.`;
      break;
    case "ready":
      if (input.status !== "paid") {
        blockedReason = `Fulfillment runs only for paid orders (current status: ${input.status}).`;
      } else if (!isTestPlan) {
        blockedReason = `Only the test plan (${config.testPlanCode}) can be fulfilled from admin.`;
      }
      break;
  }

  const canRun = decision.kind === "ready" && input.status === "paid" && isTestPlan;
  return {
    purchaseEnabled: config.purchaseEnabled,
    testPurchaseOnly: config.testPurchaseOnly,
    testPlanCode: config.testPlanCode,
    isTestPlan,
    canRunTestFulfillment: canRun,
    blockedReason: canRun ? null : blockedReason,
  };
}

function toProviderResponseJson(response: unknown): unknown {
  if (response && typeof response === "object") return response;
  return { raw: typeof response === "string" ? response.slice(0, 2000) : String(response) };
}

async function readPersistedUniqueOrderId(orderId: string): Promise<string | null> {
  const { data, error } = await getSupabaseAdminClient()
    .from("esim_orders")
    .select("unique_order_id")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw error;
  const value = (data as { unique_order_id?: string | null } | null)?.unique_order_id;
  return typeof value === "string" && value.trim() ? value : null;
}
