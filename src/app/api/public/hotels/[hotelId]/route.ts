import type { NextRequest } from "next/server";

import {
  getHotelDetail,
  HOTEL_SEARCH_COOKIE,
} from "@/server/hotels/search";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { mapProviderError } from "@/server/providers/ratehawk/errors";
import { consumeProviderRateLimit } from "@/server/security/provider-rate-limit";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ hotelId: string }> },
) {
  const limit = await consumeProviderRateLimit({
    request,
    routeKey: "standalone-hotel-detail",
    limit: 18,
    windowSeconds: 60,
  });

  if (!limit.allowed) {
    return jsonError(
      limit.unavailable ? 503 : 429,
      limit.unavailable
        ? "Hotel details are temporarily unavailable. Please try again shortly."
        : "Too many hotel detail requests. Please wait a moment and try again.",
      { headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const { hotelId } = await context.params;
    const searchId = request.nextUrl.searchParams.get("searchId") ?? "";
    const token = request.cookies.get(HOTEL_SEARCH_COOKIE)?.value;
    const result = await getHotelDetail(searchId, hotelId, token);

    return result
      ? jsonOk(result)
      : jsonError(404, "This room search has expired. Please search again.");
  } catch (error) {
    const safe = mapProviderError(error);
    logServerError("api.public.hotels.detail", error);
    return jsonError(safe.status, safe.message);
  }
}
