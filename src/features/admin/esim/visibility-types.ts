/**
 * Admin DTOs for eSIM country/plan visibility controls.
 *
 * Admin plan DTOs intentionally include admin-only fields (admin_note,
 * disabled_reason) from the admin-only plan controls table. Country DTOs do not
 * carry those fields because airhub_countries has public read RLS.
 */

export type EsimVisibilityFilter = "all" | "visible" | "hidden" | "featured";

export type AdminCountryItem = {
  isoCode: string;
  providerName: string;
  displayName: string;
  displayNameOverride: string | null;
  flagUrl: string | null;
  regionName: string | null;
  isVisible: boolean;
  isFeatured: boolean;
  sortOrder: number;
  syncedAt: string;
  updatedAt: string;
};

export type CountryControlPatch = {
  isVisible?: boolean;
  isFeatured?: boolean;
  displayNameOverride?: string | null;
  sortOrder?: number;
};

export type AdminCountryQuery = {
  filter: EsimVisibilityFilter;
  search: string;
  page: number;
  pageSize: number;
};

export type AdminCountryListResult = {
  items: AdminCountryItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type AdminPlanItem = {
  countryCode: string;
  planCode: string;
  planName: string | null;
  price: number | null;
  currency: string | null;
  isVisible: boolean;
  isFeatured: boolean;
  sortOrder: number;
  disabledReason: string | null;
  adminNote: string | null;
  hasControl: boolean;
};

export type PlanControlPatch = {
  isVisible?: boolean;
  isFeatured?: boolean;
  disabledReason?: string | null;
  adminNote?: string | null;
  sortOrder?: number;
};

export type AdminPlanQuery = {
  filter: EsimVisibilityFilter;
  countryCode: string | "all";
  search: string;
  page: number;
  pageSize: number;
};

export type AdminPlanListResult = {
  items: AdminPlanItem[];
  countries: string[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};
