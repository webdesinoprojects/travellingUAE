import type { NextRequest } from "next/server";

import { getAdminDashboardDTO } from "@/server/admin/dal";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { verifyAdminApiAccess } from "@/server/supabase/auth";

export async function GET(request: NextRequest) {
  const access = await verifyAdminApiAccess(request);

  if (!access.ok) {
    return jsonError(access.status, "You are not allowed to access this area.");
  }

  try {
    return jsonOk(await getAdminDashboardDTO());
  } catch (error) {
    logServerError("api.admin.dashboard", error);
    return jsonError(500);
  }
}
