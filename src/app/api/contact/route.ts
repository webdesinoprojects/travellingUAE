import { GENERIC_PUBLIC_ERROR } from "@/lib/safe-error";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { createContactSubmission } from "@/server/mutations/contact";

export async function POST(request: Request) {
  try {
    const result = await createContactSubmission(request);

    if (!result.ok) {
      return jsonError(503, GENERIC_PUBLIC_ERROR);
    }

    return jsonOk({ message: result.message }, { status: 201 });
  } catch (error) {
    logServerError("api.contact", error);
    return jsonError(400, GENERIC_PUBLIC_ERROR);
  }
}

