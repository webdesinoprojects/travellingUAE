import { createHash, randomBytes } from "node:crypto";

const ORDER_LOOKUP_TOKEN_BYTES = 32;

export function generateAirhubLookupToken() {
  return randomBytes(ORDER_LOOKUP_TOKEN_BYTES).toString("base64url");
}

export function hashAirhubLookupToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateAirhubUniqueOrderId() {
  return `airhub_${Date.now()}_${randomBytes(8).toString("hex")}`;
}
