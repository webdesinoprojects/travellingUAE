alter table public.hotel_search_sessions
  alter column destination_id drop not null;

alter table public.hotel_search_sessions
  add column if not exists external_region_id bigint,
  add column if not exists destination_label text;

update public.hotel_search_sessions as sessions
set external_region_id = mappings.external_region_id,
    destination_label = destinations.name
from public.provider_destination_mappings as mappings
join public.destinations as destinations on destinations.id = mappings.destination_id
where sessions.destination_id = mappings.destination_id
  and sessions.provider_id = mappings.provider_id
  and (sessions.external_region_id is null or sessions.destination_label is null);

alter table public.hotel_search_sessions
  alter column external_region_id set not null,
  alter column destination_label set not null;

alter table public.hotel_search_sessions
  add constraint hotel_search_sessions_external_region_positive
  check (external_region_id > 0);

create index if not exists hotel_search_sessions_provider_region_idx
  on public.hotel_search_sessions(provider_id, external_region_id, created_at desc);
