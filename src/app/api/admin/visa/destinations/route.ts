import type { NextRequest } from "next/server";

import { writeAdminAuditLog } from "@/server/admin/audit";
import { createVisaDestination, VisaCmsError } from "@/server/admin/visa-cms";
import { revalidateVisaPublicPaths } from "@/server/admin/visa-revalidate";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { readJsonObject } from "@/server/http/validation";
import { verifyAdminApiAccess } from "@/server/supabase/auth";

export const dynamic = "force-dynamic";

/** POST: create a visa destination. */
export async function POST(request: NextRequest) {
  try {
    const access = await verifyAdminApiAccess(request, "editor");
    if (!access.ok) return jsonError(access.status, "You are not allowed to access this area.");

    const body = await readJsonObject(request);
    const id = await createVisaDestination(body as never);

    revalidateVisaPublicPaths();
    await writeAdminAuditLog({
      actor: access.actor,
      action: "visa.destination.create",
      table: "visa_destinations",
      entityId: id,
      before: null,
      after: { category: body.category, slug: body.slug },
    });

    return jsonOk({ id }, { status: 201 });
  } catch (error) {
    if (error instanceof VisaCmsError) {
      return jsonError(error.status as 400 | 404 | 409, error.message);
    }
    logServerError("api.admin.visa.destinations.create", error);
    return jsonError(400, "The visa destination could not be created.");
  }
}
