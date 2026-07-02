import "server-only";

import { NextResponse } from "next/server";

import { logServerError } from "@/server/http/response";

import { isAirhubError } from "./errors";

export function airhubRouteError(scope: string, error: unknown) {
  logServerError(scope, error);

  if (isAirhubError(error)) {
    return NextResponse.json(
      {
        ok: false,
        code: error.code,
        message: error.message,
      },
      { status: error.status },
    );
  }

  return NextResponse.json(
    { ok: false, message: "Something went wrong. Please try again." },
    { status: 500 },
  );
}
