import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { getTripItineraryDTO } from "@/server/itinerary/dal";

export async function GET(
  _request: Request,
  context: { params: Promise<{ destination: string; trip: string }> },
) {
  try {
    const { destination, trip } = await context.params;
    const itinerary = await getTripItineraryDTO(destination, trip);

    if (!itinerary) {
      return jsonError(404, "The requested itinerary was not found.");
    }

    return jsonOk(itinerary);
  } catch (error) {
    logServerError("api.public.trip.itinerary", error);
    return jsonError(500);
  }
}

