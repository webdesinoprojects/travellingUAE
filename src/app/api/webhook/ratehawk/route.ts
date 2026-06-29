import "server-only";

import { logServerError } from "@/server/http/response";
import {
  getRateHawkConfig,
  isRateHawkConfigured,
  resolveRateHawkEnv,
} from "@/server/providers/ratehawk/config";
import { createSupabaseBookingRepository, createWebhookEventStore } from "@/server/providers/ratehawk/booking/booking-dal";
import {
  handleEtgWebhook,
  MAX_WEBHOOK_BODY_BYTES,
} from "@/server/providers/ratehawk/booking/webhook-handler";

export const dynamic = "force-dynamic";

/**
 * Read at most `maxBytes` of the request body. Rejects early on an oversized
 * Content-Length AND bounds the streamed read so a huge (or lying) payload is
 * never fully buffered. Never logs or returns the body.
 */
async function readBoundedBody(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; text: string } | { ok: false; reason: "too_large" | "read_error" }> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const declared = Number(contentLength);
    if (Number.isFinite(declared) && declared > maxBytes) {
      return { ok: false, reason: "too_large" };
    }
  }

  if (!request.body) {
    return { ok: true, text: "" };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          return { ok: false, reason: "too_large" };
        }
        chunks.push(value);
      }
    }
  } catch {
    return { ok: false, reason: "read_error" };
  }

  return { ok: true, text: Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8") };
}

/**
 * ETG booking-status callback. Dedicated route, separate from the Stripe webhook.
 *
 * The signed payload is verified (HMAC-SHA256 timestamp+token), deduped, and
 * reconciled by handleEtgWebhook. This route is a thin shell: it bounded-reads the
 * raw body, builds server-only dependencies, and maps the handler result to a
 * Response. No secret, token, signature, or provider payload is ever logged.
 */
export async function POST(request: Request) {
  // Without provider credentials we cannot verify signatures; ask ETG to retry.
  if (!isRateHawkConfigured()) {
    return new Response("provider not configured", { status: 503 });
  }

  const contentType = request.headers.get("content-type");

  const body = await readBoundedBody(request, MAX_WEBHOOK_BODY_BYTES);
  if (!body.ok) {
    // Generic, body-free error. Oversized -> 413; unreadable -> 400.
    const status = body.reason === "too_large" ? 413 : 400;
    return new Response("invalid request", { status });
  }
  const bodyText = body.text;

  try {
    const config = getRateHawkConfig();
    const repo = createSupabaseBookingRepository();
    const store = createWebhookEventStore();

    const result = await handleEtgWebhook(
      {
        contentType,
        bodyText,
        getHeader: (name) => request.headers.get(name),
      },
      {
        repo,
        store,
        apiKey: config.apiKey,
        ratehawkEnv: resolveRateHawkEnv(),
      },
    );

    // Only the safe reason slug is surfaced; never echo payload or secrets.
    return new Response(result.reason, { status: result.httpStatus });
  } catch (err) {
    // Retryable internal failure: 500 so ETG redelivers.
    logServerError("webhook.ratehawk.handle", err);
    return new Response("internal error", { status: 500 });
  }
}
