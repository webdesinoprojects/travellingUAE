import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";

import {
  createAdminHomeContent,
  type HomeContentEntity,
} from "@/server/admin/home-content";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { verifyAdminApiAccess } from "@/server/supabase/auth";

export const dynamic = "force-dynamic";

const creatableEntities = new Set<HomeContentEntity>([
  "collections",
  "items",
  "services",
  "testimonials",
]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ entity: string }> },
) {
  try {
    const { entity } = await context.params;

    if (!creatableEntities.has(entity as HomeContentEntity)) {
      return jsonError(404, "The requested homepage content type was not found.");
    }

    const access = await verifyAdminApiAccess(request, "editor");

    if (!access.ok) {
      return jsonError(access.status, "You are not allowed to access this area.");
    }

    const content = await createAdminHomeContent(
      entity as HomeContentEntity,
      request,
      access.actor,
    );

    revalidateHomeContent();

    return jsonOk({ content }, { status: 201 });
  } catch (error) {
    logServerError("api.admin.home.content.create", error);
    return jsonError(400, "The homepage content could not be created.");
  }
}

function revalidateHomeContent() {
  revalidatePath("/");
  revalidatePath("/admin/home");
}
