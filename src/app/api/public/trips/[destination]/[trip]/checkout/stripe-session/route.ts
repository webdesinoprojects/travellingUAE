import { cookies } from "next/headers";

import {
  readJsonObject,
  readNumber,
  readString,
  requireEmail,
} from "@/server/http/validation";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { getCheckoutSummary, SESSION_COOKIE } from "@/server/itinerary/dal";
import {
  cancelOrphanBooking,
  createPaymentPendingBooking,
  linkStripeSessionToBooking,
} from "@/server/mutations/bookings";
import {
  getStripe,
  hasStripeEnv,
  toStripeAmount,
} from "@/server/payments/stripe";

export const dynamic = "force-dynamic";

/**
 * SP-1 scope: charges only the selected option add-on amount (hotel room delta),
 * NOT the full base trip price. The base trip is handled separately via the enquiry flow.
 * This is intentional - the live hotel option is the only confirmed-price item at this stage.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ destination: string; trip: string }> },
) {
  let bookingId: string | null = null;

  try {
    const { destination, trip } = await context.params;

    if (!hasStripeEnv()) {
      return jsonError(503, "Payment service is not available.");
    }

    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;

    const summary = await getCheckoutSummary({
      destinationSlug: destination,
      tripSlug: trip,
      sessionToken,
    });

    if (!summary) {
      return jsonError(404, "Your selection has expired or is not found.");
    }

    // SP-1 charges the option add-on delta only (live hotel room surcharge above the base trip).
    const optionAddOnAmount = summary.totalDelta.amount;
    const optionAddOnCurrency = summary.totalDelta.currency;

    if (optionAddOnAmount <= 0) {
      return jsonError(400, "No chargeable option add-on for this selection.");
    }

    const body = await readJsonObject(request);
    const fullName = readString(body, "fullName", { min: 2, max: 120, required: true })!;
    const email = requireEmail(readString(body, "email", { max: 180, required: true }));
    const phone = readString(body, "phone", { min: 5, max: 40, required: true })!;
    const nationality = readString(body, "nationality", { max: 80 });
    const travelersCount = Math.round(
      readNumber(body, "travelersCount", { min: 1, max: 50, fallback: 1 }) ?? 1,
    );
    const message = readString(body, "message", { max: 2000 });

    // Create booking first so we have a stable ID to pass to Stripe metadata.
    bookingId = await createPaymentPendingBooking({
      tripId: summary.trip.id,
      destinationSlug: destination,
      tripSlug: trip,
      fullName,
      email,
      phone,
      nationality,
      travelersCount,
      travelDate: summary.travelDate,
      message,
      optionSessionToken: sessionToken,
      optionAddOnAmount,
      optionAddOnCurrency,
    });

    const stripe = getStripe();
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
    const currency = optionAddOnCurrency.toLowerCase();

    // Label clearly as option add-on so Stripe's receipt matches what was described to the customer.
    const optionLabels = summary.selections
      .map((s) => s.optionLabel)
      .slice(0, 3)
      .join(", ");
    const lineItemName = `Hotel add-on - ${summary.trip.title}`;

    const stripeSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: lineItemName,
              description: optionLabels || undefined,
            },
            unit_amount: toStripeAmount(optionAddOnAmount, currency),
          },
          quantity: 1,
        },
      ],
      customer_email: email,
      success_url: `${siteUrl}/trips/${destination}/${trip}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/trips/${destination}/${trip}/checkout`,
      client_reference_id: bookingId,
      metadata: {
        booking_id: bookingId,
        trip_id: summary.trip.id,
        charge_type: "option_add_on",
      },
      payment_intent_data: {
        metadata: { booking_id: bookingId },
      },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });

    if (!stripeSession.url) {
      throw new Error("Stripe session returned no URL");
    }

    await linkStripeSessionToBooking({
      bookingId,
      stripeSessionId: stripeSession.id,
    });

    // bookingId linked - clear it so the catch block does not try to cancel it.
    bookingId = null;

    // Return only the redirect URL - no internal IDs, no Stripe object fields.
    return jsonOk({ url: stripeSession.url });
  } catch (error) {
    logServerError("api.public.trip.checkout.stripe-session", error);

    // If we created a booking but failed before linking the Stripe session, cancel it.
    // Leaves no orphaned 'pending' rows with no associated session.
    if (bookingId) {
      await cancelOrphanBooking(bookingId);
    }

    return jsonError(500);
  }
}
