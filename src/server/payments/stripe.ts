import "server-only";

import Stripe from "stripe";

// Singleton to avoid re-instantiating across hot reloads in dev.
let _stripe: Stripe | null = null;

function buildStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
}

export function getStripe(): Stripe {
  if (!_stripe) _stripe = buildStripe();
  return _stripe;
}

export function hasStripeEnv(): boolean {
  return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

export function getWebhookSecret(): string {
  const s = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  return s;
}

// Per Stripe docs: these currencies use no decimal places.
const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga",
  "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);

/** Convert an amount in major currency units (e.g. 200 USD) to Stripe's smallest unit (20000 cents). */
export function toStripeAmount(amount: number, currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase())
    ? Math.round(amount)
    : Math.round(amount * 100);
}

/** Inverse of toStripeAmount - convert Stripe's smallest-unit amount back to major units. */
export function fromStripeAmount(amountUnits: number, currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase())
    ? amountUnits
    : amountUnits / 100;
}
