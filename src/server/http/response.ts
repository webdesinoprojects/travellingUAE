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

export function jsonError(
  status = 400,
  message = GENERIC_PUBLIC_ERROR,
  init?: Omit<ResponseInit, "status">,
) {
  return NextResponse.json<ApiFailure>(
    { ok: false, message },
    { status, headers: init?.headers },
  );
}

export function logServerError(scope: string, error: unknown) {
  const safeError = toError(error);

  // Extract Supabase-specific error fields if present
  const errorObj = error as Record<string, unknown> | null;
  const supabaseFields: Record<string, unknown> = {};
  
  if (errorObj) {
    if (errorObj.code) supabaseFields.code = errorObj.code;
    if (errorObj.message) supabaseFields.message = errorObj.message;
    if (errorObj.details) supabaseFields.details = errorObj.details;
    if (errorObj.hint) supabaseFields.hint = errorObj.hint;
  }

  if (Object.keys(supabaseFields).length > 0) {
    console.error(`[${scope}] ${safeError.name}: ${safeError.message}`, supabaseFields);
  } else {
    console.error(`[${scope}] ${safeError.name}: ${safeError.message}`);
  }
}

