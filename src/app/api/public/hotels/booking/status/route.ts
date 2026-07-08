import type { NextRequest } from "next/server";

import {
  getStandaloneHotelPublicStatus,
  HOTEL_CHECKOUT_COOKIE,
  StandaloneHotelBookingError,
} from "@/server/hotels/booking";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { consumeProviderRateLimit } from "@/server/security/provider-rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limit = await consumeProviderRateLimit({
    request,
    routeKey: "standalone-hotel-status",
    limit: 30,
    windowSeconds: 60,
  });

  if (!limit.allowed) {
    return jsonError(
      limit.unavailable ? 503 : 429,
      limit.unavailable
        ? "Booking status is temporarily unavailable. Please try again shortly."
        : "Too many status checks. Please wait a moment and try again.",
      { headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const checkoutId =
      request.nextUrl.searchParams.get("checkoutId") ??
      request.nextUrl.searchParams.get("checkout_id") ??
      "";
    const stripeSessionId = request.nextUrl.searchParams.get("session_id");
    const threeDsReturned =
      request.nextUrl.searchParams.get("three_ds_return") === "1";

    const status = await getStandaloneHotelPublicStatus({
      checkoutId,
      checkoutToken: request.cookies.get(HOTEL_CHECKOUT_COOKIE)?.value,
      stripeSessionId,
      threeDsReturned,
    });

    if (!status) {
      return jsonError(404, "This hotel booking status is no longer available.");
    }

    return jsonOk(status);
  } catch (error) {
    if (error instanceof StandaloneHotelBookingError) {
      return jsonError(error.status, error.message);
    }
    logServerError("api.public.hotels.booking.status", error);
    return jsonError(500);
  }
}
