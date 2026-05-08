import { NextResponse } from "next/server";

import { readJsonObject, readString } from "@/server/http/validation";
import { jsonError, logServerError } from "@/server/http/response";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminAccessToken,
} from "@/server/supabase/auth";

const ADMIN_COOKIE_MAX_AGE = 60 * 60;

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    const accessToken = readString(body, "accessToken", {
      required: true,
      min: 20,
      max: 6000,
    })!;
    const access = await verifyAdminAccessToken(accessToken, "editor");

    if (!access.ok) {
      return jsonError(access.status, "You are not allowed to access this area.");
    }

    const response = NextResponse.json({
      ok: true,
      data: {
        role: access.actor.role,
        name: access.actor.fullName ?? "Admin",
      },
    });

    response.cookies.set(ADMIN_SESSION_COOKIE, accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: ADMIN_COOKIE_MAX_AGE,
      path: "/",
    });

    return response;
  } catch (error) {
    logServerError("api.admin.session.create", error);
    return jsonError(400, "The admin session could not be started.");
  }
}

export async function DELETE() {
  const response = NextResponse.json({
    ok: true,
    data: { signedOut: true },
  });

  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });

  return response;
}
