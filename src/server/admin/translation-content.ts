import "server-only";

import {
  getSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/server/supabase/client";
import type {
  AdminTranslationContent,
  AdminTranslationEntry,
  AdminTranslationStatus,
  LocaleDirection,
  PublicLocale,
} from "@/types/locale";

type DbLocale = {
  code: string;
  name: string;
  direction: LocaleDirection;
  is_default: boolean;
};

type DbTranslation = {
  id: string;
  locale_code: string;
  namespace: string;
  translation_key: string;
  value: string;
  status: AdminTranslationStatus;
  updated_at: string | null;
};

export async function getAdminTranslationContent(): Promise<AdminTranslationContent> {
  if (!hasSupabaseAdminEnv()) {
    return {
      source: "unconfigured",
      locales: [],
      entries: [],
    };
  }

  const supabase = getSupabaseAdminClient();
  const [localesResult, translationsResult] = await Promise.all([
    supabase
      .from("locales")
      .select("code,name,direction,is_default")
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("code", { ascending: true }),
    supabase
      .from("translations")
      .select("id,locale_code,namespace,translation_key,value,status,updated_at")
      .order("namespace", { ascending: true })
      .order("translation_key", { ascending: true })
      .order("locale_code", { ascending: true }),
  ]);

  if (localesResult.error) {
    throw localesResult.error;
  }

  if (translationsResult.error) {
    throw translationsResult.error;
  }

  return {
    source: "database",
    locales: ((localesResult.data ?? []) as DbLocale[]).map(mapLocale),
    entries: ((translationsResult.data ?? []) as DbTranslation[]).map(mapEntry),
  };
}

function mapLocale(row: DbLocale): PublicLocale {
  return {
    code: row.code,
    name: row.name,
    direction: row.direction === "rtl" ? "rtl" : "ltr",
    isDefault: row.is_default,
  };
}

function mapEntry(row: DbTranslation): AdminTranslationEntry {
  return {
    id: row.id,
    locale: row.locale_code,
    namespace: row.namespace,
    key: row.translation_key,
    value: row.value,
    status: row.status,
    updatedAt: row.updated_at,
  };
}
