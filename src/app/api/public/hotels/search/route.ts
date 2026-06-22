import type { NextRequest } from "next/server";

import {
  createHotelSearch,
  getHotelSearchResults,
  HOTEL_SEARCH_COOKIE,
  HOTEL_SEARCH_TTL_SECONDS,
  HotelSearchError,
} from "@/server/hotels/search";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { readJsonObject } from "@/server/http/validation";
import { mapProviderError } from "@/server/providers/ratehawk/errors";
import { consumeProviderRateLimit } from "@/server/security/provider-rate-limit";
import type { HotelSearchInput } from "@/types/hotels";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const limit = await consumeProviderRateLimit({
    request,
    routeKey: "standalone-hotel-search",
    limit: 12,
    windowSeconds: 60,
  });

  if (!limit.allowed) {
    return jsonError(
      limit.unavailable ? 503 : 429,
      limit.unavailable
        ? "Hotel search is temporarily unavailable. Please try again shortly."
        : "Too many hotel searches. Please wait a moment and try again.",
      { headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const body = await readJsonObject(request);
    const result = await createHotelSearch(body as unknown as HotelSearchInput);
    const response = jsonOk({ searchId: result.searchId }, { status: 201 });

    response.cookies.set(HOTEL_SEARCH_COOKIE, result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: HOTEL_SEARCH_TTL_SECONDS,
    });

    return response;
  } catch (error) {
    if (error instanceof HotelSearchError) {
      return jsonError(error.publicStatus, error.publicMessage);
    }

    const safe = mapProviderError(error);
    logServerError("api.public.hotels.search.create", error);
    return jsonError(safe.status, safe.message);
  }
}

export async function GET(request: NextRequest) {
  const searchId = request.nextUrl.searchParams.get("searchId") ?? "";
  const token = request.cookies.get(HOTEL_SEARCH_COOKIE)?.value;

  try {
    const result = await getHotelSearchResults(searchId, token);
    return result
      ? jsonOk(result)
      : jsonError(404, "This hotel search has expired. Please search again.");
  } catch (error) {
    logServerError("api.public.hotels.search.read", error);
    return jsonError(500);
  }
}
