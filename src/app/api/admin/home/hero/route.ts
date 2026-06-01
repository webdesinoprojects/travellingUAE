import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";

import { getAdminHomeHero, saveAdminHomeHero } from "@/server/admin/home-cms";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { verifyAdminApiAccess } from "@/server/supabase/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const access = await verifyAdminApiAccess(request, "editor");

    if (!access.ok) {
      return jsonError(access.status, "You are not allowed to access this area.");
    }

    return jsonOk({ hero: await getAdminHomeHero() });
  } catch (error) {
    logServerError("api.admin.home.hero.read", error);
    return jsonError(500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const access = await verifyAdminApiAccess(request, "editor");

    if (!access.ok) {
      return jsonError(access.status, "You are not allowed to access this area.");
    }

    const hero = await saveAdminHomeHero(request, access.actor);

    revalidatePath("/");
    revalidatePath("/admin/home");

    return jsonOk({ hero });
  } catch (error) {
    logServerError("api.admin.home.hero.update", error);
    return jsonError(400, "The homepage hero could not be saved.");
  }
}
