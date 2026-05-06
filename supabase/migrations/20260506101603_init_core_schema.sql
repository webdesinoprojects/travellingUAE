create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create type public.app_role as enum ('admin', 'editor');
create type public.publish_status as enum ('draft', 'published', 'archived');
create type public.booking_status as enum ('new', 'contacted', 'confirmed', 'cancelled', 'completed');
create type public.media_provider as enum ('cloudinary', 'imagekit', 'external');
create type public.collection_type as enum ('flytime_picks', 'route_board', 'custom');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email extensions.citext not null,
  full_name text,
  role public.app_role not null default 'editor',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_active = true
      and role = 'admin'::public.app_role
  );
$$;

create or replace function public.is_editor_or_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_active = true
      and role in ('admin'::public.app_role, 'editor'::public.app_role)
  );
$$;

create table public.locales (
  code text primary key,
  name text not null,
  direction text not null default 'ltr' check (direction in ('ltr', 'rtl')),
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index locales_one_default_idx
  on public.locales (is_default)
  where is_default = true;

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  provider public.media_provider not null default 'external',
  public_id text,
  url text not null,
  secure_url text,
  alt_text text not null default '',
  resource_type text not null default 'image',
  width integer,
  height integer,
  bytes bigint,
  format text,
  folder text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  status public.publish_status not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  status public.publish_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.destinations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  country text,
  city text,
  search_label text not null default 'Handpicked Holidays',
  result_title text,
  currency text not null default 'SAR',
  package_date date,
  poster_media_id uuid references public.media_assets(id) on delete set null,
  poster_title text,
  poster_price numeric(12,2),
  poster_season text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  map_zoom integer not null default 10,
  status public.publish_status not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  destination_id uuid not null references public.destinations(id) on delete cascade,
  slug text not null,
  title text not null,
  city text,
  summary text,
  overview text,
  badge text,
  duration_days integer not null check (duration_days > 0),
  duration_label text,
  nights integer check (nights is null or nights >= 0),
  has_flights boolean not null default true,
  hotel_star integer check (hotel_star is null or hotel_star between 1 and 5),
  price_amount numeric(12,2) not null check (price_amount >= 0),
  currency text not null default 'SAR',
  start_date date,
  travelers_label text,
  hero_media_id uuid references public.media_assets(id) on delete set null,
  card_media_id uuid references public.media_assets(id) on delete set null,
  latitude numeric(10,7),
  longitude numeric(10,7),
  map_zoom integer not null default 12,
  status public.publish_status not null default 'draft',
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (destination_id, slug)
);

create table public.trip_categories (
  trip_id uuid not null references public.trips(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (trip_id, category_id)
);

create table public.trip_tags (
  trip_id uuid not null references public.trips(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (trip_id, tag_id)
);

create table public.trip_features (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  label text not null,
  icon text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_bullets (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  body text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_highlights (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  body text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_inclusions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  body text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_exclusions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  body text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_terms (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  body text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_gallery (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  media_id uuid references public.media_assets(id) on delete set null,
  src text,
  alt_text text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (media_id is not null or src is not null)
);

create table public.trip_itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null,
  body text not null,
  location_label text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  zoom integer not null default 12,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text,
  body text,
  icon text,
  media_id uuid references public.media_assets(id) on delete set null,
  status public.publish_status not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  eyebrow text,
  description text,
  type public.collection_type not null default 'custom',
  status public.publish_status not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  title text not null,
  subtitle text,
  price_label text,
  duration_label text,
  action_label text,
  href text,
  media_id uuid references public.media_assets(id) on delete set null,
  status public.publish_status not null default 'draft',
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.site_sections (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  title text,
  eyebrow text,
  description text,
  payload jsonb not null default '{}'::jsonb,
  status public.publish_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.navigation_items (
  id uuid primary key default gen_random_uuid(),
  location text not null check (location in ('header', 'footer')),
  parent_id uuid references public.navigation_items(id) on delete cascade,
  label text not null,
  href text not null,
  has_dropdown boolean not null default false,
  status public.publish_status not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.footer_columns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status public.publish_status not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.footer_links (
  id uuid primary key default gen_random_uuid(),
  column_id uuid not null references public.footer_columns(id) on delete cascade,
  label text not null,
  href text not null,
  status public.publish_status not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text,
  body text not null,
  status public.publish_status not null default 'draft',
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  author text not null,
  quote text not null,
  media_id uuid references public.media_assets(id) on delete set null,
  status public.publish_status not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips(id) on delete set null,
  destination_id uuid references public.destinations(id) on delete set null,
  customer_name text not null,
  customer_email extensions.citext not null,
  customer_phone text not null,
  nationality text,
  travelers_count integer not null default 1 check (travelers_count > 0),
  travel_date date,
  message text,
  status public.booking_status not null default 'new',
  admin_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null unique,
  locale_code text references public.locales(code) on delete set null,
  source text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

create table public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email extensions.citext,
  phone text,
  subject text,
  message text not null,
  status public.booking_status not null default 'new',
  admin_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.translations (
  id uuid primary key default gen_random_uuid(),
  locale_code text not null references public.locales(code) on delete cascade,
  namespace text not null,
  translation_key text not null,
  value text not null,
  status public.publish_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (locale_code, namespace, translation_key)
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_table text not null,
  entity_id uuid,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);

create view public.published_destination_cards
with (security_invoker = true)
as
select
  d.id,
  d.slug,
  d.name,
  d.country,
  d.city,
  d.result_title,
  d.currency,
  d.package_date,
  d.poster_title,
  d.poster_price,
  d.poster_season,
  d.sort_order,
  m.url as poster_image_url,
  m.alt_text as poster_image_alt,
  count(t.id) filter (where t.status = 'published'::public.publish_status) as package_count
from public.destinations d
left join public.media_assets m on m.id = d.poster_media_id
left join public.trips t on t.destination_id = d.id
where d.status = 'published'::public.publish_status
group by d.id, m.url, m.alt_text;

create view public.published_trip_cards
with (security_invoker = true)
as
select
  t.id,
  t.destination_id,
  d.slug as destination_slug,
  d.name as destination_name,
  t.slug,
  t.title,
  t.city,
  t.summary,
  t.badge,
  t.duration_days,
  t.duration_label,
  t.has_flights,
  t.hotel_star,
  t.price_amount,
  t.currency,
  t.start_date,
  t.sort_order,
  m.url as card_image_url,
  m.alt_text as card_image_alt,
  coalesce(
    jsonb_agg(distinct jsonb_build_object('slug', c.slug, 'name', c.name)) filter (where c.id is not null),
    '[]'::jsonb
  ) as categories,
  coalesce(
    jsonb_agg(distinct jsonb_build_object('slug', tg.slug, 'name', tg.name)) filter (where tg.id is not null),
    '[]'::jsonb
  ) as tags
from public.trips t
join public.destinations d on d.id = t.destination_id
left join public.media_assets m on m.id = t.card_media_id
left join public.trip_categories tc on tc.trip_id = t.id
left join public.categories c on c.id = tc.category_id and c.status = 'published'::public.publish_status
left join public.trip_tags tt on tt.trip_id = t.id
left join public.tags tg on tg.id = tt.tag_id and tg.status = 'published'::public.publish_status
where t.status = 'published'::public.publish_status
  and d.status = 'published'::public.publish_status
group by t.id, d.slug, d.name, m.url, m.alt_text;

create index media_assets_provider_idx on public.media_assets(provider);
create index categories_status_sort_idx on public.categories(status, sort_order);
create index tags_status_idx on public.tags(status);
create index destinations_status_sort_idx on public.destinations(status, sort_order);
create index trips_destination_status_sort_idx on public.trips(destination_id, status, sort_order);
create index trips_duration_idx on public.trips(duration_days);
create index trips_has_flights_idx on public.trips(has_flights);
create index trips_hotel_star_idx on public.trips(hotel_star);
create index trip_categories_category_idx on public.trip_categories(category_id);
create index trip_tags_tag_idx on public.trip_tags(tag_id);
create index trip_gallery_trip_sort_idx on public.trip_gallery(trip_id, sort_order);
create index trip_itinerary_trip_sort_idx on public.trip_itinerary_items(trip_id, sort_order);
create index collection_items_collection_sort_idx on public.collection_items(collection_id, sort_order);
create index navigation_items_location_sort_idx on public.navigation_items(location, sort_order);
create index bookings_status_created_idx on public.bookings(status, created_at desc);
create index bookings_trip_idx on public.bookings(trip_id);
create index newsletter_active_idx on public.newsletter_subscribers(is_active);
create index contact_submissions_status_created_idx on public.contact_submissions(status, created_at desc);
create index translations_lookup_idx on public.translations(locale_code, namespace, status);

create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger set_locales_updated_at before update on public.locales for each row execute function public.set_updated_at();
create trigger set_media_assets_updated_at before update on public.media_assets for each row execute function public.set_updated_at();
create trigger set_categories_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger set_tags_updated_at before update on public.tags for each row execute function public.set_updated_at();
create trigger set_destinations_updated_at before update on public.destinations for each row execute function public.set_updated_at();
create trigger set_trips_updated_at before update on public.trips for each row execute function public.set_updated_at();
create trigger set_trip_features_updated_at before update on public.trip_features for each row execute function public.set_updated_at();
create trigger set_trip_bullets_updated_at before update on public.trip_bullets for each row execute function public.set_updated_at();
create trigger set_trip_highlights_updated_at before update on public.trip_highlights for each row execute function public.set_updated_at();
create trigger set_trip_inclusions_updated_at before update on public.trip_inclusions for each row execute function public.set_updated_at();
create trigger set_trip_exclusions_updated_at before update on public.trip_exclusions for each row execute function public.set_updated_at();
create trigger set_trip_terms_updated_at before update on public.trip_terms for each row execute function public.set_updated_at();
create trigger set_trip_gallery_updated_at before update on public.trip_gallery for each row execute function public.set_updated_at();
create trigger set_trip_itinerary_items_updated_at before update on public.trip_itinerary_items for each row execute function public.set_updated_at();
create trigger set_services_updated_at before update on public.services for each row execute function public.set_updated_at();
create trigger set_collections_updated_at before update on public.collections for each row execute function public.set_updated_at();
create trigger set_collection_items_updated_at before update on public.collection_items for each row execute function public.set_updated_at();
create trigger set_site_sections_updated_at before update on public.site_sections for each row execute function public.set_updated_at();
create trigger set_navigation_items_updated_at before update on public.navigation_items for each row execute function public.set_updated_at();
create trigger set_footer_columns_updated_at before update on public.footer_columns for each row execute function public.set_updated_at();
create trigger set_footer_links_updated_at before update on public.footer_links for each row execute function public.set_updated_at();
create trigger set_pages_updated_at before update on public.pages for each row execute function public.set_updated_at();
create trigger set_testimonials_updated_at before update on public.testimonials for each row execute function public.set_updated_at();
create trigger set_bookings_updated_at before update on public.bookings for each row execute function public.set_updated_at();
create trigger set_contact_submissions_updated_at before update on public.contact_submissions for each row execute function public.set_updated_at();
create trigger set_translations_updated_at before update on public.translations for each row execute function public.set_updated_at();

insert into public.locales (code, name, direction, is_default, is_active)
values
  ('en', 'English', 'ltr', true, true),
  ('ar', 'Arabic', 'rtl', false, true);

alter table public.profiles enable row level security;
alter table public.locales enable row level security;
alter table public.media_assets enable row level security;
alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.destinations enable row level security;
alter table public.trips enable row level security;
alter table public.trip_categories enable row level security;
alter table public.trip_tags enable row level security;
alter table public.trip_features enable row level security;
alter table public.trip_bullets enable row level security;
alter table public.trip_highlights enable row level security;
alter table public.trip_inclusions enable row level security;
alter table public.trip_exclusions enable row level security;
alter table public.trip_terms enable row level security;
alter table public.trip_gallery enable row level security;
alter table public.trip_itinerary_items enable row level security;
alter table public.services enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.site_sections enable row level security;
alter table public.navigation_items enable row level security;
alter table public.footer_columns enable row level security;
alter table public.footer_links enable row level security;
alter table public.pages enable row level security;
alter table public.testimonials enable row level security;
alter table public.bookings enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.contact_submissions enable row level security;
alter table public.translations enable row level security;
alter table public.audit_log enable row level security;

create policy "profiles read own or admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

create policy "profiles admin manage"
  on public.profiles for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "locales public read active"
  on public.locales for select
  using (is_active = true);

create policy "locales editor manage"
  on public.locales for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "media public read"
  on public.media_assets for select
  using (true);

create policy "media editor manage"
  on public.media_assets for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "categories public read published"
  on public.categories for select
  using (status = 'published'::public.publish_status);

create policy "categories editor manage"
  on public.categories for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "tags public read published"
  on public.tags for select
  using (status = 'published'::public.publish_status);

create policy "tags editor manage"
  on public.tags for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "destinations public read published"
  on public.destinations for select
  using (status = 'published'::public.publish_status);

create policy "destinations editor manage"
  on public.destinations for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "trips public read published"
  on public.trips for select
  using (status = 'published'::public.publish_status);

create policy "trips editor manage"
  on public.trips for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "trip_categories public read published trips"
  on public.trip_categories for select
  using (
    exists (
      select 1 from public.trips
      where trips.id = trip_categories.trip_id
        and trips.status = 'published'::public.publish_status
    )
  );

create policy "trip_categories editor manage"
  on public.trip_categories for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "trip_tags public read published trips"
  on public.trip_tags for select
  using (
    exists (
      select 1 from public.trips
      where trips.id = trip_tags.trip_id
        and trips.status = 'published'::public.publish_status
    )
  );

create policy "trip_tags editor manage"
  on public.trip_tags for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "trip_features public read published trips"
  on public.trip_features for select
  using (
    exists (
      select 1 from public.trips
      where trips.id = trip_features.trip_id
        and trips.status = 'published'::public.publish_status
    )
  );

create policy "trip_features editor manage"
  on public.trip_features for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "trip_bullets public read published trips"
  on public.trip_bullets for select
  using (
    exists (
      select 1 from public.trips
      where trips.id = trip_bullets.trip_id
        and trips.status = 'published'::public.publish_status
    )
  );

create policy "trip_bullets editor manage"
  on public.trip_bullets for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "trip_highlights public read published trips"
  on public.trip_highlights for select
  using (
    exists (
      select 1 from public.trips
      where trips.id = trip_highlights.trip_id
        and trips.status = 'published'::public.publish_status
    )
  );

create policy "trip_highlights editor manage"
  on public.trip_highlights for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "trip_inclusions public read published trips"
  on public.trip_inclusions for select
  using (
    exists (
      select 1 from public.trips
      where trips.id = trip_inclusions.trip_id
        and trips.status = 'published'::public.publish_status
    )
  );

create policy "trip_inclusions editor manage"
  on public.trip_inclusions for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "trip_exclusions public read published trips"
  on public.trip_exclusions for select
  using (
    exists (
      select 1 from public.trips
      where trips.id = trip_exclusions.trip_id
        and trips.status = 'published'::public.publish_status
    )
  );

create policy "trip_exclusions editor manage"
  on public.trip_exclusions for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "trip_terms public read published trips"
  on public.trip_terms for select
  using (
    exists (
      select 1 from public.trips
      where trips.id = trip_terms.trip_id
        and trips.status = 'published'::public.publish_status
    )
  );

create policy "trip_terms editor manage"
  on public.trip_terms for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "trip_gallery public read published trips"
  on public.trip_gallery for select
  using (
    exists (
      select 1 from public.trips
      where trips.id = trip_gallery.trip_id
        and trips.status = 'published'::public.publish_status
    )
  );

create policy "trip_gallery editor manage"
  on public.trip_gallery for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "trip_itinerary_items public read published trips"
  on public.trip_itinerary_items for select
  using (
    exists (
      select 1 from public.trips
      where trips.id = trip_itinerary_items.trip_id
        and trips.status = 'published'::public.publish_status
    )
  );

create policy "trip_itinerary_items editor manage"
  on public.trip_itinerary_items for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "services public read published"
  on public.services for select
  using (status = 'published'::public.publish_status);

create policy "services editor manage"
  on public.services for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "collections public read published"
  on public.collections for select
  using (status = 'published'::public.publish_status);

create policy "collections editor manage"
  on public.collections for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "collection_items public read published"
  on public.collection_items for select
  using (
    status = 'published'::public.publish_status
    and exists (
      select 1 from public.collections
      where collections.id = collection_items.collection_id
        and collections.status = 'published'::public.publish_status
    )
  );

create policy "collection_items editor manage"
  on public.collection_items for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "site_sections public read published"
  on public.site_sections for select
  using (status = 'published'::public.publish_status);

create policy "site_sections editor manage"
  on public.site_sections for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "navigation_items public read published"
  on public.navigation_items for select
  using (status = 'published'::public.publish_status);

create policy "navigation_items editor manage"
  on public.navigation_items for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "footer_columns public read published"
  on public.footer_columns for select
  using (status = 'published'::public.publish_status);

create policy "footer_columns editor manage"
  on public.footer_columns for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "footer_links public read published"
  on public.footer_links for select
  using (status = 'published'::public.publish_status);

create policy "footer_links editor manage"
  on public.footer_links for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "pages public read published"
  on public.pages for select
  using (status = 'published'::public.publish_status);

create policy "pages editor manage"
  on public.pages for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "testimonials public read published"
  on public.testimonials for select
  using (status = 'published'::public.publish_status);

create policy "testimonials editor manage"
  on public.testimonials for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "bookings admin read"
  on public.bookings for select
  using (public.is_admin());

create policy "bookings admin insert"
  on public.bookings for insert
  with check (public.is_admin());

create policy "bookings admin update"
  on public.bookings for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "newsletter admin read"
  on public.newsletter_subscribers for select
  using (public.is_admin());

create policy "newsletter admin insert"
  on public.newsletter_subscribers for insert
  with check (public.is_admin());

create policy "newsletter admin update"
  on public.newsletter_subscribers for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "contact_submissions admin read"
  on public.contact_submissions for select
  using (public.is_admin());

create policy "contact_submissions admin insert"
  on public.contact_submissions for insert
  with check (public.is_admin());

create policy "contact_submissions admin update"
  on public.contact_submissions for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "translations public read published"
  on public.translations for select
  using (status = 'published'::public.publish_status);

create policy "translations editor manage"
  on public.translations for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

create policy "audit_log admin read"
  on public.audit_log for select
  using (public.is_admin());

create policy "audit_log admin insert"
  on public.audit_log for insert
  with check (public.is_admin());
