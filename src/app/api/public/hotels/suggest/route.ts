import type { NextRequest } from "next/server";

import {
  getHotelDestinationSuggestions,
  HotelSearchError,
} from "@/server/hotels/search";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { mapProviderError } from "@/server/providers/ratehawk/errors";
import { consumeProviderRateLimit } from "@/server/security/provider-rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const language = request.nextUrl.searchParams.get("language") ?? "en";

  if (query.trim().length < 3) {
    return jsonOk([]);
  }

  const limit = await consumeProviderRateLimit({
    request,
    routeKey: "hotel-autocomplete",
    limit: 30,
    windowSeconds: 60,
  });

  if (!limit.allowed) {
    return jsonError(
      limit.unavailable ? 503 : 429,
      limit.unavailable
        ? "Location search is temporarily unavailable."
        : "Too many location searches. Please wait a moment.",
      { headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const suggestions = await getHotelDestinationSuggestions(
      query,
      language,
      request.signal,
    );
    return jsonOk(suggestions, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=1800",
      },
    });
  } catch (error) {
    if (error instanceof HotelSearchError) {
      return jsonError(error.publicStatus, error.publicMessage);
    }
    const safe = mapProviderError(error);
    logServerError("api.public.hotels.suggest", error);
    return jsonError(safe.status, safe.message);
  }
}
