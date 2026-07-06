import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { readJsonObject, readString } from "@/server/http/validation";
import { sendEsimEmailOtp } from "@/server/esim/email-verification";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    const email = readString(body, "email", { min: 3, max: 180, required: true })!;
    const result = await sendEsimEmailOtp(email);

    if (result.ok) {
      return jsonOk({ sent: true });
    }

    if (result.reason === "cooldown" || result.reason === "rate_limited") {
      return jsonError(
        429,
        "Please wait before requesting another code.",
        result.retryAfterSeconds
          ? { headers: { "Retry-After": String(result.retryAfterSeconds) } }
          : undefined,
      );
    }
    if (result.reason === "invalid_email") {
      return jsonError(400, "Enter a valid email address.");
    }
    if (result.reason === "email_not_configured" || result.reason === "db_not_configured") {
      return jsonError(503, "Email verification is temporarily unavailable.");
    }

    return jsonError(502, "Verification email could not be sent.");
  } catch (error) {
    logServerError("api.public.esim.email-otp.send", error);
    return jsonError(500);
  }
}
