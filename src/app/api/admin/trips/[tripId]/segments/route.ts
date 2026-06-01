import type { NextRequest } from "next/server";

import { createItinerarySegment } from "@/server/admin/itinerary-resources";
import { revalidateTripSurfaces } from "@/server/admin/revalidation";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { verifyAdminApiAccess } from "@/server/supabase/auth";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tripId: string }> },
) {
  const access = await verifyAdminApiAccess(request, "editor");

  if (!access.ok) {
    return jsonError(access.status, "You are not allowed to access this area.");
  }

  try {
    const { tripId } = await context.params;
    const result = await createItinerarySegment(tripId, request, access.actor);

    revalidateTripSurfaces();

    return jsonOk(result, { status: 201 });
  } catch (error) {
    logServerError("api.admin.itinerary.segment.create", error);
    return jsonError(400, "The itinerary segment could not be saved.");
  }
}
