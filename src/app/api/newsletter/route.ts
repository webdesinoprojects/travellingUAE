import { GENERIC_PUBLIC_ERROR } from "@/lib/safe-error";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { subscribeNewsletter } from "@/server/mutations/newsletter";

export async function POST(request: Request) {
  try {
    const result = await subscribeNewsletter(request);

    if (!result.ok) {
      return jsonError(503, GENERIC_PUBLIC_ERROR);
    }

    return jsonOk({ message: result.message }, { status: 201 });
  } catch (error) {
    logServerError("api.newsletter", error);
    return jsonError(400, GENERIC_PUBLIC_ERROR);
  }
}

