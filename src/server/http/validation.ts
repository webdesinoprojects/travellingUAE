import "server-only";

export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function readJsonObject(request: Request): Promise<UnknownRecord> {
  const body = await request.json().catch(() => null);

  if (!isRecord(body)) {
    throw new Error("Invalid request body");
  }

  return body;
}

export function readString(
  source: UnknownRecord,
  key: string,
  {
    min = 0,
    max = 300,
    required = false,
  }: {
    min?: number;
    max?: number;
    required?: boolean;
  } = {},
) {
  const value = source[key];

  if (value == null || value === "") {
    if (required) {
      throw new Error(`${key} is required`);
    }

    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`${key} must be a string`);
  }

  const trimmed = value.trim();

  if (trimmed.length < min) {
    throw new Error(`${key} is too short`);
  }

  if (trimmed.length > max) {
    throw new Error(`${key} is too long`);
  }

  return trimmed;
}

export function readNumber(
  source: UnknownRecord,
  key: string,
  {
    min,
    max,
    fallback,
  }: {
    min?: number;
    max?: number;
    fallback?: number;
  } = {},
) {
  const value = source[key];

  if (value == null || value === "") {
    return fallback;
  }

  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    throw new Error(`${key} must be numeric`);
  }

  if (min != null && numeric < min) {
    throw new Error(`${key} is too small`);
  }

  if (max != null && numeric > max) {
    throw new Error(`${key} is too large`);
  }

  return numeric;
}

export function requireEmail(value: string | undefined, key = "email") {
  if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error(`${key} is invalid`);
  }

  return value.toLowerCase();
}

export function readDateString(source: UnknownRecord, key: string) {
  const value = readString(source, key, { max: 20 });

  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${key} is invalid`);
  }

  return value;
}
