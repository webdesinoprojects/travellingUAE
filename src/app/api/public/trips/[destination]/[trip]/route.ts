import {
  getPublicTripDestination,
  getPublicTripPackage,
} from "@/server/public/dal";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";

export async function GET(
  _request: Request,
  context: { params: Promise<{ destination: string; trip: string }> },
) {
  try {
    const { destination: destinationSlug, trip: tripSlug } = await context.params;
    const [destination, pkg] = await Promise.all([
      getPublicTripDestination(destinationSlug),
      getPublicTripPackage(destinationSlug, tripSlug),
    ]);

    if (!destination || !pkg) {
      return jsonError(404, "The requested trip was not found.");
    }

    const recommended = destination.packages
      .filter((item) => item.slug !== pkg.slug)
      .slice(0, 3);

    return jsonOk({
      destination,
      package: pkg,
      recommended,
    });
  } catch (error) {
    logServerError("api.public.trips.detail", error);
    return jsonError(500);
  }
}

