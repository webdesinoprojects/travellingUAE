import "server-only";

import { createHmac, randomUUID } from "node:crypto";

export type ImageKitUploadAuth = {
  signature: string;
  expire: number;
  token: string;
  publicKey: string;
  uploadEndpoint: string;
};

export type ImageKitFileMetadata = {
  fileId: string;
  name: string;
  filePath: string;
  url: string;
  thumbnailUrl: string | null;
  height: number | null;
  width: number | null;
  size: number;
  fileType: string;
  mime: string;
  tags: string[];
  isPrivateFile: boolean;
};

const UPLOAD_ENDPOINT = "https://upload.imagekit.io/api/v1/files/upload";
const FILE_DETAILS_ENDPOINT = "https://api.imagekit.io/v1/files";
const TOKEN_TTL_SECONDS = 60 * 30;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);
const ALLOWED_FORMATS = new Set(["jpg", "jpeg", "png", "webp", "avif", "gif"]);
const FILE_ID_RE = /^[A-Za-z0-9._-]{8,80}$/;
const FOLDER_SEGMENT_RE = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,39}$/;
const FOLDER_MAX_DEPTH = 5;

export function hasImageKitEnv(): boolean {
  return Boolean(
    process.env.IMAGEKIT_PUBLIC_KEY &&
      process.env.IMAGEKIT_PRIVATE_KEY &&
      process.env.IMAGEKIT_URL_ENDPOINT,
  );
}

export function getImageKitPublicEndpoint(): string {
  const endpoint = process.env.IMAGEKIT_URL_ENDPOINT;

  if (!endpoint) {
    throw new Error("ImageKit URL endpoint is not configured");
  }

  return endpoint.replace(/\/+$/, "");
}

export function generateImageKitUploadAuth(): ImageKitUploadAuth {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;

  if (!privateKey || !publicKey) {
    throw new Error("ImageKit upload is not configured");
  }

  const token = randomUUID();
  const expire = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const signature = createHmac("sha1", privateKey)
    .update(`${token}${expire}`)
    .digest("hex");

  return {
    signature,
    expire,
    token,
    publicKey,
    uploadEndpoint: UPLOAD_ENDPOINT,
  };
}

export async function verifyImageKitFile(
  fileId: string,
): Promise<ImageKitFileMetadata> {
  if (!FILE_ID_RE.test(fileId)) {
    throw new Error("Invalid ImageKit file id");
  }

  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("ImageKit upload is not configured");
  }

  const response = await fetch(`${FILE_DETAILS_ENDPOINT}/${fileId}/details`, {
    method: "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("ImageKit file could not be verified");
  }

  const body = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!body || typeof body !== "object") {
    throw new Error("ImageKit returned an unexpected response");
  }

  return normalizeImageKitFile(body);
}

export function assertSafeUploadMetadata(file: ImageKitFileMetadata): void {
  if (file.fileType !== "image") {
    throw new Error("Only image uploads are accepted");
  }

  if (!ALLOWED_MIME_TYPES.has(file.mime.toLowerCase())) {
    throw new Error("Image mime type is not allowed");
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new Error("Image file size is invalid");
  }

  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Image exceeds the 25 MB upload limit");
  }

  if (file.isPrivateFile) {
    throw new Error("Private ImageKit files are not allowed for public media");
  }

  if (!file.url || !file.url.startsWith("https://")) {
    throw new Error("ImageKit returned an invalid public URL");
  }

  if (!file.name) {
    throw new Error("ImageKit returned an invalid file name");
  }
}

export function normalizeSafeFolder(value: string | undefined | null): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.includes("\\") || trimmed.includes("//")) {
    throw new Error("Folder path is invalid");
  }

  const segments = trimmed.split("/").filter((segment) => segment !== "");

  if (segments.length === 0 || segments.length > FOLDER_MAX_DEPTH) {
    throw new Error("Folder path is invalid");
  }

  for (const segment of segments) {
    if (segment === "." || segment === ".." || !FOLDER_SEGMENT_RE.test(segment)) {
      throw new Error("Folder path is invalid");
    }
  }

  return segments.join("/");
}

export function extractFolderFromFilePath(
  filePath: string | undefined | null,
): string | null {
  if (!filePath) {
    return null;
  }

  const trimmed = filePath.trim();

  if (!trimmed) {
    return null;
  }

  const segments = trimmed.split("/").filter((segment) => segment !== "");

  if (segments.length <= 1) {
    return null;
  }

  return normalizeSafeFolder(segments.slice(0, -1).join("/"));
}

export function extractFileFormat(file: ImageKitFileMetadata): string | undefined {
  const fromName = file.name.split(".").pop()?.toLowerCase();

  if (fromName && ALLOWED_FORMATS.has(fromName)) {
    return fromName;
  }

  const fromMime = file.mime.split("/").pop()?.toLowerCase();

  if (fromMime && ALLOWED_FORMATS.has(fromMime)) {
    return fromMime;
  }

  return undefined;
}

function normalizeImageKitFile(body: Record<string, unknown>): ImageKitFileMetadata {
  const fileId = stringField(body, "fileId");
  const name = stringField(body, "name");
  const filePath = stringField(body, "filePath");
  const url = stringField(body, "url");
  const thumbnailUrl =
    typeof body.thumbnailUrl === "string" ? body.thumbnailUrl : null;
  const height = numberField(body, "height");
  const width = numberField(body, "width");
  const size = numberField(body, "size") ?? 0;
  const fileType = stringField(body, "fileType");
  const mime = stringField(body, "mime");
  const tags = Array.isArray(body.tags)
    ? (body.tags.filter((value) => typeof value === "string") as string[])
    : [];
  const isPrivateFile = body.isPrivateFile === true;

  if (!fileId || !name || !url) {
    throw new Error("ImageKit metadata is incomplete");
  }

  return {
    fileId,
    name,
    filePath,
    url,
    thumbnailUrl,
    height,
    width,
    size,
    fileType: fileType || "non-image",
    mime: mime || "application/octet-stream",
    tags,
    isPrivateFile,
  };
}

function stringField(body: Record<string, unknown>, key: string): string {
  const value = body[key];

  return typeof value === "string" ? value : "";
}

function numberField(
  body: Record<string, unknown>,
  key: string,
): number | null {
  const value = body[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value !== "") {
    const numeric = Number(value);

    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }

  return null;
}
