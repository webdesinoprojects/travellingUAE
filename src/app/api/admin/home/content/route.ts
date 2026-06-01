import type { NextRequest } from "next/server";

import { getAdminHomeContent } from "@/server/admin/home-content";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { verifyAdminApiAccess } from "@/server/supabase/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const access = await verifyAdminApiAccess(request, "editor");

    if (!access.ok) {
      return jsonError(access.status, "You are not allowed to access this area.");
    }

    return jsonOk({ content: await getAdminHomeContent() });
  } catch (error) {
    logServerError("api.admin.home.content.read", error);
    return jsonError(500);
  }
}
