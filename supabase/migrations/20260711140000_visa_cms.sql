-- Visa CMS: admin-editable Global + Gulf visa destinations.
--
-- Public visa pages currently render from the static file src/data/visa.ts.
-- This adds a DB source that the public loader prefers WHEN rows exist, and
-- falls back to the static file otherwise, so deploys stay safe before content
-- is migrated. No existing data is touched; this is additive only.
--
-- NOT applied automatically. Apply manually before deploying the CMS code:
--   supabase db push   (or run this SQL in the Supabase SQL editor)

create table if not exists public.visa_destinations (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('global', 'gulf')),
  slug text not null,
  name text not null,
  title text,
  subtitle text,
  hero_image_url text,
  hero_image_alt text,
  card_image_url text,
  card_image_alt text,
  starting_price numeric,
  currency text not null default 'INR',
  processing_time text,
  stay_period text,
  validity text,
  entry_type text,
  is_featured boolean not null default false,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  visa_types jsonb not null default '[]'::jsonb,
  documents jsonb not null default '[]'::jsonb,
  process_steps jsonb not null default '[]'::jsonb,
  why_choose jsonb not null default '[]'::jsonb,
  faqs jsonb not null default '[]'::jsonb,
  process_image_url text,
  process_image_alt text,
  sample_visa_image_url text,
  sample_visa_image_alt text,
  seo_title text,
  seo_description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category, slug)
);

create index if not exists visa_destinations_category_idx
  on public.visa_destinations (category);

create index if not exists visa_destinations_published_idx
  on public.visa_destinations (is_published);

create index if not exists visa_destinations_sort_idx
  on public.visa_destinations (category, sort_order);

-- updated_at trigger (reuses the shared project function).
drop trigger if exists set_visa_destinations_updated_at on public.visa_destinations;
create trigger set_visa_destinations_updated_at
  before update on public.visa_destinations
  for each row execute function public.set_updated_at();

alter table public.visa_destinations enable row level security;

-- Public pages read published visa content through the service-role server
-- loader (RLS is bypassed there), and admins read/write through the service-role
-- admin client. Editors/admins additionally get a direct read policy for admin
-- tooling; there is no anon policy, matching the other admin-managed CMS tables.
drop policy if exists "visa destinations editor read" on public.visa_destinations;
create policy "visa destinations editor read"
  on public.visa_destinations for select
  using (public.is_editor_or_admin());
