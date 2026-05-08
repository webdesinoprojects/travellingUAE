import { GENERIC_PUBLIC_ERROR } from "@/lib/safe-error";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { createBooking } from "@/server/mutations/bookings";
import { SESSION_COOKIE } from "@/server/itinerary/dal";

export async function POST(request: Request) {
  try {
    const optionSessionToken = request.headers
      .get("cookie")
      ?.split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${SESSION_COOKIE}=`))
      ?.split("=")[1];
    const result = await createBooking(request, optionSessionToken);

    if (!result.ok) {
      return jsonError(503, GENERIC_PUBLIC_ERROR);
    }

    return jsonOk({ message: result.message }, { status: 201 });
  } catch (error) {
    logServerError("api.bookings", error);
    return jsonError(400, GENERIC_PUBLIC_ERROR);
  }
}
