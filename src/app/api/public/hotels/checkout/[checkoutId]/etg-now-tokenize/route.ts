import { NextResponse, type NextRequest } from "next/server";

import {
  HOTEL_CHECKOUT_COOKIE,
  StandaloneHotelBookingError,
  tokenizeStandaloneHotelNowCard,
} from "@/server/hotels/booking";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { readJsonObject, readString } from "@/server/http/validation";
import { consumeProviderRateLimit } from "@/server/security/provider-rate-limit";

export const dynamic = "force-dynamic";

/**
 * ETG `now` payment - step 1: tokenize the card at the Payota gateway.
 *
 * PCI: this route receives raw card fields in the JSON body. They are validated
 * and forwarded to Payota by the server module and are NEVER persisted or
 * logged. The request body is never echoed. autocomplete/prefill is disabled on
 * the client card form. See the PCI note in the final report re: SAQ scope.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ checkoutId: string }> },
) {
  const limit = await consumeProviderRateLimit({
    request,
    routeKey: "standalone-hotel-now-tokenize",
    limit: 8,
    windowSeconds: 60,
  });

  if (!limit.allowed) {
    return jsonError(
      limit.unavailable ? 503 : 429,
      limit.unavailable
        ? "Card payment is temporarily unavailable. Please try again shortly."
        : "Too many attempts. Please wait a moment and try again.",
      { headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const { checkoutId } = await context.params;
    const body = await readJsonObject(request);

    const result = await tokenizeStandaloneHotelNowCard({
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
      card: {
        cardHolder: readString(body, "cardHolder", { min: 1, max: 120, required: true })!,
        cardNumber: readString(body, "cardNumber", { min: 12, max: 32, required: true })!,
        expiryMonth: readString(body, "expiryMonth", { min: 1, max: 2, required: true })!,
        expiryYear: readString(body, "expiryYear", { min: 2, max: 4, required: true })!,
        cvc: readString(body, "cvc", { min: 3, max: 4 }),
      },
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
    // Generic validation/parse failure. Do NOT log the body (card data).
    logServerError("api.public.hotels.checkout.etg-now-tokenize", error);
    return NextResponse.json(
      { ok: false, code: "card_tokenization_failed", message: "Please review the details and try again." },
      { status: 400 },
    );
  }
}
