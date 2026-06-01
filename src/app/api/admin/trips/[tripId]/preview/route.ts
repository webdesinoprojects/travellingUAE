import type { NextRequest } from "next/server";

import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { verifyAdminApiAccess } from "@/server/supabase/auth";
import { getAdminTripPreview } from "@/server/admin/trip-preview";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tripId: string }> },
) {
  try {
    const { tripId } = await context.params;

    if (!UUID_RE.test(tripId)) {
      return jsonError(404, "Trip preview is not available.");
    }

    const access = await verifyAdminApiAccess(request, "editor");

    if (!access.ok) {
      return jsonError(access.status, "You are not allowed to access this area.");
    }

    const preview = await getAdminTripPreview(tripId);

    if (!preview) {
      return jsonError(404, "Trip preview is not available.");
    }

    return jsonOk({
      status: preview.status,
      pkg: {
        slug: preview.pkg.slug,
        title: preview.pkg.title,
        overview: preview.pkg.overview,
        priceAmount: preview.pkg.priceAmount,
        durationDays: preview.pkg.durationDays,
        hasFlights: preview.pkg.hasFlights,
        hotelStar: preview.pkg.hotelStar,
        highlightCount: preview.pkg.highlights.length,
        inclusionCount: preview.pkg.inclusions.length,
        galleryCount: preview.pkg.gallery.length,
      },
      destination: {
        slug: preview.destination.slug,
        name: preview.destination.name,
      },
    });
  } catch (error) {
    logServerError("api.admin.trip.preview", error);
    return jsonError(400, "The trip preview could not be loaded.");
  }
}
