import "server-only";

import type { NextRequest } from "next/server";

import { logServerError } from "@/server/http/response";
import {
  getSupabaseAdminClient,
  getSupabasePublicServerClient,
  hasSupabaseAdminEnv,
  hasSupabasePublicEnv,
} from "@/server/supabase/client";

export type AdminRole = "admin" | "editor";

export type AdminActor = {
  id?: string;
  email?: string;
  fullName?: string;
  role: AdminRole;
  mode: "preview-token" | "supabase-auth";
};

export type AdminAccess =
  | { ok: true; actor: AdminActor }
  | { ok: false; status: 401 | 403 };

export const ADMIN_SESSION_COOKIE = "flytime-admin-access";

export async function verifyAdminApiAccess(
  request: NextRequest,
  requiredRole: AdminRole = "editor",
): Promise<AdminAccess> {
  const previewToken = process.env.ADMIN_PREVIEW_TOKEN;

  if (
    previewToken &&
    request.headers.get("x-admin-preview-token") === previewToken
  ) {
    return {
      ok: true,
      actor: {
        role: "admin",
        mode: "preview-token",
      },
    };
  }

  const bearerToken = readBearerToken(request);
  const cookieToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const accessToken = bearerToken ?? cookieToken;

  if (!accessToken) {
    return { ok: false, status: 401 };
  }

  return verifyAdminAccessToken(accessToken, requiredRole);
}

export async function verifyAdminAccessToken(
  accessToken: string,
  requiredRole: AdminRole = "editor",
): Promise<AdminAccess> {
  if (!hasSupabasePublicEnv() || !hasSupabaseAdminEnv()) {
    return { ok: false, status: 403 };
  }

  try {
    const publicClient = getSupabasePublicServerClient();
    const userResult = await publicClient.auth.getUser(accessToken);
    const user = userResult.data.user;

    if (userResult.error || !user) {
      return { ok: false, status: 401 };
    }

    const profileResult = await getSupabaseAdminClient()
      .from("profiles")
      .select("id,email,full_name,role,is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileResult.error) {
      throw profileResult.error;
    }

    const profile = profileResult.data as
      | {
          id: string;
          email: string | null;
          full_name: string | null;
          role: AdminRole | null;
          is_active: boolean | null;
        }
      | null;

    if (!profile?.is_active || !profile.role) {
      return { ok: false, status: 403 };
    }

    if (requiredRole === "admin" && profile.role !== "admin") {
      return { ok: false, status: 403 };
    }

    return {
      ok: true,
      actor: {
        id: profile.id,
        email: profile.email ?? user.email,
        fullName: profile.full_name ?? undefined,
        role: profile.role,
        mode: "supabase-auth",
      },
    };
  } catch (error) {
    logServerError("admin.auth", error);
    return { ok: false, status: 403 };
  }
}

function readBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization");

  if (!header?.startsWith("Bearer ")) {
    return undefined;
  }

  return header.slice("Bearer ".length).trim() || undefined;
}
