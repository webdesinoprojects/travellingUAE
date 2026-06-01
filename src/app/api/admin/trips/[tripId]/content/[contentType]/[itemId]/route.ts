import type { NextRequest } from "next/server";

import { revalidateTripSurfaces } from "@/server/admin/revalidation";
import {
  deleteTripContentItem,
  parseTripContentType,
  updateTripContentItem,
} from "@/server/admin/trip-content";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { verifyAdminApiAccess } from "@/server/supabase/auth";

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{ tripId: string; contentType: string; itemId: string }>;
  },
) {
  const access = await verifyAdminApiAccess(request, "editor");

  if (!access.ok) {
    return jsonError(access.status, "You are not allowed to access this area.");
  }

  try {
    const { tripId, contentType, itemId } = await context.params;
    const type = parseTripContentType(contentType);

    if (!type) {
      return jsonError(404, "The requested trip content was not found.");
    }

    const result = await updateTripContentItem(
      tripId,
      type,
      itemId,
      request,
      access.actor,
    );

    revalidateTripSurfaces();

    return jsonOk(result);
  } catch (error) {
    logServerError("api.admin.trip.content.update", error);
    return jsonError(400, "Trip content could not be updated.");
  }
}

export async function DELETE(
  request: NextRequest,
  context: {
    params: Promise<{ tripId: string; contentType: string; itemId: string }>;
  },
) {
  const access = await verifyAdminApiAccess(request, "editor");

  if (!access.ok) {
    return jsonError(access.status, "You are not allowed to access this area.");
  }

  try {
    const { tripId, contentType, itemId } = await context.params;
    const type = parseTripContentType(contentType);

    if (!type) {
      return jsonError(404, "The requested trip content was not found.");
    }

    const result = await deleteTripContentItem(
      tripId,
      type,
      itemId,
      access.actor,
    );

    revalidateTripSurfaces();

    return jsonOk(result);
  } catch (error) {
    logServerError("api.admin.trip.content.delete", error);
    return jsonError(400, "Trip content could not be removed.");
  }
}
