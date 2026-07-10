import "server-only";

import { writeAdminAuditLog } from "@/server/admin/audit";
import {
  FALLBACK_HOME_HERO_MEDIA,
  mapHomeHeroPayload,
  validateHomeHeroMedia,
} from "@/server/cms/hero";
import { readJsonObject, readString } from "@/server/http/validation";
import {
  getSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/server/supabase/client";
import type { AdminActor } from "@/server/supabase/auth";
import type { AdminHomeHero } from "@/types/home";

const HOME_HERO_SECTION_KEY = "home.hero";

type DbHomeHeroRow = {
  id: string;
  payload: Record<string, unknown> | null;
  status: "draft" | "published" | "archived";
  updated_at: string | null;
};

export async function getAdminHomeHero(): Promise<AdminHomeHero> {
  if (!hasSupabaseAdminEnv()) {
    return fallbackAdminHero();
  }

  const result = await getSupabaseAdminClient()
    .from("site_sections")
    .select("id,payload,status,updated_at")
    .eq("key", HOME_HERO_SECTION_KEY)
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  const row = (result.data ?? null) as DbHomeHeroRow | null;

  return row ? mapAdminHero(row) : fallbackAdminHero();
}

export async function saveAdminHomeHero(
  request: Request,
  actor: AdminActor,
): Promise<AdminHomeHero> {
  if (!hasSupabaseAdminEnv()) {
    throw new Error("Admin database is not configured");
  }

  const body = await readJsonObject(request);
  const title = readString(body, "title", {
    min: 4,
    max: 140,
    required: true,
  })!;
  const subtitle = readString(body, "subtitle", {
    min: 8,
    max: 320,
    required: true,
  })!;
  const backgroundImage = readString(body, "backgroundImage", {
    min: 12,
    max: 1200,
    required: true,
  })!;
  const backgroundAlt = readString(body, "backgroundAlt", {
    min: 4,
    max: 240,
    required: true,
  })!;
  const status = readHeroStatus(body.status);
  const hero = validateHomeHeroMedia(
    backgroundImage,
    backgroundAlt,
    title,
    subtitle,
  );
  const supabase = getSupabaseAdminClient();
  const beforeResult = await supabase
    .from("site_sections")
    .select("id,payload,status,updated_at")
    .eq("key", HOME_HERO_SECTION_KEY)
    .maybeSingle();

  if (beforeResult.error) {
    throw beforeResult.error;
  }

  const before = (beforeResult.data ?? null) as DbHomeHeroRow | null;
  const result = await supabase
    .from("site_sections")
    .upsert(
      {
        key: HOME_HERO_SECTION_KEY,
        title: "Home Hero",
        eyebrow: "Homepage",
        description: "Public homepage background media.",
        payload: hero,
        status,
      },
      { onConflict: "key" },
    )
    .select("id,payload,status,updated_at")
    .single();

  if (result.error) {
    throw result.error;
  }

  const saved = result.data as DbHomeHeroRow;

  await writeAdminAuditLog({
    actor,
    action: "home.hero.update",
    table: "site_sections",
    entityId: saved.id,
    before: before ? safeHeroAudit(before) : null,
    after: safeHeroAudit(saved),
  });

  return mapAdminHero(saved);
}

function mapAdminHero(row: DbHomeHeroRow): AdminHomeHero {
  return {
    ...mapHomeHeroPayload(row.payload),
    id: row.id,
    status: row.status,
    updatedAt: row.updated_at ?? undefined,
    source: "database",
  };
}

function fallbackAdminHero(): AdminHomeHero {
  return {
    ...FALLBACK_HOME_HERO_MEDIA,
    status: "draft",
    source: "fallback",
  };
}

function safeHeroAudit(row: DbHomeHeroRow) {
  return {
    key: HOME_HERO_SECTION_KEY,
    status: row.status,
    ...mapHomeHeroPayload(row.payload),
  };
}

function readHeroStatus(value: unknown): DbHomeHeroRow["status"] {
  if (value === "draft" || value === "published" || value === "archived") {
    return value;
  }

  throw new Error("Hero status is invalid");
}
