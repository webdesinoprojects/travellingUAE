import "server-only";

import { getSupabaseAdminClient } from "@/server/supabase/client";
import { clearAirhubCountryCache } from "@/server/providers/airhub/countries";
import {
  computePlanPageCount,
  paginate,
  rankPublicCountries,
  resolveCountryDisplayName,
} from "@/server/admin/esim-visibility-helpers";
import {
  getEsimCountryIdentity,
  isUkEsimCountryIdentity,
  preferUkControlSource,
  UK_ESIM_DISPLAY_NAME,
} from "@/lib/esim-country-identity";
import type {
  AdminCountryItem,
  AdminCountryListResult,
  AdminCountryQuery,
  CountryControlPatch,
} from "@/features/admin/esim/visibility-types";

const COUNTRY_COLUMNS =
  "iso_code,name,region_name,flag_url,display_name_override,is_visible,is_featured,sort_order,synced_at,updated_at";

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

  const builder = supabase.from("airhub_countries").select(COUNTRY_COLUMNS);

  const { data, error } = await builder
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .limit(500);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as unknown as CountryRow[];
  const normalized = buildAdminCountryItems(rows);
  const searched = query.search
    ? rankPublicCountries(normalized, query.search)
    : normalized;
  const filtered = searched.filter((item) => matchesCountryFilter(item, query.filter));
  const total = filtered.length;

  return {
    items: paginate(filtered, query.page, query.pageSize),
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
  const identity = getEsimCountryIdentity({
    isoCode: row.iso_code,
    providerName: row.name,
    displayNameOverride: row.display_name_override,
  });
  const providerName = identity.isUkIdentity ? UK_ESIM_DISPLAY_NAME : row.name;

  return {
    isoCode: identity.isoCode,
    controlIsoCode: row.iso_code,
    providerName,
    displayName: identity.isUkIdentity
      ? identity.displayName
      : resolveCountryDisplayName(row.name, row.display_name_override),
    displayNameOverride: row.display_name_override,
    aliases: identity.aliases,
    flagUrl: row.flag_url,
    regionName: row.region_name,
    isVisible: row.is_visible,
    isFeatured: row.is_featured,
    sortOrder: row.sort_order,
    syncedAt: row.synced_at,
    updatedAt: row.updated_at,
  };
}

function buildAdminCountryItems(rows: CountryRow[]): AdminCountryItem[] {
  const items: Array<{ item: AdminCountryItem; source: CountryRow }> = [];
  let ukSource: CountryRow | null = null;

  for (const row of rows) {
    if (isUkEsimCountryIdentity({ isoCode: row.iso_code, name: row.name })) {
      if (
        preferUkControlSource({
          candidateIsoCode: row.iso_code,
          currentIsoCode: ukSource?.iso_code ?? null,
        })
      ) {
        ukSource = row;
      }
      continue;
    }

    items.push({ item: toAdminCountryItem(row), source: row });
  }

  if (ukSource) {
    items.push({ item: toAdminCountryItem(ukSource), source: ukSource });
  }

  items.sort(compareAdminCountryEntries);
  return items.map((entry) => entry.item);
}

function matchesCountryFilter(
  item: AdminCountryItem,
  filter: AdminCountryQuery["filter"],
): boolean {
  if (filter === "visible") return item.isVisible;
  if (filter === "hidden") return !item.isVisible;
  if (filter === "featured") return item.isFeatured;
  return true;
}

function compareAdminCountryEntries(
  a: { item: AdminCountryItem; source: CountryRow },
  b: { item: AdminCountryItem; source: CountryRow },
) {
  if (a.source.is_featured !== b.source.is_featured) {
    return Number(b.source.is_featured) - Number(a.source.is_featured);
  }
  if (a.source.sort_order !== b.source.sort_order) {
    return a.source.sort_order - b.source.sort_order;
  }
  return a.item.displayName.localeCompare(b.item.displayName);
}

function normalizeNullableText(value: string | null): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
