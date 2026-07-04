-- eSIM pricing / markup controls (Phase 2A).
--
-- Adds admin-managed pricing rules without exposing them publicly. Public eSIM
-- pages and checkout read pricing only through the server/service-role path.
--
-- NOT applied by Codex. Apply this migration before deploying Phase 2A code.

create table if not exists public.esim_pricing_rules (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('global', 'country', 'plan')),
  provider text not null default 'airhub',
  country_code text,
  plan_code text,
  markup_percent numeric(8,4) not null default 0 check (markup_percent >= 0),
  markup_fixed numeric(12,2) not null default 0 check (markup_fixed >= 0),
  min_margin numeric(12,2) not null default 0 check (min_margin >= 0),
  rounding_mode text not null default 'none'
    check (rounding_mode in ('none', 'nearest_0_99', 'nearest_0_49', 'whole')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint esim_pricing_rules_shape_check check (
    (scope = 'global' and country_code is null and plan_code is null)
    or (scope = 'country' and country_code is not null and plan_code is null)
    or (scope = 'plan' and country_code is not null and plan_code is not null)
  )
);

create unique index if not exists esim_pricing_rules_global_active_uidx
  on public.esim_pricing_rules (provider)
  where is_active and scope = 'global';

create unique index if not exists esim_pricing_rules_country_active_uidx
  on public.esim_pricing_rules (provider, country_code)
  where is_active and scope = 'country';

create unique index if not exists esim_pricing_rules_plan_active_uidx
  on public.esim_pricing_rules (provider, country_code, plan_code)
  where is_active and scope = 'plan';

create index if not exists esim_pricing_rules_lookup_idx
  on public.esim_pricing_rules (provider, scope, country_code, plan_code);

drop trigger if exists set_esim_pricing_rules_updated_at
  on public.esim_pricing_rules;

create trigger set_esim_pricing_rules_updated_at
  before update on public.esim_pricing_rules
  for each row execute function public.set_updated_at();

alter table public.esim_pricing_rules enable row level security;

drop policy if exists "esim pricing rules editor manage"
  on public.esim_pricing_rules;
create policy "esim pricing rules editor manage"
  on public.esim_pricing_rules for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

alter table public.esim_orders
  add column if not exists supplier_price numeric(12,2),
  add column if not exists supplier_currency text,
  add column if not exists markup_amount numeric(12,2),
  add column if not exists pricing_rule_id uuid references public.esim_pricing_rules(id) on delete set null;
