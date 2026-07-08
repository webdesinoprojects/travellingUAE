import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";

import {
  getAdminHajjUmrahPageContent,
  saveAdminHajjUmrahPageContent,
} from "@/server/admin/hajj-umrah-page";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { verifyAdminApiAccess } from "@/server/supabase/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const access = await verifyAdminApiAccess(request, "editor");

    if (!access.ok) {
      return jsonError(access.status, "You are not allowed to access this area.");
    }

    return jsonOk({ content: await getAdminHajjUmrahPageContent() });
  } catch (error) {
    logServerError("api.admin.hajj-umrah.content.read", error);
    return jsonError(500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const access = await verifyAdminApiAccess(request, "editor");

    if (!access.ok) {
      return jsonError(access.status, "You are not allowed to access this area.");
    }

    const content = await saveAdminHajjUmrahPageContent(request, access.actor);

    revalidatePath("/hajj-umrah");
    revalidatePath("/admin/hajj-umrah");

    return jsonOk({ content });
  } catch (error) {
    logServerError("api.admin.hajj-umrah.content.update", error);
    return jsonError(400, "The Hajj & Umrah page content could not be saved.");
  }
}
