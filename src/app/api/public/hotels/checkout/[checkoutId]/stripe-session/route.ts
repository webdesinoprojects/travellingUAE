import type { NextRequest } from "next/server";

import {
  createStandaloneHotelStripeSession,
  HOTEL_CHECKOUT_COOKIE,
  StandaloneHotelBookingError,
} from "@/server/hotels/booking";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { readJsonObject, readString } from "@/server/http/validation";
import { consumeProviderRateLimit } from "@/server/security/provider-rate-limit";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ checkoutId: string }> },
) {
  const limit = await consumeProviderRateLimit({
    request,
    routeKey: "standalone-hotel-stripe",
    limit: 6,
    windowSeconds: 60,
  });

  if (!limit.allowed) {
    return jsonError(
      limit.unavailable ? 503 : 429,
      limit.unavailable
        ? "Payment is temporarily unavailable. Please try again shortly."
        : "Too many payment attempts. Please wait a moment and try again.",
      { headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const { checkoutId } = await context.params;
    const body = await readJsonObject(request);
    const result = await createStandaloneHotelStripeSession({
      checkoutId,
      checkoutToken: request.cookies.get(HOTEL_CHECKOUT_COOKIE)?.value,
      contact: {
        firstName: readString(body, "firstName", { min: 1, max: 80, required: true })!,
        lastName: readString(body, "lastName", { min: 1, max: 80, required: true })!,
        email: readString(body, "email", { min: 3, max: 180, required: true })!,
        phone: readString(body, "phone", { min: 5, max: 40, required: true })!,
        comment: readString(body, "comment", { max: 2000 }) ?? null,
      },
      guestRooms: (body as Record<string, unknown>).guestRooms,
    });

    return jsonOk({ url: result.url });
  } catch (error) {
    if (error instanceof StandaloneHotelBookingError) {
      return jsonError(error.status, error.message);
    }
    logServerError("api.public.hotels.checkout.stripe-session", error);
    return jsonError(500);
  }
}
