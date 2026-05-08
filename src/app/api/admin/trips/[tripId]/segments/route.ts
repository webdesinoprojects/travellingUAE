import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

import { createItinerarySegment } from "@/server/admin/itinerary-resources";
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

    revalidatePath("/admin/trips");
    revalidatePath("/trips");

    return jsonOk(result, { status: 201 });
  } catch (error) {
    logServerError("api.admin.itinerary.segment.create", error);
    return jsonError(400, "The itinerary segment could not be saved.");
  }
}
