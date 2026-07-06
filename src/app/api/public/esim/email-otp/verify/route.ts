import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { readJsonObject, readString } from "@/server/http/validation";
import { verifyEsimEmailOtp } from "@/server/esim/email-verification";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    const email = readString(body, "email", { min: 3, max: 180, required: true })!;
    const code = readString(body, "code", { min: 6, max: 6, required: true })!;
    const result = await verifyEsimEmailOtp(email, code);

    if (result.ok) {
      return jsonOk({ verified: true });
    }

    if (result.reason === "db_not_configured") {
      return jsonError(503, "Email verification is temporarily unavailable.");
    }
    if (result.reason === "too_many_attempts") {
      return jsonError(429, "Too many attempts. Request a new code.");
    }
    if (result.reason === "expired" || result.reason === "no_code") {
      return jsonError(400, "Request a new verification code.");
    }

    return jsonError(400, "The verification code is invalid.");
  } catch (error) {
    logServerError("api.public.esim.email-otp.verify", error);
    return jsonError(500);
  }
}
