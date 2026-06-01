import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";

import {
  getAdminFooterSettings,
  saveAdminFooterSettings,
} from "@/server/admin/footer-settings";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { verifyAdminApiAccess } from "@/server/supabase/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const access = await verifyAdminApiAccess(request, "editor");

    if (!access.ok) {
      return jsonError(access.status, "You are not allowed to access this area.");
    }

    return jsonOk({ footer: await getAdminFooterSettings() });
  } catch (error) {
    logServerError("api.admin.home.footer.read", error);
    return jsonError(500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const access = await verifyAdminApiAccess(request, "editor");

    if (!access.ok) {
      return jsonError(access.status, "You are not allowed to access this area.");
    }

    const footer = await saveAdminFooterSettings(request, access.actor);

    revalidatePath("/");
    revalidatePath("/admin/home");

    return jsonOk({ footer });
  } catch (error) {
    logServerError("api.admin.home.footer.update", error);
    return jsonError(400, "The footer settings could not be saved.");
  }
}
