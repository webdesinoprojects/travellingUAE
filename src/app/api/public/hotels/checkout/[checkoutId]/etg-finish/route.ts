import { NextResponse, type NextRequest } from "next/server";

import {
  finishStandaloneHotelNowBooking,
  HOTEL_CHECKOUT_COOKIE,
  StandaloneHotelBookingError,
} from "@/server/hotels/booking";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { consumeProviderRateLimit } from "@/server/security/provider-rate-limit";

export const dynamic = "force-dynamic";

/**
 * ETG `now` payment - step 2: Start Booking + first status check.
 *
 * Returns { status, threeDs, successUrl }. When `threeDs` is present the browser
 * must submit it to the ACS (3-D Secure); otherwise it navigates to successUrl
 * where the status poller resolves the final booking state. No card data is
 * accepted here (tokenization already happened in step 1).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ checkoutId: string }> },
) {
  const limit = await consumeProviderRateLimit({
    request,
    routeKey: "standalone-hotel-now-finish",
    limit: 6,
    windowSeconds: 60,
  });

  if (!limit.allowed) {
    return jsonError(
      limit.unavailable ? 503 : 429,
      limit.unavailable
        ? "Booking is temporarily unavailable. Please try again shortly."
        : "Too many attempts. Please wait a moment and try again.",
      { headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const { checkoutId } = await context.params;
    const result = await finishStandaloneHotelNowBooking({
      checkoutId,
      checkoutToken: request.cookies.get(HOTEL_CHECKOUT_COOKIE)?.value,
      signal: request.signal,
    });

    return jsonOk(result);
  } catch (error) {
    if (error instanceof StandaloneHotelBookingError) {
      return NextResponse.json(
        { ok: false, code: error.code, message: error.message },
        { status: error.status },
      );
    }
    logServerError("api.public.hotels.checkout.etg-finish", error);
    return jsonError(500);
  }
}
