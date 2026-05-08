import { cookies } from "next/headers";

import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { selectSegmentOption, SESSION_COOKIE } from "@/server/itinerary/dal";

export async function POST(
  request: Request,
  context: { params: Promise<{ destination: string; trip: string }> },
) {
  try {
    const { destination, trip } = await context.params;
    const cookieStore = await cookies();
    const selection = await selectSegmentOption({
      destinationSlug: destination,
      tripSlug: trip,
      request,
      cookieStore,
    });

    if (!selection) {
      return jsonError(400, "We could not update that option.");
    }

    const response = jsonOk(selection.result, { status: 201 });
    response.cookies.set(SESSION_COOKIE, selection.sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: selection.maxAge,
    });

    return response;
  } catch (error) {
    logServerError("api.public.trip.selection", error);
    return jsonError(500);
  }
}

