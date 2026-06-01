import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

import { getAdminResourceDTO, isAdminResource } from "@/server/admin/dal";
import {
  revalidateCmsPageSurfaces,
  revalidateNavigationSurfaces,
  revalidateTranslationSurfaces,
  revalidateTripSurfaces,
} from "@/server/admin/revalidation";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { verifyAdminApiAccess } from "@/server/supabase/auth";
import {
  createAdminResource,
  getCrudDefinition,
} from "@/server/admin/resources";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ resource: string }> },
) {
  try {
    const { resource } = await context.params;

    if (!isAdminResource(resource)) {
      return jsonError(404, "The requested admin module was not found.");
    }

    const definition = getCrudDefinition(resource);
    const requiredRole =
      definition?.requiredRole ??
      (resource === "audit-log" || resource === "settings" ? "admin" : "editor");
    const access = await verifyAdminApiAccess(request, requiredRole);

    if (!access.ok) {
      return jsonError(access.status, "You are not allowed to access this area.");
    }

    const url = new URL(request.url);
    const params = {
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.has("limit")
        ? Number(url.searchParams.get("limit"))
        : undefined,
    };

    return jsonOk(await getAdminResourceDTO(resource, params));
  } catch (error) {
    logServerError("api.admin.resource", error);
    return jsonError(500);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ resource: string }> },
) {
  try {
    const { resource } = await context.params;

    if (!isAdminResource(resource)) {
      return jsonError(404, "The requested admin module was not found.");
    }

    const definition = getCrudDefinition(resource);

    if (!definition?.create) {
      return jsonError(405, "This admin module is read only.");
    }

    const access = await verifyAdminApiAccess(request, definition.requiredRole);

    if (!access.ok) {
      return jsonError(access.status, "You are not allowed to access this area.");
    }

    const result = await createAdminResource(resource, request, access.actor);

    revalidateAdminResource(resource);

    return jsonOk(result, { status: 201 });
  } catch (error) {
    logServerError("api.admin.resource.create", error);
    return jsonError(400, "The record could not be saved.");
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
