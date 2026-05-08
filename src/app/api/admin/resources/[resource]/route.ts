import type { NextRequest } from "next/server";

import { getAdminResourceDTO, isAdminResource } from "@/server/admin/dal";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { verifyAdminApiAccess } from "@/server/supabase/auth";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ resource: string }> },
) {
  const access = verifyAdminApiAccess(request);

  if (!access.ok) {
    return jsonError(access.status, "You are not allowed to access this area.");
  }

  try {
    const { resource } = await context.params;

    if (!isAdminResource(resource)) {
      return jsonError(404, "The requested admin module was not found.");
    }

    return jsonOk(await getAdminResourceDTO(resource));
  } catch (error) {
    logServerError("api.admin.resource", error);
    return jsonError(500);
  }
}

