import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

import { isAdminResource } from "@/server/admin/dal";
import {
  revalidateCmsPageSurfaces,
  revalidateNavigationSurfaces,
  revalidateTranslationSurfaces,
  revalidateTripSurfaces,
} from "@/server/admin/revalidation";
import {
  deleteAdminResource,
  getCrudDefinition,
  updateAdminResource,
} from "@/server/admin/resources";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { verifyAdminApiAccess } from "@/server/supabase/auth";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ resource: string; id: string }> },
) {
  try {
    const { resource, id } = await context.params;

    if (!isAdminResource(resource)) {
      return jsonError(404, "The requested admin module was not found.");
    }

    const definition = getCrudDefinition(resource);

    if (!definition?.update) {
      return jsonError(405, "This admin module is read only.");
    }

    const access = await verifyAdminApiAccess(request, definition.requiredRole);

    if (!access.ok) {
      return jsonError(access.status, "You are not allowed to access this area.");
    }

    const result = await updateAdminResource(resource, id, request, access.actor);

    revalidateAdminResource(resource);

    return jsonOk(result);
  } catch (error) {
    logServerError("api.admin.resource.update", error);
    return jsonError(400, "The record could not be updated.");
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ resource: string; id: string }> },
) {
  try {
    const { resource, id } = await context.params;

    if (!isAdminResource(resource)) {
      return jsonError(404, "The requested admin module was not found.");
    }

    const definition = getCrudDefinition(resource);

    if (!definition?.remove) {
      return jsonError(405, "This admin module cannot be deleted.");
    }

    const access = await verifyAdminApiAccess(request, definition.requiredRole);

    if (!access.ok) {
      return jsonError(access.status, "You are not allowed to access this area.");
    }

    const result = await deleteAdminResource(resource, id, access.actor);

    revalidateAdminResource(resource);

    return jsonOk(result);
  } catch (error) {
    logServerError("api.admin.resource.delete", error);
    return jsonError(400, "The record could not be removed.");
  }
}

function revalidateAdminResource(resource: string) {
  revalidatePath("/admin");
  revalidatePath(`/admin/${resource}`);

  if (resource === "destinations" || resource === "trips") {
    revalidateTripSurfaces();
  }

  if (resource === "navigation") {
    revalidateNavigationSurfaces();
  }

  if (resource === "pages") {
    revalidateCmsPageSurfaces();
  }

  if (resource === "translations") {
    revalidateTranslationSurfaces();
  }
}
