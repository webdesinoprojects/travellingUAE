import "server-only";

import { getSupabaseAdminClient } from "@/server/supabase/client";
import { clearAirhubCountryCache } from "@/server/providers/airhub/countries";
import {
  computePlanPageCount,
  resolveCountryDisplayName,
} from "@/server/admin/esim-visibility-helpers";
import type {
  AdminCountryItem,
  AdminCountryListResult,
  AdminCountryQuery,
  CountryControlPatch,
} from "@/features/admin/esim/visibility-types";

const COUNTRY_COLUMNS =
  "iso_code,name,region_name,flag_url,display_name_override,is_visible,is_featured,sort_order,synced_at,updated_at";

const SEARCH_COLUMNS = ["name", "iso_code", "display_name_override"] as const;

type CountryRow = {
  iso_code: string;
  name: string;
  region_name: string | null;
  flag_url: string | null;
  display_name_override: string | null;
  is_visible: boolean;
  is_featured: boolean;
  sort_order: number;
  synced_at: string;
  updated_at: string;
};

export async function listAdminCountries(
  query: AdminCountryQuery,
): Promise<AdminCountryListResult> {
  const supabase = getSupabaseAdminClient();

  let builder = supabase.from("airhub_countries").select(COUNTRY_COLUMNS, { count: "exact" });

  if (query.filter === "visible") builder = builder.eq("is_visible", true);
  else if (query.filter === "hidden") builder = builder.eq("is_visible", false);
  else if (query.filter === "featured") builder = builder.eq("is_featured", true);

  if (query.search) {
    const pattern = `%${query.search}%`;
    builder = builder.or(SEARCH_COLUMNS.map((column) => `${column}.ilike.${pattern}`).join(","));
  }

  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;

  const { data, error, count } = await builder
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .range(from, to);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as unknown as CountryRow[];
  const total = count ?? rows.length;
  return {
    items: rows.map(toAdminCountryItem),
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: computePlanPageCount(total, query.pageSize),
  };
}

export async function updateCountryControls(
  isoCode: string,
  patch: CountryControlPatch,
): Promise<boolean> {
  const update: Record<string, unknown> = {};
  if (patch.isVisible !== undefined) update.is_visible = patch.isVisible;
  if (patch.isFeatured !== undefined) update.is_featured = patch.isFeatured;
  if (patch.displayNameOverride !== undefined) {
    update.display_name_override = normalizeNullableText(patch.displayNameOverride);
  }
  if (patch.sortOrder !== undefined) update.sort_order = patch.sortOrder;

  if (Object.keys(update).length === 0) {
    return false;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("airhub_countries")
    .update(update)
    .eq("iso_code", isoCode.toUpperCase())
    .select("iso_code")
    .maybeSingle();

  if (error) {
    throw error;
  }

  // Surface the change on the public flow without waiting for the country cache TTL.
  if (data) {
    clearAirhubCountryCache();
  }
  return Boolean(data);
}

function toAdminCountryItem(row: CountryRow): AdminCountryItem {
  return {
    isoCode: row.iso_code,
    providerName: row.name,
    displayName: resolveCountryDisplayName(row.name, row.display_name_override),
    displayNameOverride: row.display_name_override,
    flagUrl: row.flag_url,
    regionName: row.region_name,
    isVisible: row.is_visible,
    isFeatured: row.is_featured,
    sortOrder: row.sort_order,
    syncedAt: row.synced_at,
    updatedAt: row.updated_at,
  };
}

function normalizeNullableText(value: string | null): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
