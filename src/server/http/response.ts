import "server-only";

import { NextResponse } from "next/server";

import { GENERIC_PUBLIC_ERROR, toError } from "@/lib/safe-error";

export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  message: string;
};

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>(
    { ok: true, data },
    {
      status: init?.status ?? 200,
      headers: init?.headers,
    },
  );
}

export function jsonError(status = 400, message = GENERIC_PUBLIC_ERROR) {
  return NextResponse.json<ApiFailure>({ ok: false, message }, { status });
}

export function logServerError(scope: string, error: unknown) {
  const safeError = toError(error);

  console.error(`[${scope}] ${safeError.name}: ${safeError.message}`);
}

