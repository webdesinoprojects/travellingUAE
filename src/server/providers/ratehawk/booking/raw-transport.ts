import "server-only";

import { rateHawkBookingRequest } from "@/server/providers/ratehawk/client";
import { assertBookingEnabled } from "./transport.ts";
import type { OrchestratorTransport, OrchestratorTransportResult } from "./orchestrator.ts";
import type { BookingStep } from "./contracts.ts";

/**
 * Real ETG booking transport. Guards on the feature flag, then calls the
 * provider via rateHawkBookingRequest which preserves the raw ETG envelope
 * status (processing, 3ds, completed, etc.) without throwing on non-ok values.
 *
 * This is NOT the default transport returned by createDefaultBookingTransport()
 * in transport.ts - that one is a guarded stub. This real transport is
 * explicitly wired by the job worker only when the feature flag is on.
 *
 * No hashes, credentials, PII, or provider request IDs leave this layer.
 * The data field from the ETG envelope is passed through as opaque unknown;
 * callers must not log or serialize it.
 */
export function createRealBookingTransport(): OrchestratorTransport {
  return {
    async call(
      step: BookingStep,
      path: string,
      body: Record<string, unknown>,
    ): Promise<OrchestratorTransportResult> {
      assertBookingEnabled();

      const result = await rateHawkBookingRequest(path, body);

      return {
        httpStatus: result.httpStatus,
        status: result.status,
        error: result.error,
        data: result.data,
      };
    },
  };
}
