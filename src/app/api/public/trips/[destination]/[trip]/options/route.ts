import type { NextRequest } from "next/server";

import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { getSegmentOptionsDTO } from "@/server/itinerary/dal";
import type { ItineraryOptionType } from "@/types/itinerary";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ destination: string; trip: string }> },
) {
  try {
    const { destination, trip } = await context.params;
    const segmentId = request.nextUrl.searchParams.get("segmentId");
    const type = request.nextUrl.searchParams.get("type");

    if (!segmentId || !isOptionType(type)) {
      return jsonError(400, "Please choose a valid option type.");
    }

    const data = await getSegmentOptionsDTO({
      destinationSlug: destination,
      tripSlug: trip,
      segmentId,
      optionType: type,
      searchParams: request.nextUrl.searchParams,
    });

    if (!data) {
      return jsonError(404, "No options were found for this itinerary item.");
    }

    return jsonOk(data);
  } catch (error) {
    logServerError("api.public.trip.options", error);
    return jsonError(500);
  }
}

function isOptionType(value: string | null): value is ItineraryOptionType {
  return (
    value === "flight" ||
    value === "hotel" ||
    value === "transfer" ||
    value === "activity"
  );
}

