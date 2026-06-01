import type { NextRequest } from "next/server";

import {
  archiveAdminNavigationContent,
  updateAdminNavigationContent,
  type NavigationContentEntity,
} from "@/server/admin/navigation-content";
import { revalidateNavigationSurfaces } from "@/server/admin/revalidation";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { verifyAdminApiAccess } from "@/server/supabase/auth";

export const dynamic = "force-dynamic";

const entities = new Set<NavigationContentEntity>([
  "header-items",
  "footer-columns",
  "footer-links",
]);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ entity: string; id: string }> },
) {
  try {
    const { entity, id } = await context.params;

    if (!entities.has(entity as NavigationContentEntity)) {
      return jsonError(404, "The requested navigation content type was not found.");
    }

    const access = await verifyAdminApiAccess(request, "editor");

    if (!access.ok) {
      return jsonError(access.status, "You are not allowed to access this area.");
    }

    const content = await updateAdminNavigationContent(
      entity as NavigationContentEntity,
      id,
      request,
      access.actor,
    );
    revalidateNavigationSurfaces();

    return jsonOk({ content });
  } catch (error) {
    logServerError("api.admin.navigation.content.update", error);
    return jsonError(400, "The navigation content could not be updated.");
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ entity: string; id: string }> },
) {
  try {
    const { entity, id } = await context.params;

    if (!entities.has(entity as NavigationContentEntity)) {
      return jsonError(404, "The requested navigation content type was not found.");
    }

    const access = await verifyAdminApiAccess(request, "editor");

    if (!access.ok) {
      return jsonError(access.status, "You are not allowed to access this area.");
    }

    const content = await archiveAdminNavigationContent(
      entity as NavigationContentEntity,
      id,
      access.actor,
    );
    revalidateNavigationSurfaces();

    return jsonOk({ content });
  } catch (error) {
    logServerError("api.admin.navigation.content.archive", error);
    return jsonError(400, "The navigation content could not be archived.");
  }
}
