import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import {
  computeEtgSignature,
  isWebhookTimestampFresh,
  verifyEtgWebhookSignature,
} from "./webhook-signature.ts";

const API_KEY = "test-api-key-token";
const TIMESTAMP = "1718280000";
const TOKEN = "abc123token";

function reference(timestamp: string, token: string, key: string): string {
  return createHmac("sha256", key).update(`${timestamp}${token}`).digest("hex");
}

test("computeEtgSignature matches the documented HMAC-SHA256(timestamp+token)", () => {
  assert.equal(
    computeEtgSignature(TIMESTAMP, TOKEN, API_KEY),
    reference(TIMESTAMP, TOKEN, API_KEY),
  );
});

test("verifyEtgWebhookSignature accepts a correct signature", () => {
  const signature = reference(TIMESTAMP, TOKEN, API_KEY);
  assert.ok(verifyEtgWebhookSignature({ timestamp: TIMESTAMP, token: TOKEN, signature, apiKey: API_KEY }));
});

test("verifyEtgWebhookSignature rejects tampering", () => {
  const signature = reference(TIMESTAMP, TOKEN, API_KEY);
  // wrong token
  assert.ok(
    !verifyEtgWebhookSignature({ timestamp: TIMESTAMP, token: "other", signature, apiKey: API_KEY }),
  );
  // wrong key
  assert.ok(
    !verifyEtgWebhookSignature({ timestamp: TIMESTAMP, token: TOKEN, signature, apiKey: "wrong" }),
  );
  // wrong signature length
  assert.ok(
    !verifyEtgWebhookSignature({ timestamp: TIMESTAMP, token: TOKEN, signature: "deadbeef", apiKey: API_KEY }),
  );
});

test("verifyEtgWebhookSignature rejects empty/malformed input without throwing", () => {
  assert.ok(!verifyEtgWebhookSignature({ timestamp: "", token: TOKEN, signature: "x", apiKey: API_KEY }));
  assert.ok(!verifyEtgWebhookSignature({ timestamp: TIMESTAMP, token: "", signature: "x", apiKey: API_KEY }));
  assert.ok(!verifyEtgWebhookSignature({ timestamp: TIMESTAMP, token: TOKEN, signature: "", apiKey: API_KEY }));
  assert.ok(!verifyEtgWebhookSignature({ timestamp: TIMESTAMP, token: TOKEN, signature: "x", apiKey: "" }));
});

test("isWebhookTimestampFresh enforces the tolerance window", () => {
  const now = 1_718_280_000;
  assert.ok(isWebhookTimestampFresh(now, now, 300));
  assert.ok(isWebhookTimestampFresh(now - 299, now, 300));
  assert.ok(isWebhookTimestampFresh(now + 299, now, 300));
  assert.ok(!isWebhookTimestampFresh(now - 301, now, 300));
  assert.ok(!isWebhookTimestampFresh(now + 301, now, 300));
  assert.ok(!isWebhookTimestampFresh(Number.NaN, now, 300));
});
