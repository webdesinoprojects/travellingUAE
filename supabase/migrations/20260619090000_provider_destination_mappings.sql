create table if not exists public.provider_destination_mappings (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.external_providers(id) on delete cascade,
  destination_id uuid not null references public.destinations(id) on delete cascade,
  external_region_id bigint not null check (external_region_id > 0),
  status public.publish_status not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, destination_id)
);

create index if not exists provider_destination_mappings_region_idx
  on public.provider_destination_mappings(provider_id, external_region_id)
  where status = 'published'::public.publish_status;

create index if not exists provider_destination_mappings_destination_idx
  on public.provider_destination_mappings(destination_id, status);

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_provider_destination_mappings_updated_at'
  ) then
    create trigger set_provider_destination_mappings_updated_at
      before update on public.provider_destination_mappings
      for each row execute function public.set_updated_at();
  end if;
end;
$$;

alter table public.provider_destination_mappings enable row level security;

drop policy if exists "provider destination mappings editor manage"
  on public.provider_destination_mappings;

create policy "provider destination mappings editor manage"
  on public.provider_destination_mappings for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

insert into public.external_providers (
  slug,
  name,
  service_type,
  base_url,
  is_active,
  metadata
)
values (
  'ratehawk-hotel',
  'RateHawk Hotels',
  'hotel',
  'https://api.worldota.net',
  true,
  '{"integration":"affiliate"}'::jsonb
)
on conflict (slug) do update
set name = excluded.name,
    service_type = excluded.service_type,
    base_url = excluded.base_url,
    is_active = excluded.is_active;

insert into public.provider_destination_mappings (
  provider_id,
  destination_id,
  external_region_id,
  status,
  metadata
)
select distinct on (trips.destination_id)
  providers.id,
  trips.destination_id,
  (segments.metadata #>> '{ratehawk,region_id}')::bigint,
  'published'::public.publish_status,
  jsonb_build_object('source', 'trip_segment_backfill')
from public.trip_itinerary_segments as segments
join public.trips as trips on trips.id = segments.trip_id
join public.external_providers as providers on providers.slug = 'ratehawk-hotel'
where segments.segment_type = 'hotel'::public.itinerary_segment_type
  and segments.metadata #>> '{ratehawk,region_id}' ~ '^[1-9][0-9]*$'
order by trips.destination_id, segments.updated_at desc
on conflict (provider_id, destination_id) do update
set external_region_id = excluded.external_region_id,
    status = excluded.status,
    metadata = public.provider_destination_mappings.metadata || excluded.metadata,
    updated_at = now();

create table if not exists public.api_rate_limit_windows (
  bucket_key text not null,
  route_key text not null,
  window_started_at timestamptz not null default now(),
  hits integer not null default 1 check (hits > 0),
  primary key (bucket_key, route_key)
);

create index if not exists api_rate_limit_windows_started_idx
  on public.api_rate_limit_windows(window_started_at);

alter table public.api_rate_limit_windows enable row level security;

create or replace function public.consume_api_rate_limit(
  p_bucket_key text,
  p_route_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_time timestamptz := clock_timestamp();
  current_hits integer;
  current_window timestamptz;
begin
  if length(p_bucket_key) < 8 or length(p_bucket_key) > 128 then
    raise exception 'invalid rate-limit bucket';
  end if;

  if length(p_route_key) < 1 or length(p_route_key) > 80 then
    raise exception 'invalid rate-limit route';
  end if;

  if p_limit < 1 or p_limit > 1000 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate-limit configuration';
  end if;

  insert into public.api_rate_limit_windows (
    bucket_key,
    route_key,
    window_started_at,
    hits
  )
  values (p_bucket_key, p_route_key, current_time, 1)
  on conflict (bucket_key, route_key) do update
  set hits = case
        when api_rate_limit_windows.window_started_at <= current_time - make_interval(secs => p_window_seconds)
          then 1
        else api_rate_limit_windows.hits + 1
      end,
      window_started_at = case
        when api_rate_limit_windows.window_started_at <= current_time - make_interval(secs => p_window_seconds)
          then current_time
        else api_rate_limit_windows.window_started_at
      end
  returning hits, window_started_at into current_hits, current_window;

  return query select
    current_hits <= p_limit,
    greatest(p_limit - current_hits, 0),
    case
      when current_hits <= p_limit then 0
      else greatest(
        ceil(extract(epoch from (current_window + make_interval(secs => p_window_seconds) - current_time)))::integer,
        1
      )
    end;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer)
  to service_role;
