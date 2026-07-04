import "server-only";

import type {
  AdminPricingCountryOption,
  AdminPricingPageModel,
  AdminPricingPlanOption,
  AdminPricingRule,
  AdminPricingRulePatch,
} from "@/features/admin/esim/pricing-types";
import {
  isEsimRoundingMode,
  type EsimPricingRuleInput,
  type EsimPricingScope,
} from "@/server/esim/pricing-helpers";
import { getSupabaseAdminClient } from "@/server/supabase/client";

const PROVIDER = "airhub";
const MAX_RULE_ROWS = 500;
const MAX_CACHE_ROWS = 500;

const RULE_COLUMNS =
  "id,scope,provider,country_code,plan_code,markup_percent,markup_fixed,min_margin,rounding_mode,is_active,created_at,updated_at";

type PricingRuleRow = {
  id: string;
  scope: string;
  provider: string;
  country_code: string | null;
  plan_code: string | null;
  markup_percent: number | string;
  markup_fixed: number | string;
  min_margin: number | string;
  rounding_mode: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type CountryOptionRow = {
  iso_code: string;
  name: string;
  display_name_override: string | null;
};

type PlanCacheRow = {
  country_code: string | null;
  plans: unknown;
};

export async function readActivePricingRules(): Promise<EsimPricingRuleInput[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("esim_pricing_rules")
    .select(RULE_COLUMNS)
    .eq("provider", PROVIDER)
    .eq("is_active", true)
    .limit(MAX_RULE_ROWS);

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as PricingRuleRow[])
    .map(toPricingRuleInput)
    .filter((rule): rule is EsimPricingRuleInput => rule != null);
}

export async function getAdminPricingPageModel(): Promise<AdminPricingPageModel> {
  const [rules, countries, plans] = await Promise.all([
    listAdminPricingRules(),
    listCountryOptions(),
    listPlanOptions(),
  ]);

  return { rules, countries, plans };
}

export async function savePricingRule(patch: AdminPricingRulePatch): Promise<void> {
  const normalized = normalizeRulePatch(patch);
  const supabase = getSupabaseAdminClient();

  let match = supabase
    .from("esim_pricing_rules")
    .select("id")
    .eq("provider", PROVIDER)
    .eq("scope", normalized.scope);

  if (normalized.scope === "global") {
    match = match.is("country_code", null).is("plan_code", null);
  } else if (normalized.scope === "country") {
    match = match.eq("country_code", normalized.countryCode!).is("plan_code", null);
  } else {
    match = match
      .eq("country_code", normalized.countryCode!)
      .eq("plan_code", normalized.planCode!);
  }

  const { data: existing, error: readError } = await match
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (readError) {
    throw readError;
  }

  const row = {
    provider: PROVIDER,
    scope: normalized.scope,
    country_code: normalized.countryCode,
    plan_code: normalized.planCode,
    markup_percent: normalized.markupPercent,
    markup_fixed: normalized.markupFixed,
    min_margin: normalized.minMargin,
    rounding_mode: normalized.roundingMode,
    is_active: normalized.isActive,
  };

  const existingId = (existing as { id?: string } | null)?.id;
  const result = existingId
    ? await supabase.from("esim_pricing_rules").update(row).eq("id", existingId)
    : await supabase.from("esim_pricing_rules").insert(row);

  if (result.error) {
    throw result.error;
  }
}

async function listAdminPricingRules(): Promise<AdminPricingRule[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("esim_pricing_rules")
    .select(RULE_COLUMNS)
    .eq("provider", PROVIDER)
    .order("scope", { ascending: true })
    .order("country_code", { ascending: true })
    .order("plan_code", { ascending: true })
    .limit(MAX_RULE_ROWS);

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as PricingRuleRow[])
    .map(toAdminPricingRule)
    .filter((rule): rule is AdminPricingRule => rule != null);
}

async function listCountryOptions(): Promise<AdminPricingCountryOption[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("airhub_countries")
    .select("iso_code,name,display_name_override")
    .order("name", { ascending: true })
    .limit(300);

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as CountryOptionRow[]).map((row) => ({
    isoCode: row.iso_code,
    name: row.display_name_override?.trim() || row.name,
  }));
}

async function listPlanOptions(): Promise<AdminPricingPlanOption[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("airhub_plan_cache")
    .select("country_code,plans")
    .limit(MAX_CACHE_ROWS);

  if (error) {
    throw error;
  }

  return flattenPlanOptions((data ?? []) as unknown as PlanCacheRow[]);
}

function flattenPlanOptions(rows: PlanCacheRow[]): AdminPricingPlanOption[] {
  const seen = new Set<string>();
  const items: AdminPricingPlanOption[] = [];

  for (const row of rows) {
    const countryCode = row.country_code?.trim().toUpperCase();
    if (!countryCode || !Array.isArray(row.plans)) continue;

    for (const entry of row.plans) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const record = entry as Record<string, unknown>;
      const planCode = readString(record.planCode);
      if (!planCode) continue;

      const key = `${countryCode}::${planCode.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      items.push({
        countryCode,
        planCode,
        planName: readString(record.planName),
        supplierPrice: readNumber(record.price),
        currency: readString(record.currency),
      });
    }
  }

  return items.sort((a, b) => {
    if (a.countryCode !== b.countryCode) return a.countryCode.localeCompare(b.countryCode);
    return a.planCode.localeCompare(b.planCode);
  });
}

function normalizeRulePatch(patch: AdminPricingRulePatch): AdminPricingRulePatch {
  const scope = patch.scope;
  if (scope !== "global" && scope !== "country" && scope !== "plan") {
    throw new Error("Invalid pricing scope");
  }

  const countryCode =
    scope === "global" ? null : normalizeCountryCode(patch.countryCode ?? "");
  const planCode = scope === "plan" ? normalizePlanCode(patch.planCode ?? "") : null;

  if ((scope === "country" || scope === "plan") && !countryCode) {
    throw new Error("countryCode is required");
  }
  if (scope === "plan" && !planCode) {
    throw new Error("planCode is required");
  }
  if (!isEsimRoundingMode(patch.roundingMode)) {
    throw new Error("roundingMode is invalid");
  }

  return {
    scope,
    countryCode,
    planCode,
    markupPercent: clampMoney(patch.markupPercent, 9999.9999),
    markupFixed: clampMoney(patch.markupFixed, 9999999999.99),
    minMargin: clampMoney(patch.minMargin, 9999999999.99),
    roundingMode: patch.roundingMode,
    isActive: Boolean(patch.isActive),
  };
}

function toPricingRuleInput(row: PricingRuleRow): EsimPricingRuleInput | null {
  const common = toRuleBase(row);
  if (!common) return null;
  return common;
}

function toAdminPricingRule(row: PricingRuleRow): AdminPricingRule | null {
  const common = toRuleBase(row);
  if (!common) return null;
  return {
    ...common,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRuleBase(row: PricingRuleRow): EsimPricingRuleInput | null {
  if (!isPricingScope(row.scope) || !isEsimRoundingMode(row.rounding_mode)) {
    return null;
  }

  return {
    id: row.id,
    scope: row.scope,
    provider: row.provider,
    countryCode: row.country_code,
    planCode: row.plan_code,
    markupPercent: toNumber(row.markup_percent),
    markupFixed: toNumber(row.markup_fixed),
    minMargin: toNumber(row.min_margin),
    roundingMode: row.rounding_mode,
    isActive: row.is_active,
  };
}

function isPricingScope(value: string): value is EsimPricingScope {
  return value === "global" || value === "country" || value === "plan";
}

function normalizeCountryCode(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

function normalizePlanCode(value: string): string | null {
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 120 ? normalized : null;
}

function clampMoney(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), max);
}

function toNumber(value: number | string): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function readString(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
