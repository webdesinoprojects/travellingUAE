create table if not exists public.provider_hotel_content (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.external_providers(id) on delete cascade,
  hotel_id text not null,
  hid bigint,
  region_id bigint,
  language text not null default 'en',
  name text not null,
  address text,
  star_rating numeric(2,1),
  latitude numeric(10,7),
  longitude numeric(10,7),
  primary_image_url text,
  image_urls jsonb not null default '[]'::jsonb,
  amenities jsonb not null default '[]'::jsonb,
  policies jsonb not null default '{}'::jsonb,
  description text,
  provider_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, hotel_id, language),
  check (language ~ '^[a-z]{2}(_[A-Z]{2})?$'),
  check (jsonb_typeof(image_urls) = 'array'),
  check (jsonb_typeof(amenities) = 'array'),
  check (jsonb_typeof(policies) = 'object')
);

create index if not exists provider_hotel_content_region_idx
  on public.provider_hotel_content(provider_id, region_id, language);
create index if not exists provider_hotel_content_hid_idx
  on public.provider_hotel_content(provider_id, hid);
create index if not exists provider_hotel_content_name_idx
  on public.provider_hotel_content(provider_id, lower(name) text_pattern_ops);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_provider_hotel_content_updated_at'
  ) then
    create trigger set_provider_hotel_content_updated_at
      before update on public.provider_hotel_content
      for each row execute function public.set_updated_at();
  end if;
end;
$$;

alter table public.provider_hotel_content enable row level security;

drop policy if exists "provider hotel content admin read"
  on public.provider_hotel_content;
create policy "provider hotel content admin read"
  on public.provider_hotel_content for select
  using (public.is_editor_or_admin());

create table if not exists public.provider_content_sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.external_providers(id) on delete cascade,
  sync_type text not null check (sync_type in ('full', 'incremental')),
  language text not null default 'en',
  status text not null check (status in ('running', 'completed', 'failed')),
  records_processed bigint not null default 0,
  provider_last_update timestamptz,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_code text
);

alter table public.provider_content_sync_runs enable row level security;
drop policy if exists "provider content sync admin read"
  on public.provider_content_sync_runs;
create policy "provider content sync admin read"
  on public.provider_content_sync_runs for select
  using (public.is_editor_or_admin());
