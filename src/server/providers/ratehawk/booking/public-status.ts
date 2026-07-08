/**
 * Safe public-facing provider booking status DTO.
 *
 * Maps internal provider_order_status values to user-safe labels.
 * Exposes NO ETG IDs, order numbers, hashes, provider error codes, or raw
 * provider status values. Only the Fly Time booking reference, a generic
 * state, a next-action hint, and a human-readable message.
 */

export type ProviderBookingPublicState =
  | "pending"
  | "in_progress"
  | "confirmed"
  | "failed"
  | "cancelled"
  | "review";

export type ProviderBookingNextAction =
  | "wait"
  | "complete_3ds"
  | "contact_support"
  | null;

export type ProviderBookingPublicStatus = {
  /** Last 8 chars of the booking UUID, uppercased. Safe to show to users. */
  flyTimeReference: string;
  providerState: ProviderBookingPublicState;
  nextAction: ProviderBookingNextAction;
  message: string;
};

const STATE_MESSAGES: Record<ProviderBookingPublicState, string> = {
  pending: "Your booking is being prepared.",
  in_progress: "Your booking is being processed. This may take a few minutes.",
  confirmed: "Your hotel booking is confirmed.",
  failed: "We were unable to complete your hotel booking. Our team will contact you.",
  cancelled: "Your hotel booking has been cancelled.",
  review: "Your booking requires manual review. Our team will contact you shortly.",
};

export function toProviderBookingPublicStatus(input: {
  bookingId: string;
  providerOrderStatus: string | null;
}): ProviderBookingPublicStatus {
  const flyTimeReference = input.bookingId.slice(-8).toUpperCase();
  const { providerState, nextAction } = mapState(input.providerOrderStatus);

  return {
    flyTimeReference,
    providerState,
    nextAction,
    message: STATE_MESSAGES[providerState],
  };
}

function mapState(raw: string | null): {
  providerState: ProviderBookingPublicState;
  nextAction: ProviderBookingNextAction;
} {
  switch (raw) {
    case null:
    case undefined:
    case "pending":
      return { providerState: "pending", nextAction: "wait" };

    case "creating":
    case "starting":
    case "processing":
      return { providerState: "in_progress", nextAction: "wait" };

    case "requires_3ds":
      return { providerState: "in_progress", nextAction: "complete_3ds" };

    case "confirmed":
      return { providerState: "confirmed", nextAction: null };

    case "failed":
      return { providerState: "failed", nextAction: "contact_support" };

    case "cancel_pending":
    case "cancelled":
      return { providerState: "cancelled", nextAction: null };

    case "pending_review":
      return { providerState: "review", nextAction: "contact_support" };

    default:
      return { providerState: "review", nextAction: "contact_support" };
  }
}
