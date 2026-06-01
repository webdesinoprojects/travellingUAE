import type { NextRequest } from "next/server";

import { writeAdminAuditLog } from "@/server/admin/audit";
import {
  generateImageKitUploadAuth,
  getImageKitPublicEndpoint,
  hasImageKitEnv,
} from "@/server/media/imagekit";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { verifyAdminApiAccess } from "@/server/supabase/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const access = await verifyAdminApiAccess(request, "editor");

    if (!access.ok) {
      return jsonError(access.status, "You are not allowed to access this area.");
    }

    if (!hasImageKitEnv()) {
      return jsonError(503, "Media uploads are not configured.");
    }

    const auth = generateImageKitUploadAuth();

    await writeAdminAuditLog({
      actor: access.actor,
      action: "media.upload.auth",
      table: "media_assets",
      entityId: undefined,
      before: null,
      after: { provider: "imagekit", expire: auth.expire },
    });

    return jsonOk({
      signature: auth.signature,
      expire: auth.expire,
      token: auth.token,
      publicKey: auth.publicKey,
      uploadEndpoint: auth.uploadEndpoint,
      urlEndpoint: getImageKitPublicEndpoint(),
    });
  } catch (error) {
    logServerError("api.admin.media.upload-auth", error);
    return jsonError(400, "Upload authorization could not be issued.");
  }
}
