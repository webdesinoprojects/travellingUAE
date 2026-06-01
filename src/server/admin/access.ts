import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_SESSION_COOKIE } from "@/lib/admin/session";
import {
  verifyAdminAccessToken,
  type AdminRole,
} from "@/server/supabase/auth";

export async function requireAdminPageAccess(requiredRole: AdminRole = "editor") {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!accessToken) {
    redirect("/admin/login");
  }

  const access = await verifyAdminAccessToken(accessToken, requiredRole);

  if (!access.ok) {
    redirect("/admin/login");
  }

  return access.actor;
}
