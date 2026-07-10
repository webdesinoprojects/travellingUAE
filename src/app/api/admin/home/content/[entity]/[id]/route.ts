import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";

import {
  archiveAdminHomeContent,
  updateAdminHomeContent,
  type HomeContentEntity,
} from "@/server/admin/home-content";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { verifyAdminApiAccess } from "@/server/supabase/auth";

export const dynamic = "force-dynamic";

const mutableEntities = new Set<HomeContentEntity>([
  "sections",
  "collections",
  "items",
  "services",
  "testimonials",
]);
const archivableEntities = new Set<HomeContentEntity>([
  "collections",
  "items",
  "services",
  "testimonials",
]);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ entity: string; id: string }> },
) {
  try {
    const { entity, id } = await context.params;

    if (!mutableEntities.has(entity as HomeContentEntity)) {
      return jsonError(404, "The requested homepage content type was not found.");
    }

    const access = await verifyAdminApiAccess(request, "editor");

    if (!access.ok) {
      return jsonError(access.status, "You are not allowed to access this area.");
    }

    const content = await updateAdminHomeContent(
      entity as HomeContentEntity,
      id,
      request,
      access.actor,
    );

    revalidateHomeContent();

    return jsonOk({ content });
  } catch (error) {
    logServerError("api.admin.home.content.update", error);
    return jsonError(400, "The homepage content could not be updated.");
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ entity: string; id: string }> },
) {
  try {
    const { entity, id } = await context.params;

    if (!archivableEntities.has(entity as HomeContentEntity)) {
      return jsonError(404, "The requested homepage content type was not found.");
    }

    const access = await verifyAdminApiAccess(request, "editor");

    if (!access.ok) {
      return jsonError(access.status, "You are not allowed to access this area.");
    }

    const content = await archiveAdminHomeContent(
      entity as HomeContentEntity,
      id,
      access.actor,
    );

    revalidateHomeContent();

    return jsonOk({ content });
  } catch (error) {
    logServerError("api.admin.home.content.archive", error);
    return jsonError(400, "The homepage content could not be archived.");
  }
}

function revalidateHomeContent() {
  revalidatePath("/");
  revalidatePath("/admin/home");
}
