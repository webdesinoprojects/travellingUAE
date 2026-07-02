-- Airhub eSIM foundation.
--
-- Safe foundation only:
-- - local country list
-- - short-lived plan cache
-- - eSIM order shell for Stripe checkout and future guarded fulfillment
--
-- NOT applied by Codex.

create table if not exists public.airhub_countries (
  id uuid primary key default gen_random_uuid(),
  iso_code text not null unique,
  name text not null,
  region_name text,
  airhub_code text,
  flag_url text,
  global_flag_url text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists airhub_countries_name_idx
  on public.airhub_countries (lower(name));

create index if not exists airhub_countries_region_idx
  on public.airhub_countries (region_name)
  where region_name is not null;

create table if not exists public.airhub_plan_cache (
  id uuid primary key default gen_random_uuid(),
  country_code text,
  flag integer not null,
  request_hash text not null unique,
  plans jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists airhub_plan_cache_country_flag_idx
  on public.airhub_plan_cache (country_code, flag, expires_at);

create table if not exists public.esim_orders (
  id uuid primary key default gen_random_uuid(),
  public_reference text not null unique,
  lookup_token_hash text unique,
  user_id uuid references auth.users(id) on delete set null,

  guest_name text,
  guest_email text not null,
  guest_phone text,

  provider text not null default 'airhub',
  partner_code text not null,
  unique_order_id text unique,
  provider_order_id text,

  plan_code text not null,
  plan_name text,
  country_code text,
  country_name text,
  price numeric(12,2),
  currency text,
  travel_date date,

  activation_code text,
  lpa_code text,
  apn text,
  sim_id text,
  sim_pin text,
  qr_payload text,

  status text not null check (status in (
    'draft',
    'payment_pending',
    'paid',
    'purchase_started',
    'fulfilled',
    'purchase_failed',
    'pending_review',
    'expired',
    'cancelled'
  )),

  stripe_checkout_claim_id text unique,
  stripe_checkout_claimed_at timestamptz,
  stripe_checkout_session_id text unique,
  stripe_checkout_url text,
  stripe_payment_intent_id text,
  stripe_completed_event_id text unique,
  paid_amount numeric(12,2),
  paid_currency text,
  paid_at timestamptz,

  provider_response jsonb,
  error_code text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists esim_orders_lookup_token_hash_idx
  on public.esim_orders (lookup_token_hash)
  where lookup_token_hash is not null;

create index if not exists esim_orders_status_idx
  on public.esim_orders (status, created_at desc);

create index if not exists esim_orders_stripe_session_idx
  on public.esim_orders (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index if not exists esim_orders_unique_order_id_idx
  on public.esim_orders (unique_order_id)
  where unique_order_id is not null;

create index if not exists esim_orders_provider_order_id_idx
  on public.esim_orders (provider_order_id)
  where provider_order_id is not null;

drop trigger if exists set_airhub_countries_updated_at
  on public.airhub_countries;

create trigger set_airhub_countries_updated_at
  before update on public.airhub_countries
  for each row execute function public.set_updated_at();

drop trigger if exists set_esim_orders_updated_at
  on public.esim_orders;

create trigger set_esim_orders_updated_at
  before update on public.esim_orders
  for each row execute function public.set_updated_at();

alter table public.airhub_countries enable row level security;
alter table public.airhub_plan_cache enable row level security;
alter table public.esim_orders enable row level security;

drop policy if exists "airhub countries public read"
  on public.airhub_countries;
create policy "airhub countries public read"
  on public.airhub_countries for select
  using (true);

drop policy if exists "airhub countries editor manage"
  on public.airhub_countries;
create policy "airhub countries editor manage"
  on public.airhub_countries for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

drop policy if exists "airhub plan cache editor read"
  on public.airhub_plan_cache;
create policy "airhub plan cache editor read"
  on public.airhub_plan_cache for select
  using (public.is_editor_or_admin());

drop policy if exists "esim orders editor read"
  on public.esim_orders;
create policy "esim orders editor read"
  on public.esim_orders for select
  using (public.is_editor_or_admin());
