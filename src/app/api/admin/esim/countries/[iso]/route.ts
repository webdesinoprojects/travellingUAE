import type { NextRequest } from "next/server";

import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { readJsonObject } from "@/server/http/validation";
import { updateCountryControls } from "@/server/admin/esim-countries";
import { verifyAdminApiAccess } from "@/server/supabase/auth";
import { hasSupabaseAdminEnv } from "@/server/supabase/client";
import type { CountryControlPatch } from "@/features/admin/esim/visibility-types";

export const dynamic = "force-dynamic";

const ISO_RE = /^[A-Za-z]{2}$/;

/** Admin-only country visibility update. */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ iso: string }> },
) {
  try {
    const access = await verifyAdminApiAccess(request, "admin");
    if (!access.ok) {
      return jsonError(access.status, "You are not allowed to access this area.");
    }

    const { iso } = await context.params;
    if (!ISO_RE.test(iso)) {
      return jsonError(400, "Invalid country code.");
    }
    if (!hasSupabaseAdminEnv()) {
      return jsonError(503, "Database is not configured.");
    }

    const body = await readJsonObject(request);
    const patch = buildCountryPatch(body);
    if (Object.keys(patch).length === 0) {
      return jsonError(400, "No changes were provided.");
    }

    const updated = await updateCountryControls(iso, patch);
    if (!updated) {
      return jsonError(404, "Country not found.");
    }

    return jsonOk({ ok: true });
  } catch (error) {
    logServerError("api.admin.esim.countries.update", error);
    return jsonError(500);
  }
}

function buildCountryPatch(body: Record<string, unknown>): CountryControlPatch {
  const patch: CountryControlPatch = {};
  if (typeof body.isVisible === "boolean") patch.isVisible = body.isVisible;
  if (typeof body.isFeatured === "boolean") patch.isFeatured = body.isFeatured;
  if ("displayNameOverride" in body) {
    patch.displayNameOverride = readNullableText(body.displayNameOverride, 120);
  }
  if (body.sortOrder !== undefined) {
    patch.sortOrder = clampSortOrder(body.sortOrder);
  }
  return patch;
}

function readNullableText(value: unknown, max: number): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function clampSortOrder(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.trunc(Math.min(Math.max(parsed, -100000), 100000));
}
