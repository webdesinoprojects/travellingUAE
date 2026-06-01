import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

import { writeAdminAuditLog } from "@/server/admin/audit";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import {
  getSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/server/supabase/client";
import { verifyAdminApiAccess } from "@/server/supabase/auth";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    if (!UUID_RE.test(id)) {
      return jsonError(404, "Media asset was not found.");
    }

    const access = await verifyAdminApiAccess(request, "editor");

    if (!access.ok) {
      return jsonError(access.status, "You are not allowed to access this area.");
    }

    if (!hasSupabaseAdminEnv()) {
      return jsonError(503, "Media storage is not configured.");
    }

    const supabase = getSupabaseAdminClient();
    const before = await supabase
      .from("media_assets")
      .select("id,status,public_id,folder")
      .eq("id", id)
      .maybeSingle();

    if (before.error || !before.data) {
      return jsonError(404, "Media asset was not found.");
    }

    const result = await supabase
      .from("media_assets")
      .update({ status: "published" })
      .eq("id", id)
      .select("id,status,public_id,folder")
      .single();

    if (result.error) {
      throw result.error;
    }

    await writeAdminAuditLog({
      actor: access.actor,
      action: "media.restore",
      table: "media_assets",
      entityId: id,
      before: {
        id: before.data.id,
        status: before.data.status,
        public_id: before.data.public_id,
        folder: before.data.folder,
      },
      after: {
        id: result.data.id,
        status: result.data.status,
        public_id: result.data.public_id,
        folder: result.data.folder,
      },
    });

    revalidatePath("/admin/media");

    return jsonOk({
      media: {
        id: result.data.id,
        status: result.data.status,
      },
    });
  } catch (error) {
    logServerError("api.admin.media.restore", error);
    return jsonError(400, "Media asset could not be restored.");
  }
}
