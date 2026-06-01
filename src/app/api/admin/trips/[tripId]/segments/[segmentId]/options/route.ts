import type { NextRequest } from "next/server";

import { createSegmentOption } from "@/server/admin/itinerary-resources";
import { revalidateTripSurfaces } from "@/server/admin/revalidation";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { verifyAdminApiAccess } from "@/server/supabase/auth";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tripId: string; segmentId: string }> },
) {
  const access = await verifyAdminApiAccess(request, "editor");

  if (!access.ok) {
    return jsonError(access.status, "You are not allowed to access this area.");
  }

  try {
    const { tripId, segmentId } = await context.params;
    const result = await createSegmentOption(
      tripId,
      segmentId,
      request,
      access.actor,
    );

    revalidateTripSurfaces();

    return jsonOk(result, { status: 201 });
  } catch (error) {
    logServerError("api.admin.itinerary.option.create", error);
    return jsonError(400, "The itinerary option could not be saved.");
  }
}
