import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

import {
  deleteSegmentOption,
  updateSegmentOption,
} from "@/server/admin/itinerary-resources";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { verifyAdminApiAccess } from "@/server/supabase/auth";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ tripId: string; segmentId: string; optionId: string }> },
) {
  const access = await verifyAdminApiAccess(request, "editor");

  if (!access.ok) {
    return jsonError(access.status, "You are not allowed to access this area.");
  }

  try {
    const { tripId, segmentId, optionId } = await context.params;
    const result = await updateSegmentOption({
      tripId,
      segmentId,
      optionId,
      optionType: request.nextUrl.searchParams.get("type"),
      request,
      actor: access.actor,
    });

    revalidatePath("/admin/trips");
    revalidatePath("/trips");

    return jsonOk(result);
  } catch (error) {
    logServerError("api.admin.itinerary.option.update", error);
    return jsonError(400, "The itinerary option could not be updated.");
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ tripId: string; segmentId: string; optionId: string }> },
) {
  const access = await verifyAdminApiAccess(request, "editor");

  if (!access.ok) {
    return jsonError(access.status, "You are not allowed to access this area.");
  }

  try {
    const { tripId, segmentId, optionId } = await context.params;
    const result = await deleteSegmentOption({
      tripId,
      segmentId,
      optionId,
      optionType: request.nextUrl.searchParams.get("type"),
      actor: access.actor,
    });

    revalidatePath("/admin/trips");
    revalidatePath("/trips");

    return jsonOk(result);
  } catch (error) {
    logServerError("api.admin.itinerary.option.delete", error);
    return jsonError(400, "The itinerary option could not be removed.");
  }
}
