import "server-only";

import { getRateHawkConfig, type RateHawkConfig } from "./config";

/**
 * Server-only HTTP client for the RateHawk / ETG API v3.
 *
 * Production concerns handled here:
 * - HTTP Basic auth (KEY_ID:API_KEY) built per request, never logged.
 * - Bounded per-request timeouts via AbortController.
 * - Safe retry with exponential backoff + jitter for idempotent reads only,
 *   honouring Retry-After / rate-limit headers.
 * - Per-host circuit breaker so a provider outage fails fast instead of
 *   exhausting our own request workers under load.
 * - Outbound concurrency limiter (semaphore) to respect ETG simultaneous
 *   request limits and protect us at 10k+ concurrent users.
 * - Sanitized logging: method, path, status, duration, attempt, rate-limit
 *   remaining and a short provider error code only. Never the auth header,
 *   request body, response body, PII, or secrets.
 *
 * NOTE ON SCALE: the breaker / limiter / rate-limit state below is in-process.
 * On a single long-lived Node server this is a correct first layer. On
 * multi-instance / serverless deployments (e.g. Vercel) each instance keeps its
 * own counters; a shared store (Redis/Upstash) is the documented next step for
 * globally-correct throttling. See dev-left/phase-5/left.md.
 */

export type RateHawkErrorCode =
  | "not_configured"
  | "timeout"
  | "rate_limited"
  | "circuit_open"
  | "http_error"
  | "provider_error"
  | "invalid_response"
  | "network_error";

export class RateHawkError extends Error {
  readonly code: RateHawkErrorCode;
  readonly httpStatus?: number;
  /** Short provider error slug (e.g. "no_availability"). Never a payload. */
  readonly providerCode?: string;
  readonly retryable: boolean;

  constructor(
    code: RateHawkErrorCode,
    message: string,
    options: {
      httpStatus?: number;
      providerCode?: string;
      retryable?: boolean;
    } = {},
  ) {
    super(message);
    this.name = "RateHawkError";
    this.code = code;
    this.httpStatus = options.httpStatus;
    this.providerCode = options.providerCode;
    this.retryable = options.retryable ?? false;
  }
}

export type RateLimitSnapshot = {
  limit: number | null;
  remaining: number | null;
  resetSeconds: number | null;
};

export type RateHawkRequestOptions = {
  method?: "GET" | "POST";
  /** JSON body for POST requests. */
  body?: unknown;
  /** Per-request timeout. Defaults to 30s (aligned with search commitments). */
  timeoutMs?: number;
  /** Max attempts for idempotent reads. Ignored if idempotent === false. */
  maxAttempts?: number;
  /**
   * Whether the call is safe to retry. Reads (search/overview/hotelpage) are
   * idempotent. Prebook/booking must pass false.
   */
  idempotent?: boolean;
  /** AbortSignal from the inbound request, to cancel orphaned provider calls. */
  signal?: AbortSignal;
};

export type RateHawkResponse<T> = {
  data: T;
  rateLimit: RateLimitSnapshot;
  requestId: string | null;
};

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const MAX_OUTBOUND_CONCURRENCY = 24;
const USER_AGENT = "FlyTime-Backend/1.0 (+server-only)";

// ---- Circuit breaker -------------------------------------------------------

const BREAKER_FAILURE_THRESHOLD = 5;
const BREAKER_COOLDOWN_MS = 15_000;

type BreakerState = {
  consecutiveFailures: number;
  openedAt: number | null;
};

const breakers = new Map<string, BreakerState>();

function getBreaker(host: string): BreakerState {
  let state = breakers.get(host);

  if (!state) {
    state = { consecutiveFailures: 0, openedAt: null };
    breakers.set(host, state);
  }

  return state;
}

function breakerAllows(host: string): boolean {
  const state = getBreaker(host);

  if (state.openedAt === null) {
    return true;
  }

  if (Date.now() - state.openedAt >= BREAKER_COOLDOWN_MS) {
    // Half-open: allow a single trial request through.
    state.openedAt = null;
    return true;
  }

  return false;
}

function recordBreakerSuccess(host: string): void {
  const state = getBreaker(host);
  state.consecutiveFailures = 0;
  state.openedAt = null;
}

function recordBreakerFailure(host: string): void {
  const state = getBreaker(host);
  state.consecutiveFailures += 1;

  if (state.consecutiveFailures >= BREAKER_FAILURE_THRESHOLD) {
    state.openedAt = Date.now();
  }
}

// ---- Concurrency limiter ---------------------------------------------------

let activeOutbound = 0;
const waiters: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (activeOutbound < MAX_OUTBOUND_CONCURRENCY) {
    activeOutbound += 1;
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    waiters.push(() => {
      activeOutbound += 1;
      resolve();
    });
  });
}

function releaseSlot(): void {
  activeOutbound -= 1;
  const next = waiters.shift();

  if (next) {
    next();
  }
}

// ---- Helpers ---------------------------------------------------------------

function parseIntOrNull(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function readRateLimit(headers: Headers): RateLimitSnapshot {
  return {
    limit:
      parseIntOrNull(headers.get("x-ratelimit-limit")) ??
      parseIntOrNull(headers.get("ratelimit-limit")),
    remaining:
      parseIntOrNull(headers.get("x-ratelimit-remaining")) ??
      parseIntOrNull(headers.get("ratelimit-remaining")),
    resetSeconds:
      parseIntOrNull(headers.get("retry-after")) ??
      parseIntOrNull(headers.get("x-ratelimit-reset")) ??
      parseIntOrNull(headers.get("ratelimit-reset")),
  };
}

function sanitizeProviderCode(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  // Provider error codes are short slugs like "no_availability".
  const slug = value.trim().toLowerCase();

  if (!slug || slug.length > 64 || !/^[a-z0-9_.:-]+$/.test(slug)) {
    return undefined;
  }

  return slug;
}

function backoffDelayMs(attempt: number, retryAfterSeconds: number | null): number {
  if (retryAfterSeconds && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1000, 10_000);
  }

  const base = Math.min(500 * 2 ** (attempt - 1), 8_000);
  const jitter = Math.random() * 250;
  return base + jitter;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new RateHawkError("network_error", "Request aborted"));
      return;
    }

    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      cleanup();
      reject(new RateHawkError("network_error", "Request aborted"));
    };

    function cleanup() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function logSafe(
  outcome: "ok" | "retry" | "fail",
  meta: {
    method: string;
    path: string;
    status?: number;
    attempt: number;
    ms: number;
    remaining?: number | null;
    code?: string;
  },
): void {
  const parts = [
    `outcome=${outcome}`,
    `method=${meta.method}`,
    `path=${meta.path}`,
    `attempt=${meta.attempt}`,
    `ms=${meta.ms}`,
  ];

  if (typeof meta.status === "number") {
    parts.push(`status=${meta.status}`);
  }

  if (meta.remaining !== undefined && meta.remaining !== null) {
    parts.push(`rl_remaining=${meta.remaining}`);
  }

  if (meta.code) {
    parts.push(`code=${meta.code}`);
  }

  const line = `[ratehawk] ${parts.join(" ")}`;

  if (outcome === "fail") {
    console.error(line);
  } else if (outcome === "retry") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

// ---- ETG envelope ----------------------------------------------------------

type EtgEnvelope = {
  data?: unknown;
  status?: unknown;
  error?: unknown;
};

function buildAuthHeader(config: RateHawkConfig): string {
  const raw = `${config.keyId}:${config.apiKey}`;
  return `Basic ${Buffer.from(raw).toString("base64")}`;
}

/**
 * Perform a single attempt. Throws RateHawkError on any non-success.
 */
async function attemptOnce<T>(
  config: RateHawkConfig,
  path: string,
  options: RateHawkRequestOptions,
  attempt: number,
): Promise<RateHawkResponse<T>> {
  const method = options.method ?? "GET";
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onParentAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onParentAbort, { once: true });

  const startedAt = Date.now();

  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: buildAuthHeader(config),
        Accept: "application/json",
        "User-Agent": USER_AGENT,
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      body:
        method === "POST" && options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
      cache: "no-store",
      signal: controller.signal,
    });

    const rateLimit = readRateLimit(response.headers);
    const requestId =
      response.headers.get("x-request-id") ??
      response.headers.get("x-correlation-id");
    const ms = Date.now() - startedAt;

    if (response.status === 429) {
      logSafe("retry", {
        method,
        path,
        status: 429,
        attempt,
        ms,
        remaining: rateLimit.remaining,
      });
      throw new RateHawkError("rate_limited", "Provider rate limit reached", {
        httpStatus: 429,
        retryable: true,
      });
    }

    if (response.status >= 500) {
      logSafe("retry", { method, path, status: response.status, attempt, ms });
      throw new RateHawkError("http_error", "Provider server error", {
        httpStatus: response.status,
        retryable: true,
      });
    }

    if (response.status === 401 || response.status === 403) {
      logSafe("fail", { method, path, status: response.status, attempt, ms });
      throw new RateHawkError("http_error", "Provider auth rejected", {
        httpStatus: response.status,
        retryable: false,
      });
    }

    let envelope: EtgEnvelope | null = null;

    try {
      envelope = (await response.json()) as EtgEnvelope;
    } catch {
      logSafe("fail", { method, path, status: response.status, attempt, ms });
      throw new RateHawkError(
        "invalid_response",
        "Provider returned an unreadable response",
        { httpStatus: response.status, retryable: response.ok },
      );
    }

    if (!response.ok) {
      const providerCode = sanitizeProviderCode(envelope?.error);
      logSafe("fail", {
        method,
        path,
        status: response.status,
        attempt,
        ms,
        code: providerCode,
      });
      throw new RateHawkError("http_error", "Provider request failed", {
        httpStatus: response.status,
        providerCode,
        retryable: false,
      });
    }

    // ETG envelope: { status: "ok", data, error: null } on success.
    if (envelope && envelope.status !== "ok" && envelope.error) {
      const providerCode = sanitizeProviderCode(envelope.error);
      logSafe("fail", { method, path, status: response.status, attempt, ms, code: providerCode });
      throw new RateHawkError("provider_error", "Provider reported an error", {
        httpStatus: response.status,
        providerCode,
        retryable: false,
      });
    }

    if (!envelope || typeof envelope !== "object" || !("data" in envelope)) {
      logSafe("fail", { method, path, status: response.status, attempt, ms });
      throw new RateHawkError(
        "invalid_response",
        "Provider response missing data",
        { httpStatus: response.status },
      );
    }

    logSafe("ok", {
      method,
      path,
      status: response.status,
      attempt,
      ms,
      remaining: rateLimit.remaining,
    });

    return {
      data: envelope.data as T,
      rateLimit,
      requestId,
    };
  } catch (error) {
    if (error instanceof RateHawkError) {
      throw error;
    }

    const ms = Date.now() - startedAt;

    if (controller.signal.aborted) {
      logSafe("retry", { method, path, attempt, ms, code: "timeout" });
      throw new RateHawkError("timeout", "Provider request timed out", {
        retryable: true,
      });
    }

    logSafe("fail", { method, path, attempt, ms, code: "network_error" });
    throw new RateHawkError("network_error", "Provider request failed", {
      retryable: true,
    });
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onParentAbort);
  }
}

/**
 * Raw booking request that preserves the full ETG envelope without throwing on
 * application-level status values (processing, 3ds, completed, etc.).
 *
 * Unlike rateHawkRequest:
 * - Returns { status, error } from the envelope rather than throwing on non-ok.
 * - Does NOT require envelope.data to be present.
 * - HTTP 5xx / 429 returns { httpStatus, status: null, error: null } instead of throwing.
 * - Still throws RateHawkError for network errors and auth failures (401/403).
 *
 * Must only be called for non-idempotent booking endpoints (no automatic retry).
 */
export type RawBookingEnvelope = {
  /** ETG envelope `status` value, lowercased (e.g. "ok", "processing", "3ds"). */
  status: string | null;
  /** ETG envelope `error` slug, sanitized (e.g. "soldout"). */
  error: string | null;
  /** ETG envelope `data` field as-is. Caller must strip hashes/PII before passing up. */
  data: unknown;
  httpStatus: number;
  rateLimit: RateLimitSnapshot;
};

export async function rateHawkBookingRequest(
  path: string,
  body: Record<string, unknown>,
  options?: { timeoutMs?: number; signal?: AbortSignal },
): Promise<RawBookingEnvelope> {
  const config = getRateHawkConfig();
  const host = config.baseUrl;

  if (!breakerAllows(host)) {
    // Breaker already open: reject fast WITHOUT recording another failure (that
    // would keep resetting the cooldown and prevent recovery under load).
    return {
      status: null,
      error: "circuit_open",
      data: null,
      httpStatus: 503,
      rateLimit: { limit: null, remaining: null, resetSeconds: null },
    };
  }

  await acquireSlot();

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const parentSignal = options?.signal;
  const onParentAbort = () => controller.abort();
  parentSignal?.addEventListener("abort", onParentAbort, { once: true });

  const startedAt = Date.now();

  try {
    let response: Response;

    try {
      response = await fetch(`${config.baseUrl}${path}`, {
        method: "POST",
        headers: {
          Authorization: buildAuthHeader(config),
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": USER_AGENT,
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: controller.signal,
      });
    } catch {
      const ms = Date.now() - startedAt;

      if (controller.signal.aborted) {
        logSafe("retry", { method: "POST", path, attempt: 1, ms, code: "timeout" });
        return {
          status: null,
          error: "timeout",
          data: null,
          httpStatus: 0,
          rateLimit: { limit: null, remaining: null, resetSeconds: null },
        };
      }

      logSafe("fail", { method: "POST", path, attempt: 1, ms, code: "network_error" });
      throw new RateHawkError("network_error", "Provider request failed", { retryable: true });
    }

    const rateLimit = readRateLimit(response.headers);
    const ms = Date.now() - startedAt;

    // Auth failures are hard errors - circuit break and throw.
    if (response.status === 401 || response.status === 403) {
      logSafe("fail", { method: "POST", path, status: response.status, attempt: 1, ms });
      recordBreakerFailure(host);
      throw new RateHawkError("http_error", "Provider auth rejected", {
        httpStatus: response.status,
        retryable: false,
      });
    }

    // 5xx / 429: transient - record failure and return as signal (don't throw).
    if (response.status === 429 || response.status >= 500) {
      logSafe("retry", { method: "POST", path, status: response.status, attempt: 1, ms });
      recordBreakerFailure(host);
      return { status: null, error: null, data: null, httpStatus: response.status, rateLimit };
    }

    let envelope: EtgEnvelope | null = null;

    try {
      envelope = (await response.json()) as EtgEnvelope;
    } catch {
      logSafe("fail", { method: "POST", path, status: response.status, attempt: 1, ms });
      throw new RateHawkError("invalid_response", "Provider returned an unreadable response", {
        httpStatus: response.status,
      });
    }

    const envelopeStatus =
      typeof envelope?.status === "string"
        ? envelope.status.trim().toLowerCase() || null
        : null;
    const envelopeError = sanitizeProviderCode(envelope?.error) ?? null;

    // Circuit breaker counts ONLY infra/transport/rate-limit failures (network,
    // timeout, 5xx, 429 - handled above). A clean HTTP-200 envelope means the
    // provider is healthy, even when it carries an ETG BUSINESS error
    // (rate_not_found, contract_mismatch, duplicate_reservation, soldout, ...).
    // Business errors update booking/job state via the classifiers, and must NOT
    // trip the breaker. So any HTTP-200 envelope records breaker success.
    recordBreakerSuccess(host);

    logSafe(envelopeStatus === "ok" ? "ok" : "retry", {
      method: "POST",
      path,
      status: response.status,
      attempt: 1,
      ms,
      code: envelopeError ?? undefined,
    });

    return {
      status: envelopeStatus,
      error: envelopeError,
      data: envelope?.data ?? null,
      httpStatus: response.status,
      rateLimit,
    };
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener("abort", onParentAbort);
    releaseSlot();
  }
}

/**
 * Execute a RateHawk request with concurrency control, circuit breaking and
 * safe retry. Returns the ETG `data` payload plus rate-limit metadata.
 */
export async function rateHawkRequest<T>(
  path: string,
  options: RateHawkRequestOptions = {},
): Promise<RateHawkResponse<T>> {
  const config = getRateHawkConfig();
  const host = config.baseUrl;

  if (!breakerAllows(host)) {
    throw new RateHawkError(
      "circuit_open",
      "Provider temporarily unavailable (circuit open)",
      { retryable: false },
    );
  }

  const idempotent = options.idempotent ?? (options.method ?? "GET") === "GET";
  const maxAttempts = idempotent
    ? Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS)
    : 1;

  await acquireSlot();

  try {
    let lastError: RateHawkError | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const result = await attemptOnce<T>(config, path, options, attempt);
        recordBreakerSuccess(host);
        return result;
      } catch (error) {
        const rhError =
          error instanceof RateHawkError
            ? error
            : new RateHawkError("network_error", "Provider request failed", {
                retryable: true,
              });

        lastError = rhError;

        const canRetry =
          idempotent && rhError.retryable && attempt < maxAttempts;

        if (!canRetry) {
          recordBreakerFailure(host);
          throw rhError;
        }

        await sleep(backoffDelayMs(attempt, null), options.signal);
      }
    }

    recordBreakerFailure(host);
    throw (
      lastError ??
      new RateHawkError("network_error", "Provider request failed")
    );
  } finally {
    releaseSlot();
  }
}
