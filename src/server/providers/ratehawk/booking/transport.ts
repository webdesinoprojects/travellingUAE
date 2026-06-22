import "server-only";

import { isRateHawkConfigured, resolveRateHawkEnv } from "../config";
import {
  evaluateProviderBookingFlag,
  type ProviderBookingFlagResult,
} from "./flags";
import type { BookingStep, ProviderResponseSignal } from "./contracts";

/**
 * Transport seam for the ETG booking chain.
 *
 * The seam exists so the booking state machine (and its tests) depend on an
 * injectable transport, never on the real provider client directly. Tests pass
 * a fixture/mock transport; nothing in this slice passes the real one, so no
 * test or code path can accidentally call ETG.
 *
 * The default transport is intentionally a guarded stub here: real ETG calls -
 * which require a raw-envelope client variant that preserves
 * `status: processing | 3ds` (the current client unwraps and discards the
 * envelope status) - are implemented in
 * `ratewhawk/03-prompt-booking-orchestrator.md`.
 */

export class BookingTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingTransportError";
  }
}

export type BookingTransportResult = ProviderResponseSignal & {
  /** Sanitized provider data payload (no hashes/PII leaves this layer upward). */
  data: unknown;
};

export type BookingTransportInput = {
  step: BookingStep;
  path: string;
  body: Record<string, unknown>;
  signal?: AbortSignal;
};

export interface BookingTransport {
  call(input: BookingTransportInput): Promise<BookingTransportResult>;
}

/** Full flag evaluation (includes failing reasons) for ops/admin visibility. */
export function getProviderBookingFlag(): ProviderBookingFlagResult {
  return evaluateProviderBookingFlag({
    enabledFlag: process.env.RATEHAWK_BOOKING_ENABLED,
    paymentModel: process.env.RATEHAWK_BOOKING_PAYMENT_MODEL,
    ratehawkEnv: resolveRateHawkEnv(),
    providerConfigured: isRateHawkConfigured(),
  });
}

export function isProviderBookingEnabled(): boolean {
  return getProviderBookingFlag().enabled;
}

/** Throw unless provider booking is fully enabled. */
export function assertBookingEnabled(): void {
  const flag = getProviderBookingFlag();
  if (!flag.enabled) {
    throw new BookingTransportError(
      `provider booking is disabled: ${flag.reasons.join("; ")}`,
    );
  }
}

/**
 * Default transport. Guards on the feature flag, then refuses: no real ETG call
 * is wired in the foundation slice. This guarantees that even if a future caller
 * forgets to inject a transport, it cannot reach the provider here.
 */
export function createDefaultBookingTransport(): BookingTransport {
  return {
    async call(): Promise<BookingTransportResult> {
      assertBookingEnabled();
      throw new BookingTransportError(
        "default booking transport is not wired in the foundation slice; " +
          "real ETG calls are added in the orchestrator slice (prompt 03)",
      );
    },
  };
}
