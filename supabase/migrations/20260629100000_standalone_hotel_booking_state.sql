-- Standalone hotel booking state.
--
-- This table keeps the standalone hotel flow independent from trip package
-- option sessions while reusing the shared bookings/provider state columns for
-- Stripe, ETG finish/status, admin support, and ETG webhook reconciliation.
--
-- No provider hashes are exposed by RLS. h-* and p-* hashes stay in
-- provider_quote_snapshots.metadata; this table stores only internal snapshot
-- ids plus sanitized booking/form payment options.
--
-- NOT applied by Codex.

create table if not exists public.standalone_hotel_booking_sessions (
  id uuid primary key default gen_random_uuid(),
  search_session_id uuid not null references public.hotel_search_sessions(id) on delete cascade,
  provider_id uuid references public.external_providers(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  hotelpage_quote_id uuid references public.provider_quote_snapshots(id) on delete set null,
  prebook_snapshot_id uuid references public.provider_quote_snapshots(id) on delete set null,

  checkout_token_hash text not null unique check (length(checkout_token_hash) = 64),
  hotel_id text not null,
  hotel_name text not null,
  room_name text,
  board_basis text,
  checkin date not null,
  checkout date not null,
  residency text not null,
  guests jsonb not null check (jsonb_typeof(guests) = 'array'),
  language text not null default 'en',

  status text not null check (status in (
    'form_created',
    'unsupported_payment',
    'payment_pending',
    'finish_started',
    'processing',
    'confirmed',
    'failed',
    'pending_review',
    'expired'
  )),

  price_at_hotelpage numeric(12,2),
  price_at_prebook numeric(12,2),
  currency text not null,
  price_changed boolean not null default false,
  cancellation_summary text,
  cancellation_free_before timestamptz,

  partner_order_id text not null unique,
  provider_order_id text,
  provider_order_item_id text,
  payment_types jsonb not null default '[]'::jsonb,
  selected_payment_type jsonb,
  is_gender_specification_required boolean not null default false,
  supplier_data_requirements jsonb,
  upsell_data jsonb,

  user_ip text,
  contact jsonb,
  guest_rooms jsonb,

  stripe_checkout_claim_id text unique,
  stripe_checkout_claimed_at timestamptz,
  stripe_checkout_session_id text unique,
  stripe_checkout_url text,
  stripe_payment_intent_id text,
  stripe_completed_event_id text unique,
  paid_amount numeric,
  paid_currency text,
  paid_at timestamptz,

  booking_cutoff_at timestamptz,
  finish_started_at timestamptz,
  finish_status_last_checked_at timestamptz,
  finish_status_poll_count integer not null default 0,
  provider_result_code text,
  confirmed_at timestamptz,
  failed_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists standalone_hotel_booking_sessions_search_idx
  on public.standalone_hotel_booking_sessions(search_session_id, created_at desc);

create index if not exists standalone_hotel_booking_sessions_booking_idx
  on public.standalone_hotel_booking_sessions(booking_id)
  where booking_id is not null;

create index if not exists standalone_hotel_booking_sessions_status_idx
  on public.standalone_hotel_booking_sessions(status, expires_at);

create index if not exists standalone_hotel_booking_sessions_partner_idx
  on public.standalone_hotel_booking_sessions(partner_order_id);

drop trigger if exists set_standalone_hotel_booking_sessions_updated_at
  on public.standalone_hotel_booking_sessions;

create trigger set_standalone_hotel_booking_sessions_updated_at
  before update on public.standalone_hotel_booking_sessions
  for each row execute function public.set_updated_at();

alter table public.standalone_hotel_booking_sessions enable row level security;

drop policy if exists "standalone hotel booking sessions editor read"
  on public.standalone_hotel_booking_sessions;
create policy "standalone hotel booking sessions editor read"
  on public.standalone_hotel_booking_sessions for select
  using (public.is_editor_or_admin());
