import type { NextRequest } from "next/server";

import {
  createAdminNavigationContent,
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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ entity: string }> },
) {
  try {
    const { entity } = await context.params;

    if (!entities.has(entity as NavigationContentEntity)) {
      return jsonError(404, "The requested navigation content type was not found.");
    }

    const access = await verifyAdminApiAccess(request, "editor");

    if (!access.ok) {
      return jsonError(access.status, "You are not allowed to access this area.");
    }

    const content = await createAdminNavigationContent(
      entity as NavigationContentEntity,
      request,
      access.actor,
    );
    revalidateNavigationSurfaces();

    return jsonOk({ content }, { status: 201 });
  } catch (error) {
    logServerError("api.admin.navigation.content.create", error);
    return jsonError(400, "The navigation content could not be created.");
  }
}
