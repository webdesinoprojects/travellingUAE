import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  ADMIN_ACCESS_MAX_AGE,
  ADMIN_REFRESH_COOKIE,
  ADMIN_REMEMBER_COOKIE,
  ADMIN_REMEMBER_MAX_AGE,
  ADMIN_SESSION_COOKIE,
  getAdminCookieOptions,
} from "@/lib/admin/session";
import { jsonError, logServerError } from "@/server/http/response";
import {
  readJsonObject,
  readString,
  requireEmail,
} from "@/server/http/validation";
import {
  refreshAdminAccessSession,
  verifyAdminAccessToken,
  verifyAdminApiAccess,
} from "@/server/supabase/auth";
import {
  createSupabasePublicAuthClient,
  hasSupabaseAdminEnv,
  hasSupabasePublicEnv,
} from "@/server/supabase/client";

export async function GET(request: NextRequest) {
  const access = await verifyAdminApiAccess(request, "editor");

  if (!access.ok) {
    return jsonError(access.status, "Admin access could not be verified.");
  }

  return sessionResponse(access.actor.role, access.actor.fullName);
}

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    const email = requireEmail(
      readString(body, "email", { required: true, min: 3, max: 254 }),
    );
    const password = readPassword(body.password);
    const rememberMe = body.rememberMe === true;

    if (!hasSupabasePublicEnv() || !hasSupabaseAdminEnv()) {
      return jsonError(503, "Admin access is temporarily unavailable.");
    }

    const signInResult =
      await createSupabasePublicAuthClient().auth.signInWithPassword({
        email,
        password,
      });
    const session = signInResult.data.session;

    if (
      signInResult.error ||
      !session?.access_token ||
      !session.refresh_token
    ) {
      return jsonError(401, "Admin access could not be verified.");
    }

    const access = await verifyAdminAccessToken(session.access_token, "editor");

    if (!access.ok) {
      return jsonError(access.status, "Admin access could not be verified.");
    }

    const response = sessionResponse(access.actor.role, access.actor.fullName);
    setSessionCookies(
      response,
      session.access_token,
      session.refresh_token,
      session.expires_in ?? ADMIN_ACCESS_MAX_AGE,
      rememberMe,
    );
    return response;
  } catch (error) {
    logServerError("api.admin.session.create", error);
    return jsonError(400, "The admin session could not be started.");
  }
}

export async function PUT(request: NextRequest) {
  const refreshToken = request.cookies.get(ADMIN_REFRESH_COOKIE)?.value;

  if (!refreshToken) {
    return jsonError(401, "Admin access could not be verified.");
  }

  const refreshed = await refreshAdminAccessSession(refreshToken, "editor");

  if (!refreshed.ok) {
    const response = jsonError(
      refreshed.status,
      "Admin access could not be verified.",
    );
    clearSessionCookies(response);
    return response;
  }

  const rememberMe =
    request.cookies.get(ADMIN_REMEMBER_COOKIE)?.value === "1";
  const response = sessionResponse(
    refreshed.actor.role,
    refreshed.actor.fullName,
  );
  setSessionCookies(
    response,
    refreshed.accessToken,
    refreshed.refreshToken,
    refreshed.expiresIn,
    rememberMe,
  );
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({
    ok: true,
    data: { signedOut: true },
  });

  clearSessionCookies(response);
  return response;
}

function sessionResponse(role: string, name?: string) {
  return NextResponse.json({
    ok: true,
    data: {
      role,
      name: name ?? "Admin",
    },
  });
}

function setSessionCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
  rememberMe: boolean,
) {
  const options = getAdminCookieOptions();

  response.cookies.set(ADMIN_SESSION_COOKIE, accessToken, {
    ...options,
    maxAge: Math.max(60, Math.min(expiresIn, ADMIN_ACCESS_MAX_AGE)),
  });
  response.cookies.set(ADMIN_REFRESH_COOKIE, refreshToken, {
    ...options,
    ...(rememberMe ? { maxAge: ADMIN_REMEMBER_MAX_AGE } : {}),
  });

  if (rememberMe) {
    response.cookies.set(ADMIN_REMEMBER_COOKIE, "1", {
      ...options,
      maxAge: ADMIN_REMEMBER_MAX_AGE,
    });
  } else {
    response.cookies.set(ADMIN_REMEMBER_COOKIE, "", {
      ...options,
      maxAge: 0,
    });
  }
}

function clearSessionCookies(response: NextResponse) {
  const options = getAdminCookieOptions();

  for (const cookie of [
    ADMIN_SESSION_COOKIE,
    ADMIN_REFRESH_COOKIE,
    ADMIN_REMEMBER_COOKIE,
  ]) {
    response.cookies.set(cookie, "", {
      ...options,
      maxAge: 0,
    });
  }
}

function readPassword(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length < 8 ||
    value.length > 1000
  ) {
    throw new Error("password is invalid");
  }

  return value;
}
