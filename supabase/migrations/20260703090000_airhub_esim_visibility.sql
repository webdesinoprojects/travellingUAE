-- Airhub eSIM visibility controls (Phase 1B).
--
-- Adds admin-managed visibility/feature/ordering controls for eSIM countries
-- and plans WITHOUT weakening existing RLS. Public-safe country controls live
-- as columns on airhub_countries (one row per country). Plan controls live in a
-- dedicated airhub_plan_controls table keyed by (provider, country_code,
-- plan_code), because airhub_plan_cache stores one JSONB array of many plans per
-- request and therefore cannot express per-plan state.
--
-- Admin controls are preserved automatically across provider refreshes: the
-- country sync and plan-cache upserts only write provider columns, and plan
-- controls are a separate table the cache never touches.
--
-- NOT applied by Codex. This migration MUST be applied before the Phase 1B code
-- is deployed, or the public eSIM flow will error on the new columns.

-- ---- Country controls (columns on the existing per-country table) ----------

alter table public.airhub_countries
  add column if not exists is_visible boolean not null default true,
  add column if not exists is_featured boolean not null default false,
  add column if not exists display_name_override text,
  add column if not exists sort_order integer not null default 0;

create index if not exists airhub_countries_visibility_idx
  on public.airhub_countries (is_visible, is_featured, sort_order);

-- ---- Plan controls (separate table; airhub_plan_cache stays raw cache) ------
-- Internal note/reason fields live here, not on airhub_countries, because
-- airhub_countries has existing public read RLS.

create table if not exists public.airhub_plan_controls (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'airhub',
  country_code text not null,
  plan_code text not null,
  plan_name_snapshot text,
  is_visible boolean not null default true,
  is_featured boolean not null default false,
  disabled_reason text,
  admin_note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, country_code, plan_code)
);

create index if not exists airhub_plan_controls_country_idx
  on public.airhub_plan_controls (provider, country_code);

drop trigger if exists set_airhub_plan_controls_updated_at
  on public.airhub_plan_controls;

create trigger set_airhub_plan_controls_updated_at
  before update on public.airhub_plan_controls
  for each row execute function public.set_updated_at();

-- Admin-only. No public read policy: the public flow reads plan controls through
-- the service-role server client, so admin_note/disabled_reason are never exposed
-- to anon clients.
alter table public.airhub_plan_controls enable row level security;

drop policy if exists "airhub plan controls editor manage"
  on public.airhub_plan_controls;
create policy "airhub plan controls editor manage"
  on public.airhub_plan_controls for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());
