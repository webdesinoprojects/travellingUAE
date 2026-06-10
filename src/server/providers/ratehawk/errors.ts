import "server-only";

import { RateHawkError } from "./client";
import { HotelSearchValidationError } from "./hotels";

/**
 * Maps internal provider/validation errors to a safe, generic public shape.
 *
 * Rules:
 * - Validation errors (bad user input) surface their own short, safe message
 *   with a 400 so the UI can correct the request.
 * - Every provider/network error collapses to a generic message. The real
 *   cause stays in server logs only. No provider payload, code detail, auth or
 *   PII ever reaches the response.
 */

export type PublicProviderError = {
  status: number;
  message: string;
};

const GENERIC_UNAVAILABLE =
  "Hotel availability is temporarily unavailable. Please try again shortly.";

export function mapProviderError(error: unknown): PublicProviderError {
  if (error instanceof HotelSearchValidationError) {
    return { status: 400, message: error.message };
  }

  if (error instanceof RateHawkError) {
    switch (error.code) {
      case "not_configured":
        return {
          status: 503,
          message: "Hotel search is not available right now.",
        };
      case "rate_limited":
        return {
          status: 429,
          message: "We are receiving a lot of requests. Please try again in a moment.",
        };
      case "timeout":
      case "circuit_open":
      case "http_error":
      case "provider_error":
      case "invalid_response":
      case "network_error":
      default:
        return { status: 502, message: GENERIC_UNAVAILABLE };
    }
  }

  return { status: 500, message: GENERIC_UNAVAILABLE };
}
