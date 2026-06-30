import type { NextRequest } from "next/server";

import {
  getStandaloneCheckoutCookieOptions,
  HOTEL_CHECKOUT_COOKIE,
  StandaloneHotelBookingError,
  startStandaloneHotelPrebook,
} from "@/server/hotels/booking";
import { HOTEL_SEARCH_COOKIE } from "@/server/hotels/search";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { readJsonObject, readString } from "@/server/http/validation";
import { mapProviderError } from "@/server/providers/ratehawk/errors";
import { consumeProviderRateLimit } from "@/server/security/provider-rate-limit";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ hotelId: string }> },
) {
  const limit = await consumeProviderRateLimit({
    request,
    routeKey: "standalone-hotel-prebook",
    limit: 8,
    windowSeconds: 60,
  });

  if (!limit.allowed) {
    return jsonError(
      limit.unavailable ? 503 : 429,
      limit.unavailable
        ? "Room confirmation is temporarily unavailable. Please try again shortly."
        : "Too many room confirmation attempts. Please wait a moment and try again.",
      { headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const { hotelId } = await context.params;
    const body = await readJsonObject(request);
    const searchId = readString(body, "searchId", { required: true, max: 80 })!;
    const rateId = readString(body, "rateId", { required: true, max: 80 })!;

    const result = await startStandaloneHotelPrebook({
      searchId,
      hotelId,
      rateId,
      hotelSearchToken: request.cookies.get(HOTEL_SEARCH_COOKIE)?.value,
      headers: request.headers,
      signal: request.signal,
    });

    const response = jsonOk(
      {
        checkoutId: result.checkoutId,
        checkoutUrl: result.checkoutUrl,
        paymentMode: result.paymentMode,
        unsupportedReason: result.unsupportedReason,
        priceChanged: result.priceChanged,
        oldPrice: result.oldPrice,
        newPrice: result.newPrice,
      },
      { status: 201 },
    );
    response.cookies.set(
      HOTEL_CHECKOUT_COOKIE,
      result.checkoutToken,
      getStandaloneCheckoutCookieOptions(),
    );
    return response;
  } catch (error) {
    if (error instanceof StandaloneHotelBookingError) {
      return jsonError(error.status, error.message);
    }
    const safe = mapProviderError(error);
    logServerError("api.public.hotels.prebook", error);
    return jsonError(safe.status, safe.message);
  }
}
