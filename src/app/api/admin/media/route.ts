import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

import { getAdminResourceDTO } from "@/server/admin/dal";
import { writeAdminAuditLog } from "@/server/admin/audit";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import {
  readJsonObject,
  readString,
} from "@/server/http/validation";
import {
  assertSafeUploadMetadata,
  extractFileFormat,
  extractFolderFromFilePath,
  hasImageKitEnv,
  normalizeSafeFolder,
  verifyImageKitFile,
} from "@/server/media/imagekit";
import {
  getSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/server/supabase/client";
import { verifyAdminApiAccess } from "@/server/supabase/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const access = await verifyAdminApiAccess(request, "editor");

    if (!access.ok) {
      return jsonError(access.status, "You are not allowed to access this area.");
    }

    const params = request.nextUrl.searchParams;
    const config = await getAdminResourceDTO("media", {
      q: params.get("q") ?? undefined,
      status: params.get("status") ?? "published",
      cursor: params.get("cursor") ?? undefined,
      limit: params.get("limit") ? Number(params.get("limit")) : 48,
      folder: params.get("folder") ?? undefined,
    });

    return jsonOk({
      media: config.rows,
      pageInfo: config.pageInfo,
    });
  } catch (error) {
    logServerError("api.admin.media.list", error);
    return jsonError(500, "Media could not be loaded.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await verifyAdminApiAccess(request, "editor");

    if (!access.ok) {
      return jsonError(access.status, "You are not allowed to access this area.");
    }

    if (!hasImageKitEnv()) {
      return jsonError(503, "Media uploads are not configured.");
    }

    if (!hasSupabaseAdminEnv()) {
      return jsonError(503, "Media storage is not configured.");
    }

    const body = await readJsonObject(request);
    const fileId = readString(body, "fileId", {
      min: 8,
      max: 80,
      required: true,
    });
    const altText = readString(body, "altText", {
      min: 4,
      max: 240,
      required: true,
    });
    const folderInput = readString(body, "folder", { max: 120 });

    if (!fileId) {
      return jsonError(400, "fileId is required");
    }

    if (!altText) {
      return jsonError(400, "altText is required");
    }

    const requestedFolder = normalizeSafeFolder(folderInput);

    const file = await verifyImageKitFile(fileId);

    assertSafeUploadMetadata(file);

    const verifiedFolder = extractFolderFromFilePath(file.filePath);

    if (requestedFolder && requestedFolder !== verifiedFolder) {
      return jsonError(
        400,
        "Folder does not match the verified upload location.",
      );
    }

    const payload = {
      provider: "imagekit" as const,
      public_id: file.fileId,
      url: file.url,
      secure_url: file.url,
      alt_text: altText,
      resource_type: "image",
      width: file.width,
      height: file.height,
      bytes: file.size,
      format: extractFileFormat(file),
      folder: verifiedFolder,
      metadata: {
        filePath: file.filePath,
        thumbnailUrl: file.thumbnailUrl,
        tags: file.tags,
        mime: file.mime,
        name: file.name,
      },
      status: "published" as const,
      created_by: access.actor.id ?? null,
    };

    const result = await getSupabaseAdminClient()
      .from("media_assets")
      .insert(payload)
      .select(
        "id,provider,public_id,url,secure_url,alt_text,width,height,bytes,format,folder,metadata,status,updated_at",
      )
      .single();

    if (result.error) {
      throw result.error;
    }

    const row = result.data as Record<string, unknown>;

    await writeAdminAuditLog({
      actor: access.actor,
      action: "media.create",
      table: "media_assets",
      entityId: typeof row.id === "string" ? row.id : undefined,
      before: null,
      after: {
        id: row.id,
        provider: row.provider,
        public_id: row.public_id,
        folder: row.folder,
      },
    });

    revalidatePath("/admin/media");

    return jsonOk(
      {
        media: {
          id: row.id,
          provider: row.provider,
          publicId: row.public_id,
          url: row.url,
          secureUrl: row.secure_url,
          altText: row.alt_text,
          width: row.width,
          height: row.height,
          bytes: row.bytes,
          format: row.format,
          folder: row.folder,
          status: row.status,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    logServerError("api.admin.media.persist", error);
    return jsonError(400, "Media metadata could not be saved.");
  }
}
