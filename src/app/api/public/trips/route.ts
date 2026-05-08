import { getPublicTripDestinations } from "@/server/public/dal";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";

export async function GET() {
  try {
    const destinations = await getPublicTripDestinations();

    return jsonOk({
      destinations,
      total: destinations.length,
    });
  } catch (error) {
    logServerError("api.public.trips", error);
    return jsonError(500);
  }
}

