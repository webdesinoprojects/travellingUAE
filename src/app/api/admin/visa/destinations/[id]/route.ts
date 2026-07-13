import type { NextRequest } from "next/server";

import { writeAdminAuditLog } from "@/server/admin/audit";
import {
  setVisaDestinationPublished,
  updateVisaDestination,
  VisaCmsError,
} from "@/server/admin/visa-cms";
import { revalidateVisaPublicPaths } from "@/server/admin/visa-revalidate";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { readJsonObject } from "@/server/http/validation";
import { verifyAdminApiAccess } from "@/server/supabase/auth";

export const dynamic = "force-dynamic";

/**
 * PATCH: update a visa destination, or toggle publish.
 * - { action: "setPublished", isPublished } -> publish/unpublish only
 * - otherwise -> full update from the body
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const access = await verifyAdminApiAccess(request, "editor");
    if (!access.ok) return jsonError(access.status, "You are not allowed to access this area.");

    const { id } = await context.params;
    const body = await readJsonObject(request);

    if (body.action === "setPublished") {
      const isPublished = body.isPublished === true;
      await setVisaDestinationPublished(id, isPublished);
      revalidateVisaPublicPaths();
      await writeAdminAuditLog({
        actor: access.actor,
        action: "visa.destination.publish",
        table: "visa_destinations",
        entityId: id,
        before: null,
        after: { is_published: isPublished },
      });
      return jsonOk({ id, isPublished });
    }

    await updateVisaDestination(id, body as never);
    revalidateVisaPublicPaths();
    await writeAdminAuditLog({
      actor: access.actor,
      action: "visa.destination.update",
      table: "visa_destinations",
      entityId: id,
      before: null,
      after: { category: body.category, slug: body.slug },
    });
    return jsonOk({ id });
  } catch (error) {
    if (error instanceof VisaCmsError) {
      return jsonError(error.status as 400 | 404 | 409, error.message);
    }
    logServerError("api.admin.visa.destinations.update", error);
    return jsonError(400, "The visa destination could not be saved.");
  }
}
