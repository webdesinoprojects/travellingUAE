import type Stripe from "stripe";

import { logServerError } from "@/server/http/response";
import {
  updatePaymentStatusByBookingId,
  updatePaymentStatusBySession,
} from "@/server/mutations/bookings";
import { getStripe, getWebhookSecret } from "@/server/payments/stripe";

export const dynamic = "force-dynamic";

// Raw body required for Stripe signature verification - do not parse JSON.
export async function POST(request: Request) {
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return new Response("Missing Stripe-Signature header", { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, getWebhookSecret());
  } catch (err) {
    logServerError("webhook.stripe.signature", err);
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  try {
    await handleStripeEvent(event);
  } catch (err) {
    // DB or processing failure - return 5xx so Stripe retries with exponential backoff.
    // Status transition guards make retries safe (idempotent).
    logServerError("webhook.stripe.handle", err);
    return new Response("Internal processing error", { status: 500 });
  }

  return new Response(null, { status: 200 });
}

async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await updatePaymentStatusBySession({
        stripeSessionId: session.id,
        paymentStatus: "paid",
        stripePaymentIntentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : null,
        // Store the actual amount charged so we can verify it matches the planned amount.
        paidAmountUnits: session.amount_total ?? null,
        paidCurrency: session.currency ?? null,
      });
      break;
    }

    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      await updatePaymentStatusBySession({
        stripeSessionId: session.id,
        paymentStatus: "expired",
      });
      break;
    }

    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const bookingId = pi.metadata?.booking_id;
      if (bookingId) {
        await updatePaymentStatusByBookingId({
          bookingId,
          paymentStatus: "failed",
        });
      }
      break;
    }

    default:
      break;
  }
}
