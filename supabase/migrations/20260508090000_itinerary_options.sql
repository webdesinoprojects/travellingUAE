create type public.provider_service_type as enum (
  'flight',
  'hotel',
  'transfer',
  'activity',
  'media',
  'email',
  'transport'
);

create type public.itinerary_segment_type as enum (
  'flight',
  'transfer',
  'hotel',
  'activity',
  'stay',
  'note'
);

create type public.itinerary_direction as enum (
  'outbound',
  'return',
  'local'
);

create type public.quote_status as enum (
  'available',
  'selected',
  'expired',
  'unavailable'
);

create type public.option_session_status as enum (
  'draft',
  'submitted',
  'expired',
  'converted'
);

create type public.segment_option_type as enum (
  'flight',
  'hotel',
  'transfer',
  'activity'
);

create table public.external_providers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  service_type public.provider_service_type not null,
  base_url text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.provider_quote_snapshots (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.external_providers(id) on delete set null,
  service_type public.provider_service_type not null,
  request_hash text not null,
  provider_reference text,
  currency text not null default 'SAR',
  price_amount numeric(12,2),
  price_delta_amount numeric(12,2) not null default 0,
  expires_at timestamptz,
  status public.quote_status not null default 'available',
  safe_payload jsonb not null default '{}'::jsonb,
  payload_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_itinerary_segments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  segment_type public.itinerary_segment_type not null,
  direction public.itinerary_direction not null default 'local',
  title text not null,
  subtitle text,
  description text,
  day_offset integer not null default 0 check (day_offset >= 0),
  start_time time,
  end_time time,
  origin_label text,
  origin_iata text,
  destination_label text,
  destination_iata text,
  location_label text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  map_zoom integer not null default 12,
  is_required boolean not null default true,
  is_changeable boolean not null default true,
  status public.publish_status not null default 'draft',
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_flight_options (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  segment_id uuid not null references public.trip_itinerary_segments(id) on delete cascade,
  provider_id uuid references public.external_providers(id) on delete set null,
  quote_snapshot_id uuid references public.provider_quote_snapshots(id) on delete set null,
  title text,
  airline_name text not null,
  airline_code text,
  airline_logo_url text,
  flight_number text,
  origin_iata text,
  origin_label text not null,
  destination_iata text,
  destination_label text not null,
  departure_at timestamptz,
  arrival_at timestamptz,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  stops_count integer not null default 0 check (stops_count >= 0),
  layover_airports text[] not null default '{}'::text[],
  cabin text,
  fare_class text,
  baggage_label text,
  price_delta_amount numeric(12,2) not null default 0,
  currency text not null default 'SAR',
  is_default boolean not null default false,
  is_refundable boolean,
  status public.quote_status not null default 'available',
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_hotel_options (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  segment_id uuid not null references public.trip_itinerary_segments(id) on delete cascade,
  provider_id uuid references public.external_providers(id) on delete set null,
  quote_snapshot_id uuid references public.provider_quote_snapshots(id) on delete set null,
  hotel_name text not null,
  address text,
  star_rating numeric(2,1) check (star_rating is null or star_rating between 0 and 5),
  room_name text,
  board_basis text,
  check_in_day_offset integer not null default 0 check (check_in_day_offset >= 0),
  check_out_day_offset integer not null default 1 check (check_out_day_offset > check_in_day_offset),
  nights integer not null default 1 check (nights > 0),
  latitude numeric(10,7),
  longitude numeric(10,7),
  image_media_id uuid references public.media_assets(id) on delete set null,
  image_url text,
  guest_rating numeric(3,1) check (guest_rating is null or guest_rating between 0 and 10),
  amenities text[] not null default '{}'::text[],
  price_delta_amount numeric(12,2) not null default 0,
  currency text not null default 'SAR',
  is_default boolean not null default false,
  status public.quote_status not null default 'available',
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_transfer_options (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  segment_id uuid not null references public.trip_itinerary_segments(id) on delete cascade,
  provider_id uuid references public.external_providers(id) on delete set null,
  quote_snapshot_id uuid references public.provider_quote_snapshots(id) on delete set null,
  title text not null,
  pickup_label text not null,
  dropoff_label text not null,
  vehicle_type text not null,
  vehicle_image_url text,
  luggage_count integer check (luggage_count is null or luggage_count >= 0),
  pax_min integer not null default 1 check (pax_min > 0),
  pax_max integer not null default 1 check (pax_max >= pax_min),
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  price_delta_amount numeric(12,2) not null default 0,
  currency text not null default 'SAR',
  is_default boolean not null default false,
  status public.quote_status not null default 'available',
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_activity_options (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  segment_id uuid not null references public.trip_itinerary_segments(id) on delete cascade,
  provider_id uuid references public.external_providers(id) on delete set null,
  quote_snapshot_id uuid references public.provider_quote_snapshots(id) on delete set null,
  title text not null,
  description text,
  category text,
  day_offset integer not null default 0 check (day_offset >= 0),
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  pickup_included boolean not null default false,
  location_label text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  image_media_id uuid references public.media_assets(id) on delete set null,
  image_url text,
  price_delta_amount numeric(12,2) not null default 0,
  currency text not null default 'SAR',
  is_default boolean not null default false,
  status public.quote_status not null default 'available',
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_option_selection_sessions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  session_token_hash text not null unique,
  status public.option_session_status not null default 'draft',
  travelers_count integer not null default 1 check (travelers_count > 0),
  travel_date date,
  currency text not null default 'SAR',
  total_delta_amount numeric(12,2) not null default 0,
  expires_at timestamptz not null default (now() + interval '45 minutes'),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_option_selections (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.trip_option_selection_sessions(id) on delete cascade,
  segment_id uuid not null references public.trip_itinerary_segments(id) on delete cascade,
  option_type public.segment_option_type not null,
  flight_option_id uuid references public.trip_flight_options(id) on delete restrict,
  hotel_option_id uuid references public.trip_hotel_options(id) on delete restrict,
  transfer_option_id uuid references public.trip_transfer_options(id) on delete restrict,
  activity_option_id uuid references public.trip_activity_options(id) on delete restrict,
  price_delta_amount numeric(12,2) not null default 0,
  currency text not null default 'SAR',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, segment_id),
  check (
    (
      option_type = 'flight'::public.segment_option_type
      and flight_option_id is not null
      and hotel_option_id is null
      and transfer_option_id is null
      and activity_option_id is null
    )
    or (
      option_type = 'hotel'::public.segment_option_type
      and hotel_option_id is not null
      and flight_option_id is null
      and transfer_option_id is null
      and activity_option_id is null
    )
    or (
      option_type = 'transfer'::public.segment_option_type
      and transfer_option_id is not null
      and flight_option_id is null
      and hotel_option_id is null
      and activity_option_id is null
    )
    or (
      option_type = 'activity'::public.segment_option_type
      and activity_option_id is not null
      and flight_option_id is null
      and hotel_option_id is null
      and transfer_option_id is null
    )
  )
);

alter table public.bookings
  add column option_session_id uuid references public.trip_option_selection_sessions(id) on delete set null;

create index external_providers_service_active_idx on public.external_providers(service_type, is_active);
create index provider_quote_snapshots_service_hash_idx on public.provider_quote_snapshots(service_type, request_hash);
create index provider_quote_snapshots_expiry_idx on public.provider_quote_snapshots(status, expires_at);
create index trip_itinerary_segments_trip_sort_idx on public.trip_itinerary_segments(trip_id, status, sort_order);
create index trip_itinerary_segments_type_idx on public.trip_itinerary_segments(segment_type, direction);
create index trip_flight_options_segment_status_idx on public.trip_flight_options(segment_id, status, price_delta_amount);
create index trip_flight_options_filters_idx on public.trip_flight_options(stops_count, airline_code, departure_at, arrival_at);
create index trip_flight_options_layover_idx on public.trip_flight_options using gin(layover_airports);
create index trip_hotel_options_segment_status_idx on public.trip_hotel_options(segment_id, status, price_delta_amount);
create index trip_hotel_options_filters_idx on public.trip_hotel_options(star_rating, guest_rating);
create index trip_transfer_options_segment_status_idx on public.trip_transfer_options(segment_id, status, price_delta_amount);
create index trip_transfer_options_vehicle_idx on public.trip_transfer_options(vehicle_type, pax_min, pax_max);
create index trip_activity_options_segment_status_idx on public.trip_activity_options(segment_id, status, price_delta_amount);
create index trip_activity_options_filters_idx on public.trip_activity_options(day_offset, category, pickup_included);
create index trip_option_selection_sessions_trip_status_idx on public.trip_option_selection_sessions(trip_id, status, expires_at);
create index trip_option_selections_session_idx on public.trip_option_selections(session_id, option_type);
create index bookings_option_session_idx on public.bookings(option_session_id);

create trigger set_external_providers_updated_at before update on public.external_providers for each row execute function public.set_updated_at();
create trigger set_provider_quote_snapshots_updated_at before update on public.provider_quote_snapshots for each row execute function public.set_updated_at();
create trigger set_trip_itinerary_segments_updated_at before update on public.trip_itinerary_segments for each row execute function public.set_updated_at();
create trigger set_trip_flight_options_updated_at before update on public.trip_flight_options for each row execute function public.set_updated_at();
create trigger set_trip_hotel_options_updated_at before update on public.trip_hotel_options for each row execute function public.set_updated_at();
create trigger set_trip_transfer_options_updated_at before update on public.trip_transfer_options for each row execute function public.set_updated_at();
create trigger set_trip_activity_options_updated_at before update on public.trip_activity_options for each row execute function public.set_updated_at();
create trigger set_trip_option_selection_sessions_updated_at before update on public.trip_option_selection_sessions for each row execute function public.set_updated_at();
create trigger set_trip_option_selections_updated_at before update on public.trip_option_selections for each row execute function public.set_updated_at();

alter table public.external_providers enable row level security;
alter table public.provider_quote_snapshots enable row level security;
alter table public.trip_itinerary_segments enable row level security;
alter table public.trip_flight_options enable row level security;
alter table public.trip_hotel_options enable row level security;
alter table public.trip_transfer_options enable row level security;
alter table public.trip_activity_options enable row level security;
alter table public.trip_option_selection_sessions enable row level security;
alter table public.trip_option_selections enable row level security;

create policy "external_providers admin read"
  on public.external_providers for select
  using (public.is_editor_or_admin());

create policy "external_providers editor manage"
  on public.external_providers for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "provider_quote_snapshots admin read"
  on public.provider_quote_snapshots for select
  using (public.is_editor_or_admin());

create policy "provider_quote_snapshots editor manage"
  on public.provider_quote_snapshots for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "trip_itinerary_segments public read published trips"
  on public.trip_itinerary_segments for select
  using (
    status = 'published'::public.publish_status
    and exists (
      select 1 from public.trips
      where trips.id = trip_itinerary_segments.trip_id
        and trips.status = 'published'::public.publish_status
    )
  );

create policy "trip_itinerary_segments editor manage"
  on public.trip_itinerary_segments for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "trip_flight_options public read published trips"
  on public.trip_flight_options for select
  using (
    status = 'available'::public.quote_status
    and (expires_at is null or expires_at > now())
    and exists (
      select 1 from public.trips
      where trips.id = trip_flight_options.trip_id
        and trips.status = 'published'::public.publish_status
    )
  );

create policy "trip_flight_options editor manage"
  on public.trip_flight_options for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "trip_hotel_options public read published trips"
  on public.trip_hotel_options for select
  using (
    status = 'available'::public.quote_status
    and (expires_at is null or expires_at > now())
    and exists (
      select 1 from public.trips
      where trips.id = trip_hotel_options.trip_id
        and trips.status = 'published'::public.publish_status
    )
  );

create policy "trip_hotel_options editor manage"
  on public.trip_hotel_options for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "trip_transfer_options public read published trips"
  on public.trip_transfer_options for select
  using (
    status = 'available'::public.quote_status
    and (expires_at is null or expires_at > now())
    and exists (
      select 1 from public.trips
      where trips.id = trip_transfer_options.trip_id
        and trips.status = 'published'::public.publish_status
    )
  );

create policy "trip_transfer_options editor manage"
  on public.trip_transfer_options for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "trip_activity_options public read published trips"
  on public.trip_activity_options for select
  using (
    status = 'available'::public.quote_status
    and (expires_at is null or expires_at > now())
    and exists (
      select 1 from public.trips
      where trips.id = trip_activity_options.trip_id
        and trips.status = 'published'::public.publish_status
    )
  );

create policy "trip_activity_options editor manage"
  on public.trip_activity_options for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "trip_option_selection_sessions admin read"
  on public.trip_option_selection_sessions for select
  using (public.is_admin());

create policy "trip_option_selection_sessions admin manage"
  on public.trip_option_selection_sessions for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "trip_option_selections admin read"
  on public.trip_option_selections for select
  using (public.is_admin());

create policy "trip_option_selections admin manage"
  on public.trip_option_selections for all
  using (public.is_admin())
  with check (public.is_admin());
