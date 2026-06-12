import "server-only";

import { GENERIC_PUBLIC_ERROR } from "@/lib/safe-error";
import {
  readDateString,
  readJsonObject,
  readNumber,
  readString,
  requireEmail,
} from "@/server/http/validation";
import {
  getSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/server/supabase/client";
import { hashSelectionSessionToken } from "@/server/itinerary/dal";

import type { MutationResult } from "@/server/mutations/newsletter";

type ResolvedTrip = {
  tripId?: string;
  destinationId?: string;
};

export async function createBooking(
  request: Request,
  optionSessionToken?: string,
): Promise<MutationResult> {
  if (!hasSupabaseAdminEnv()) {
    return {
      ok: false,
      message: GENERIC_PUBLIC_ERROR,
    };
  }

  const body = await readJsonObject(request);
  const fullName = readString(body, "fullName", {
    min: 2,
    max: 120,
    required: true,
  })!;
  const email = requireEmail(
    readString(body, "email", { max: 180, required: true }),
  );
  const phone = readString(body, "phone", {
    min: 5,
    max: 40,
    required: true,
  })!;
  const nationality = readString(body, "nationality", { max: 80 });
  const destinationSlug = readString(body, "destinationSlug", { max: 120 });
  const tripSlug = readString(body, "tripSlug", { max: 160 });
  const travelDate = readDateString(body, "travelDate");
  const travelersCount = Math.round(
    readNumber(body, "travelersCount", { min: 1, max: 50, fallback: 1 }) ?? 1,
  );
  const message = readString(body, "message", { max: 2000 });
  const supabase = getSupabaseAdminClient();
  const resolvedTrip = await resolveTrip({
    destinationSlug,
    tripSlug,
  });
  const optionSessionId = await resolveOptionSessionId({
    optionSessionToken,
    tripId: resolvedTrip.tripId,
  });
  const result = await supabase.from("bookings").insert({
    trip_id: resolvedTrip.tripId,
    destination_id: resolvedTrip.destinationId,
    customer_name: fullName,
    customer_email: email,
    customer_phone: phone,
    nationality,
    travelers_count: travelersCount,
    travel_date: travelDate,
    message,
    option_session_id: optionSessionId,
    metadata: {
      source: "website",
      destinationSlug,
      tripSlug,
    },
  });

  if (result.error) {
    throw result.error;
  }

  return {
    ok: true,
    message: "Your booking request has been received.",
  };
}

// ── Stripe payment booking helpers ──────────────────────────────────────────

/**
 * Create a booking in payment_status='pending' before a Stripe Checkout session is created.
 * Records the planned charge amount so we can verify it matches the actual Stripe charge.
 * Returns the new booking UUID.
 */
export async function createPaymentPendingBooking({
  tripId,
  destinationSlug,
  tripSlug,
  fullName,
  email,
  phone,
  nationality,
  travelersCount,
  travelDate,
  message,
  optionSessionToken,
  optionAddOnAmount,
  optionAddOnCurrency,
}: {
  tripId: string;
  destinationSlug: string;
  tripSlug: string;
  fullName: string;
  email: string;
  phone: string;
  nationality?: string | null;
  travelersCount: number;
  travelDate?: string;
  message?: string | null;
  optionSessionToken?: string;
  /** The option add-on amount being charged (delta-only, NOT the full trip price). */
  optionAddOnAmount: number;
  optionAddOnCurrency: string;
}): Promise<string> {
  const supabase = getSupabaseAdminClient();
  const optionSessionId = await resolveOptionSessionId({ optionSessionToken, tripId });

  const result = await supabase
    .from("bookings")
    .insert({
      trip_id: tripId,
      customer_name: fullName,
      customer_email: email,
      customer_phone: phone,
      nationality: nationality ?? null,
      travelers_count: travelersCount,
      travel_date: travelDate ?? null,
      message: message ?? null,
      option_session_id: optionSessionId,
      payment_status: "pending",
      metadata: {
        source: "stripe_checkout",
        // SP-1 charges only the option add-on (hotel delta), not the full trip base price.
        charge_type: "option_add_on",
        planned_charge_amount: optionAddOnAmount,
        planned_charge_currency: optionAddOnCurrency,
        destinationSlug,
        tripSlug,
      },
    })
    .select("id")
    .single();

  if (result.error) throw result.error;
  return (result.data as { id: string }).id;
}

/** After Stripe session is created, link its ID to the booking row. */
export async function linkStripeSessionToBooking({
  bookingId,
  stripeSessionId,
}: {
  bookingId: string;
  stripeSessionId: string;
}): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const result = await supabase
    .from("bookings")
    .update({ stripe_checkout_session_id: stripeSessionId })
    .eq("id", bookingId)
    .eq("payment_status", "pending");
  if (result.error) throw result.error;
}

/**
 * Cancel a pending booking that has no linked Stripe session (orphan cleanup).
 * Only applies to bookings in 'pending' state to avoid clobbering real data.
 */
export async function cancelOrphanBooking(bookingId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  // Use 'failed' to mark it as a non-chargeable dead record.
  const result = await supabase
    .from("bookings")
    .update({ payment_status: "failed" })
    .eq("id", bookingId)
    .eq("payment_status", "pending")
    .is("stripe_checkout_session_id", null);
  if (result.error) {
    // Log only - the booking being left in 'pending' is not a security issue, just DB cleanup debt.
    console.error("[bookings.cancelOrphanBooking]", result.error.message);
  }
}

/**
 * Idempotent status update by Stripe checkout session ID.
 * Guards:
 *   - 'paid' is terminal - never overwritten.
 *   - 'expired' and 'failed' only apply from 'pending' (prevent downgrading a confirmed payment).
 * Throws on DB error so the webhook caller can return 5xx and trigger Stripe retry.
 */
export async function updatePaymentStatusBySession({
  stripeSessionId,
  paymentStatus,
  stripePaymentIntentId,
  paidAmountUnits,
  paidCurrency,
}: {
  stripeSessionId: string;
  paymentStatus: "paid" | "failed" | "expired";
  stripePaymentIntentId?: string | null;
  /** Stripe amount_total (smallest units) - only set when paymentStatus='paid'. */
  paidAmountUnits?: number | null;
  paidCurrency?: string | null;
}): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const patch: Record<string, unknown> = { payment_status: paymentStatus };

  if (stripePaymentIntentId) patch.stripe_payment_intent_id = stripePaymentIntentId;

  if (paymentStatus === "paid") {
    patch.paid_at = new Date().toISOString();
    if (paidAmountUnits != null && paidCurrency) {
      // Convert from Stripe smallest units to major units for storage.
      const { fromStripeAmount } = await import("@/server/payments/stripe");
      patch.paid_amount = fromStripeAmount(paidAmountUnits, paidCurrency);
      patch.paid_currency = paidCurrency.toUpperCase();
    }
  }

  // 'paid' is terminal - never downgrade it.
  // For 'expired'/'failed', only apply from 'pending' to prevent regressing a confirmed payment.
  const query = supabase
    .from("bookings")
    .update(patch)
    .eq("stripe_checkout_session_id", stripeSessionId);

  const guardedQuery =
    paymentStatus === "paid"
      ? query.neq("payment_status", "paid") // idempotent if already paid
      : query.eq("payment_status", "pending"); // expired/failed only from pending

  const result = await guardedQuery;
  if (result.error) throw result.error;
  // 0 rows affected = already processed (idempotent success) or session not found - both fine.
}

/**
 * Idempotent status update by internal booking ID (used for payment_intent.payment_failed).
 * 'paid' is terminal and will not be overwritten.
 */
export async function updatePaymentStatusByBookingId({
  bookingId,
  paymentStatus,
}: {
  bookingId: string;
  paymentStatus: "paid" | "failed" | "expired";
}): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const result = await supabase
    .from("bookings")
    .update({ payment_status: paymentStatus })
    .eq("id", bookingId)
    .neq("payment_status", "paid"); // paid is terminal
  if (result.error) throw result.error;
}

export type SuccessPageResult =
  | { status: "pending" | "failed" | "expired" | "not_found" }
  | {
      status: "paid";
      reference: string;
      customerName: string;
      customerEmail: string;
      paidAmount: number | null;
      paidCurrency: string | null;
      travelDate: string | null;
      tripTitle: string;
    };

/**
 * Verify a Stripe session ID belongs to a booking for THIS specific trip/destination.
 * Prevents a valid Stripe session from a different trip from showing a success state.
 * Returns booking details when paid so the success page can show a proper confirmation.
 */
export async function getBookingPaymentForSuccessPage({
  stripeSessionId,
  destinationSlug,
  tripSlug,
}: {
  stripeSessionId: string;
  destinationSlug: string;
  tripSlug: string;
}): Promise<SuccessPageResult> {
  const supabase = getSupabaseAdminClient();

  // Resolve trip ID and title from slugs to gate the booking lookup.
  const tripResult = await supabase
    .from("trips")
    .select("id, title, destinations!inner(slug)")
    .eq("slug", tripSlug)
    .maybeSingle();

  if (tripResult.error) throw tripResult.error;
  if (!tripResult.data) return { status: "not_found" };

  const trip = tripResult.data as {
    id: string;
    title: string;
    destinations: { slug: string } | { slug: string }[];
  };
  const destSlug = Array.isArray(trip.destinations)
    ? trip.destinations[0]?.slug
    : trip.destinations.slug;
  if (destSlug !== destinationSlug) return { status: "not_found" };

  // Look up booking by session ID AND trip ID - both must match.
  const bookingResult = await supabase
    .from("bookings")
    .select("id, payment_status, customer_name, customer_email, paid_amount, paid_currency, travel_date")
    .eq("stripe_checkout_session_id", stripeSessionId)
    .eq("trip_id", trip.id)
    .maybeSingle();

  if (bookingResult.error) throw bookingResult.error;
  if (!bookingResult.data) return { status: "not_found" };

  const row = bookingResult.data as {
    id: string;
    payment_status: string | null;
    customer_name: string;
    customer_email: string;
    paid_amount: number | null;
    paid_currency: string | null;
    travel_date: string | null;
  };

  if (row.payment_status === "paid") {
    return {
      status: "paid",
      reference: row.id.slice(-8).toUpperCase(),
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      paidAmount: row.paid_amount,
      paidCurrency: row.paid_currency,
      travelDate: row.travel_date,
      tripTitle: trip.title,
    };
  }

  return { status: (row.payment_status as "pending" | "failed" | "expired") ?? "not_found" };
}

// ── Shared helpers ───────────────────────────────────────────────────────────

async function resolveOptionSessionId({
  optionSessionToken,
  tripId,
}: {
  optionSessionToken?: string;
  tripId?: string;
}) {
  if (!optionSessionToken || !tripId) {
    return undefined;
  }

  const supabase = getSupabaseAdminClient();
  const result = await supabase
    .from("trip_option_selection_sessions")
    .select("id")
    .eq("session_token_hash", hashSelectionSessionToken(optionSessionToken))
    .eq("trip_id", tripId)
    .eq("status", "draft")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  return (result.data as { id?: string } | null)?.id;
}

async function resolveTrip({
  destinationSlug,
  tripSlug,
}: {
  destinationSlug?: string;
  tripSlug?: string;
}): Promise<ResolvedTrip> {
  if (!destinationSlug && !tripSlug) {
    return {};
  }

  const supabase = getSupabaseAdminClient();
  const destinationResult = destinationSlug
    ? await supabase
        .from("destinations")
        .select("id")
        .eq("slug", destinationSlug)
        .maybeSingle()
    : null;

  if (destinationResult?.error) {
    throw destinationResult.error;
  }

  const destinationId = destinationResult?.data?.id as string | undefined;

  if (!tripSlug) {
    return { destinationId };
  }

  const tripQuery = supabase.from("trips").select("id,destination_id").eq("slug", tripSlug);
  const tripResult = destinationId
    ? await tripQuery.eq("destination_id", destinationId).maybeSingle()
    : await tripQuery.maybeSingle();

  if (tripResult.error) {
    throw tripResult.error;
  }

  return {
    tripId: tripResult.data?.id as string | undefined,
    destinationId:
      (tripResult.data?.destination_id as string | undefined) ?? destinationId,
  };
}
