create extension if not exists pg_trgm with schema extensions;

alter table public.provider_hotel_content
  add column if not exists region_name text,
  add column if not exists region_country_code text,
  add column if not exists region_type text;

create table if not exists public.provider_hotel_autocomplete_index (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.external_providers(id) on delete cascade,
  suggestion_type text not null check (suggestion_type in ('country', 'region', 'hotel')),
  label text not null,
  normalized_label text not null,
  source_key text not null,
  country_code text,
  region_id bigint,
  hotel_id text,
  hid bigint,
  language text not null default 'en',
  hotel_count integer not null default 0 check (hotel_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, language, suggestion_type, source_key),
  check (language ~ '^[a-z]{2}(_[A-Z]{2})?$'),
  check (length(label) > 0),
  check (length(normalized_label) > 0),
  check (jsonb_typeof(metadata) = 'object')
);

create index if not exists provider_hotel_autocomplete_provider_language_type_idx
  on public.provider_hotel_autocomplete_index(provider_id, language, suggestion_type);

create index if not exists provider_hotel_autocomplete_prefix_idx
  on public.provider_hotel_autocomplete_index(
    provider_id,
    language,
    suggestion_type,
    normalized_label text_pattern_ops
  );

create index if not exists provider_hotel_autocomplete_label_trgm_idx
  on public.provider_hotel_autocomplete_index
  using gin (normalized_label extensions.gin_trgm_ops);

create index if not exists provider_hotel_autocomplete_country_idx
  on public.provider_hotel_autocomplete_index(provider_id, language, country_code)
  where country_code is not null;

create index if not exists provider_hotel_autocomplete_region_idx
  on public.provider_hotel_autocomplete_index(provider_id, language, region_id)
  where region_id is not null;

create index if not exists provider_hotel_autocomplete_hotel_idx
  on public.provider_hotel_autocomplete_index(provider_id, language, hotel_id)
  where hotel_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_provider_hotel_autocomplete_index_updated_at'
  ) then
    create trigger set_provider_hotel_autocomplete_index_updated_at
      before update on public.provider_hotel_autocomplete_index
      for each row execute function public.set_updated_at();
  end if;
end;
$$;

alter table public.provider_hotel_autocomplete_index enable row level security;

drop policy if exists "provider hotel autocomplete index admin read"
  on public.provider_hotel_autocomplete_index;
create policy "provider hotel autocomplete index admin read"
  on public.provider_hotel_autocomplete_index for select
  using (public.is_editor_or_admin());

create or replace function public.backfill_provider_hotel_content_regions(
  p_provider_id uuid,
  p_language text,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer := 0;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'p_rows must be a JSON array';
  end if;

  with incoming as (
    select distinct on (hotel_id)
      nullif(trim(hotel_id), '') as hotel_id,
      region_id,
      nullif(trim(region_name), '') as region_name,
      nullif(upper(trim(region_country_code)), '') as region_country_code,
      nullif(trim(region_type), '') as region_type
    from jsonb_to_recordset(p_rows) as row(
      hotel_id text,
      region_id bigint,
      region_name text,
      region_country_code text,
      region_type text
    )
    where nullif(trim(hotel_id), '') is not null
    order by hotel_id
  ),
  updated as (
    update public.provider_hotel_content target
       set region_id = coalesce(incoming.region_id, target.region_id),
           region_name = coalesce(incoming.region_name, target.region_name),
           region_country_code = coalesce(incoming.region_country_code, target.region_country_code),
           region_type = coalesce(incoming.region_type, target.region_type),
           synced_at = now()
      from incoming
     where target.provider_id = p_provider_id
       and target.language = p_language
       and target.hotel_id = incoming.hotel_id
    returning 1
  )
  select count(*) into updated_count from updated;

  return updated_count;
end;
$$;

revoke all on function public.backfill_provider_hotel_content_regions(uuid, text, jsonb)
  from public;
grant execute on function public.backfill_provider_hotel_content_regions(uuid, text, jsonb)
  to service_role;
