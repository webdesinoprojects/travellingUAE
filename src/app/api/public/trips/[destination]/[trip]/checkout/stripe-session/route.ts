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
import { extractTrustedUserIp } from "@/server/providers/ratehawk/booking/ip-trust";
import { validateCheckoutGuestRooms } from "@/server/providers/ratehawk/booking/checkout-guests";
import type { ValidatedCheckoutGuestRoom } from "@/server/providers/ratehawk/booking/checkout-guests";
import {
  getStripe,
  hasStripeEnv,
  toStripeAmount,
} from "@/server/payments/stripe";

export const dynamic = "force-dynamic";

/**
 * Charges the full trip totalPayable:
 *   base package price x travelers + sum of selected option deltas.
 *
 * The RateHawk hotel rate is charged at the prebooked room amount (fixed,
 * not multiplied by traveler count; occupancy is set at search/prebook time).
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

    const { pricing } = summary;
    const totalPayable = pricing.totalPayable;
    const currency = pricing.currency;

    if (totalPayable <= 0) {
      return jsonError(400, "No payable amount for this selection.");
    }

    const body = await readJsonObject(request);
    const firstName = readString(body, "firstName", { min: 1, max: 80, required: true })!;
    const lastName = readString(body, "lastName", { min: 1, max: 80, required: true })!;
    const email = requireEmail(readString(body, "email", { max: 180, required: true }));
    const phone = readString(body, "phone", { min: 5, max: 40, required: true })!;
    const nationality = readString(body, "nationality", { max: 80 });
    // Use the server-authoritative travelersCount from the locked session.
    // If the client submits a value, validate it matches - mismatch means a
    // stale form or tampered request; reject rather than silently mischarge.
    const bodyTravelersCount = readNumber(body, "travelersCount", { min: 1, max: 50 });
    if (
      bodyTravelersCount != null &&
      Math.round(bodyTravelersCount) !== pricing.travelersCount
    ) {
      return jsonError(400, "Invalid request. Please refresh the page and try again.");
    }
    const travelersCount = pricing.travelersCount;
    const message = readString(body, "message", { max: 2000 });
    let trustedUserIp: string | null = null;
    let checkoutGuestRooms: ValidatedCheckoutGuestRoom[] | null = null;

    if (summary.hotelOccupancy && summary.hotelOccupancy.length > 0) {
      trustedUserIp = extractTrustedUserIp(request.headers);

      if (!trustedUserIp) {
        return jsonError(
          400,
          "We could not verify your network details. Please send an enquiry or contact us.",
        );
      }

      const guestValidation = validateCheckoutGuestRooms(
        (body as Record<string, unknown>).guestRooms,
        summary.hotelOccupancy,
      );

      if (!guestValidation.ok) {
        return jsonError(400, "Please review traveler details and try again.");
      }

      checkoutGuestRooms = guestValidation.rooms ?? null;
    }

    // Segment IDs identify which selections are included (safe, no provider hashes).
    // Prebook snapshot links are stored on the selection rows themselves.
    const selectedSegmentIds = summary.selections.map((s) => s.segmentId);

    const pricingSnapshot = {
      basePricePerTraveler: pricing.basePricePerTraveler,
      travelersCount: pricing.travelersCount,
      baseSubtotal: pricing.baseSubtotal,
      selectedOptionsSubtotal: pricing.selectedOptionsSubtotal,
      totalPayable: pricing.totalPayable,
      currency,
      selectedSegmentIds,
    };

    // Create booking first so we have a stable ID to pass to Stripe metadata.
    bookingId = await createPaymentPendingBooking({
      tripId: summary.trip.id,
      destinationSlug: destination,
      tripSlug: trip,
      firstName,
      lastName,
      email,
      phone,
      nationality,
      travelersCount,
      travelDate: summary.travelDate,
      message,
      optionSessionToken: sessionToken,
      totalPayableAmount: totalPayable,
      totalPayableCurrency: currency,
      pricingSnapshot,
      trustedUserIp,
      checkoutGuestRooms,
    });

    const stripe = getStripe();
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
    const stripeCurrency = currency.toLowerCase();

    const lineItemName = `${summary.trip.title} - Trip Booking`;
    const optionLabels = summary.selections
      .map((s) => s.optionLabel)
      .slice(0, 3)
      .join(", ");

    const stripeSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: stripeCurrency,
            product_data: {
              name: lineItemName,
              description: optionLabels || undefined,
            },
            unit_amount: toStripeAmount(totalPayable, stripeCurrency),
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
        charge_type: "full_trip",
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
    if (bookingId) {
      await cancelOrphanBooking(bookingId);
    }

    return jsonError(500);
  }
}
