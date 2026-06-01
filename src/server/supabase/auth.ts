import "server-only";

import type { NextRequest } from "next/server";

import { ADMIN_SESSION_COOKIE } from "@/lib/admin/session";
import { logServerError } from "@/server/http/response";
import {
  createSupabasePublicAuthClient,
  getSupabaseAdminClient,
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

export { ADMIN_SESSION_COOKIE };

export type RefreshedAdminSession =
  | {
      ok: true;
      actor: AdminActor;
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    }
  | { ok: false; status: 401 | 403 };

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
    const publicClient = createSupabasePublicAuthClient();
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

export async function refreshAdminAccessSession(
  refreshToken: string,
  requiredRole: AdminRole = "editor",
): Promise<RefreshedAdminSession> {
  if (!hasSupabasePublicEnv() || !hasSupabaseAdminEnv()) {
    return { ok: false, status: 403 };
  }

  try {
    const result = await createSupabasePublicAuthClient().auth.refreshSession({
      refresh_token: refreshToken,
    });
    const session = result.data.session;

    if (
      result.error ||
      !session?.access_token ||
      !session.refresh_token
    ) {
      return { ok: false, status: 401 };
    }

    const access = await verifyAdminAccessToken(
      session.access_token,
      requiredRole,
    );

    if (!access.ok) {
      return access;
    }

    return {
      ok: true,
      actor: access.actor,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in ?? 60 * 60,
    };
  } catch (error) {
    logServerError("admin.auth.refresh", error);
    return { ok: false, status: 401 };
  }
}

function readBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization");

  if (!header?.startsWith("Bearer ")) {
    return undefined;
  }

  return header.slice("Bearer ".length).trim() || undefined;
}
