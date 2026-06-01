import { createClient } from "@supabase/supabase-js";
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

const EXPIRY_WINDOW_MS = 30 * 1000;

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (
    path === "/admin/login" ||
    path === "/api/admin/session" ||
    request.headers.has("authorization") ||
    request.headers.has("x-admin-preview-token")
  ) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const refreshToken = request.cookies.get(ADMIN_REFRESH_COOKIE)?.value;

  if (!refreshToken || !needsRefresh(accessToken)) {
    return NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.next();
  }

  try {
    const client = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const result = await client.auth.refreshSession({
      refresh_token: refreshToken,
    });
    const session = result.data.session;

    if (
      result.error ||
      !session?.access_token ||
      !session.refresh_token
    ) {
      const response = NextResponse.next();
      clearSessionCookies(response);
      return response;
    }

    const remembered =
      request.cookies.get(ADMIN_REMEMBER_COOKIE)?.value === "1";
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(
      "cookie",
      replaceRequestCookies(request.headers.get("cookie"), {
        [ADMIN_SESSION_COOKIE]: session.access_token,
        [ADMIN_REFRESH_COOKIE]: session.refresh_token,
      }),
    );

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    setSessionCookies(
      response,
      session.access_token,
      session.refresh_token,
      session.expires_in ?? ADMIN_ACCESS_MAX_AGE,
      remembered,
    );
    return response;
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

function needsRefresh(token?: string) {
  if (!token) {
    return true;
  }

  try {
    const payloadPart = token.split(".")[1];
    const payload = JSON.parse(
      Buffer.from(payloadPart, "base64url").toString("utf8"),
    ) as { exp?: number };

    return (
      typeof payload.exp !== "number" ||
      payload.exp * 1000 <= Date.now() + EXPIRY_WINDOW_MS
    );
  } catch {
    return true;
  }
}

function replaceRequestCookies(
  currentHeader: string | null,
  values: Record<string, string>,
) {
  const cookies = new Map<string, string>();

  for (const entry of (currentHeader ?? "").split(";")) {
    const [name, ...rawValue] = entry.trim().split("=");

    if (name) {
      cookies.set(name, rawValue.join("="));
    }
  }

  for (const [name, value] of Object.entries(values)) {
    cookies.set(name, value);
  }

  return Array.from(cookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function setSessionCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
  remembered: boolean,
) {
  const options = getAdminCookieOptions();

  response.cookies.set(ADMIN_SESSION_COOKIE, accessToken, {
    ...options,
    maxAge: Math.max(60, Math.min(expiresIn, ADMIN_ACCESS_MAX_AGE)),
  });
  response.cookies.set(ADMIN_REFRESH_COOKIE, refreshToken, {
    ...options,
    ...(remembered ? { maxAge: ADMIN_REMEMBER_MAX_AGE } : {}),
  });

  if (remembered) {
    response.cookies.set(ADMIN_REMEMBER_COOKIE, "1", {
      ...options,
      maxAge: ADMIN_REMEMBER_MAX_AGE,
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
