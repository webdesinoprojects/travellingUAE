import "server-only";

import { createHmac } from "node:crypto";

import { logServerError } from "@/server/http/response";
import {
  getSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/server/supabase/client";

export type ProviderRateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  unavailable: boolean;
};

type RateLimitRpcRow = {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
};

const localWindows = new Map<string, { hits: number; startedAt: number }>();

export async function consumeProviderRateLimit({
  request,
  routeKey,
  limit,
  windowSeconds,
}: {
  request: Request;
  routeKey: string;
  limit: number;
  windowSeconds: number;
}): Promise<ProviderRateLimitResult> {
  const bucketKey = hashRequestIdentity(request);

  if (!hasSupabaseAdminEnv()) {
    return consumeLocalLimit(bucketKey, routeKey, limit, windowSeconds);
  }

  try {
    const result = await getSupabaseAdminClient().rpc("consume_api_rate_limit", {
      p_bucket_key: bucketKey,
      p_route_key: routeKey,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });

    const row = Array.isArray(result.data)
      ? (result.data[0] as RateLimitRpcRow | undefined)
      : (result.data as RateLimitRpcRow | null);

    if (result.error || !row) {
      throw result.error ?? new Error("Rate-limit response is missing");
    }

    return {
      allowed: Boolean(row.allowed),
      remaining: Math.max(Number(row.remaining) || 0, 0),
      retryAfterSeconds: Math.max(Number(row.retry_after_seconds) || 0, 0),
      unavailable: false,
    };
  } catch (error) {
    logServerError("provider.rate-limit", error);

    if (process.env.NODE_ENV !== "production") {
      return consumeLocalLimit(bucketKey, routeKey, limit, windowSeconds);
    }

    // Provider-backed public requests fail closed when the shared limiter is
    // unavailable so a DB outage cannot exhaust the provider account quota.
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 30,
      unavailable: true,
    };
  }
}

function hashRequestIdentity(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
  const secret =
    process.env.RATE_LIMIT_HASH_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "flytime-local-rate-limit";

  return createHmac("sha256", secret).update(`provider:${address}`).digest("hex");
}

function consumeLocalLimit(
  bucketKey: string,
  routeKey: string,
  limit: number,
  windowSeconds: number,
): ProviderRateLimitResult {
  const key = `${routeKey}:${bucketKey}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const current = localWindows.get(key);

  if (!current || now - current.startedAt >= windowMs) {
    localWindows.set(key, { hits: 1, startedAt: now });
    pruneLocalWindows(now, windowMs);
    return {
      allowed: true,
      remaining: Math.max(limit - 1, 0),
      retryAfterSeconds: 0,
      unavailable: false,
    };
  }

  current.hits += 1;
  const allowed = current.hits <= limit;

  return {
    allowed,
    remaining: Math.max(limit - current.hits, 0),
    retryAfterSeconds: allowed
      ? 0
      : Math.max(Math.ceil((current.startedAt + windowMs - now) / 1000), 1),
    unavailable: false,
  };
}

function pruneLocalWindows(now: number, windowMs: number) {
  if (localWindows.size <= 2_000) return;

  for (const [key, value] of localWindows) {
    if (now - value.startedAt >= windowMs) {
      localWindows.delete(key);
    }
  }
}
