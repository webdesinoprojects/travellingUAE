import { cookies } from "next/headers";

import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { getCheckoutSummary, SESSION_COOKIE } from "@/server/itinerary/dal";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ destination: string; trip: string }> },
) {
  try {
    const { destination, trip } = await context.params;
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
    const summary = await getCheckoutSummary({
      destinationSlug: destination,
      tripSlug: trip,
      sessionToken,
    });

    if (!summary) {
      return jsonError(404, "Your selection has expired or is not found.");
    }

    return jsonOk(summary);
  } catch (error) {
    logServerError("api.public.trip.checkout", error);
    return jsonError(500);
  }
}
