import type { NextRequest } from "next/server";

import {
  deleteItinerarySegment,
  updateItinerarySegment,
} from "@/server/admin/itinerary-resources";
import { revalidateTripSurfaces } from "@/server/admin/revalidation";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { verifyAdminApiAccess } from "@/server/supabase/auth";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ tripId: string; segmentId: string }> },
) {
  const access = await verifyAdminApiAccess(request, "editor");

  if (!access.ok) {
    return jsonError(access.status, "You are not allowed to access this area.");
  }

  try {
    const { tripId, segmentId } = await context.params;
    const result = await updateItinerarySegment(
      tripId,
      segmentId,
      request,
      access.actor,
    );

    revalidateTripSurfaces();

    return jsonOk(result);
  } catch (error) {
    logServerError("api.admin.itinerary.segment.update", error);
    return jsonError(400, "The itinerary segment could not be updated.");
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ tripId: string; segmentId: string }> },
) {
  const access = await verifyAdminApiAccess(request, "editor");

  if (!access.ok) {
    return jsonError(access.status, "You are not allowed to access this area.");
  }

  try {
    const { tripId, segmentId } = await context.params;
    const result = await deleteItinerarySegment(tripId, segmentId, access.actor);

    revalidateTripSurfaces();

    return jsonOk(result);
  } catch (error) {
    logServerError("api.admin.itinerary.segment.delete", error);
    return jsonError(400, "The itinerary segment could not be removed.");
  }
}
