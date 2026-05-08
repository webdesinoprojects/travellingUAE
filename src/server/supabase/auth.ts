import "server-only";

import type { NextRequest } from "next/server";

export type AdminAccess =
  | { ok: true; mode: "preview-token" }
  | { ok: false; status: 401 | 403 };

export function verifyAdminApiAccess(request: NextRequest): AdminAccess {
  const previewToken = process.env.ADMIN_PREVIEW_TOKEN;

  if (
    previewToken &&
    request.headers.get("x-admin-preview-token") === previewToken
  ) {
    return { ok: true, mode: "preview-token" };
  }

  return { ok: false, status: 401 };
}

