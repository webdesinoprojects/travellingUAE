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
