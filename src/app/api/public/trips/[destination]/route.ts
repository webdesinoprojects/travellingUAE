import { type NextRequest } from "next/server";

import {
  getPublicTripDestination,
  getPublicTripDestinations,
} from "@/server/public/dal";
import {
  filterTripDestination,
  parseTripFilters,
} from "@/server/public/filters";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ destination: string }> },
) {
  try {
    const { destination: destinationSlug } = await context.params;
    const destination = await getPublicTripDestination(destinationSlug);

    if (!destination) {
      return jsonError(404, "The requested package list was not found.");
    }

    const filters = parseTripFilters(request.nextUrl.searchParams);
    const filteredDestination = filterTripDestination(destination, filters);

    return jsonOk({
      destination: filteredDestination,
      destinations: await getPublicTripDestinations(),
      filters,
      total: filteredDestination.packages.length,
    });
  } catch (error) {
    logServerError("api.public.trips.destination", error);
    return jsonError(500);
  }
}
