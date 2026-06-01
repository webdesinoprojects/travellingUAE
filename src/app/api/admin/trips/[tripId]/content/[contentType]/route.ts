import type { NextRequest } from "next/server";

import { revalidateTripSurfaces } from "@/server/admin/revalidation";
import {
  createTripContentItem,
  listTripContentItems,
  parseTripContentType,
} from "@/server/admin/trip-content";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { verifyAdminApiAccess } from "@/server/supabase/auth";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tripId: string; contentType: string }> },
) {
  const access = await verifyAdminApiAccess(request, "editor");

  if (!access.ok) {
    return jsonError(access.status, "You are not allowed to access this area.");
  }

  try {
    const { tripId, contentType } = await context.params;
    const type = parseTripContentType(contentType);

    if (!type) {
      return jsonError(404, "The requested trip content was not found.");
    }

    return jsonOk({ items: await listTripContentItems(tripId, type) });
  } catch (error) {
    logServerError("api.admin.trip.content.read", error);
    return jsonError(400, "Trip content could not be loaded.");
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tripId: string; contentType: string }> },
) {
  const access = await verifyAdminApiAccess(request, "editor");

  if (!access.ok) {
    return jsonError(access.status, "You are not allowed to access this area.");
  }

  try {
    const { tripId, contentType } = await context.params;
    const type = parseTripContentType(contentType);

    if (!type) {
      return jsonError(404, "The requested trip content was not found.");
    }

    const result = await createTripContentItem(tripId, type, request, access.actor);

    revalidateTripSurfaces();

    return jsonOk(result, { status: 201 });
  } catch (error) {
    logServerError("api.admin.trip.content.create", error);
    return jsonError(400, "Trip content could not be saved.");
  }
}
