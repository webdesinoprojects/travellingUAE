create table if not exists public.hotel_search_sessions (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.external_providers(id) on delete restrict,
  destination_id uuid not null references public.destinations(id) on delete restrict,
  session_token_hash text not null unique check (length(session_token_hash) = 64),
  request_hash text not null check (length(request_hash) = 64),
  checkin date not null,
  checkout date not null,
  residency text not null check (residency ~ '^[a-z]{2}$'),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  language text not null default 'en' check (language ~ '^[a-z]{2}$'),
  guests jsonb not null,
  status text not null default 'searching'
    check (status in ('searching', 'ready', 'failed', 'expired', 'converted')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (checkout > checkin),
  check (jsonb_typeof(guests) = 'array')
);

create index if not exists hotel_search_sessions_destination_idx
  on public.hotel_search_sessions(destination_id, created_at desc);

create index if not exists hotel_search_sessions_expiry_idx
  on public.hotel_search_sessions(status, expires_at);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_hotel_search_sessions_updated_at'
  ) then
    create trigger set_hotel_search_sessions_updated_at
      before update on public.hotel_search_sessions
      for each row execute function public.set_updated_at();
  end if;
end;
$$;

alter table public.hotel_search_sessions enable row level security;

drop policy if exists "hotel search sessions admin read"
  on public.hotel_search_sessions;

create policy "hotel search sessions admin read"
  on public.hotel_search_sessions for select
  using (public.is_editor_or_admin());

alter table public.provider_quote_snapshots
  add column if not exists search_session_id uuid
  references public.hotel_search_sessions(id) on delete cascade;

create index if not exists provider_quote_snapshots_search_session_idx
  on public.provider_quote_snapshots(search_session_id, status, expires_at);
