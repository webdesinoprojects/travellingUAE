import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { readJsonObject, readString } from "@/server/http/validation";
import { prebookLiveHotelOption } from "@/server/itinerary/dal";
import { consumeProviderRateLimit } from "@/server/security/provider-rate-limit";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ destination: string; trip: string }> },
) {
  try {
    const limit = await consumeProviderRateLimit({
      request,
      routeKey: "hotel-prebook",
      limit: 10,
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

    const { destination, trip } = await context.params;
    const body = await readJsonObject(request);
    const segmentId = readString(body, "segmentId", { required: true, max: 80 });
    const optionId = readString(body, "optionId", { required: true, max: 80 });

    if (!segmentId || !optionId) {
      return jsonError(400, "segmentId and optionId are required.");
    }

    const result = await prebookLiveHotelOption({
      destinationSlug: destination,
      tripSlug: trip,
      segmentId,
      optionId,
    });

    if (!result) {
      return jsonError(404, "Option not found or no longer available.");
    }

    return jsonOk(result);
  } catch (error) {
    logServerError("api.public.trip.prebook", error);
    return jsonError(502, "Could not confirm availability right now. Please try again.");
  }
}
