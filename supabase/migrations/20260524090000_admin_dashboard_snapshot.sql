-- Server-only operational aggregates for the protected admin dashboard.
-- This function returns counts and safe audit metadata only; it never returns PII.

create index if not exists trips_status_idx
  on public.trips(status);

create index if not exists bookings_created_status_idx
  on public.bookings(created_at desc, status);

create index if not exists bookings_destination_status_idx
  on public.bookings(destination_id, status);

create index if not exists audit_log_created_idx
  on public.audit_log(created_at desc);

create or replace function public.admin_dashboard_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
with trip_counts as (
  select
    count(*)::integer as total,
    count(*) filter (where status = 'published'::public.publish_status)::integer as published,
    count(*) filter (where status = 'draft'::public.publish_status)::integer as draft,
    count(*) filter (where status = 'archived'::public.publish_status)::integer as archived
  from public.trips
),
destination_counts as (
  select count(*)::integer as total
  from public.destinations
  where status <> 'archived'::public.publish_status
),
booking_counts as (
  select
    count(*)::integer as total,
    count(*) filter (where status = 'new'::public.booking_status)::integer as new_count,
    count(*) filter (where status = 'contacted'::public.booking_status)::integer as contacted,
    count(*) filter (where status = 'confirmed'::public.booking_status)::integer as confirmed,
    count(*) filter (where status = 'completed'::public.booking_status)::integer as completed,
    count(*) filter (where status = 'cancelled'::public.booking_status)::integer as cancelled
  from public.bookings
),
content_counts as (
  select
    (select count(*)::integer from public.pages where status = 'draft'::public.publish_status) as draft_pages,
    (select count(*)::integer from public.translations where status = 'draft'::public.publish_status) as draft_translations,
    (select count(*)::integer from public.site_sections where status = 'draft'::public.publish_status) as draft_sections
),
week_buckets as (
  select bucket, to_char(bucket, 'Dy') as label
  from generate_series(
    date_trunc('day', current_timestamp) - interval '6 days',
    date_trunc('day', current_timestamp),
    interval '1 day'
  ) as bucket
),
week_stats as (
  select
    buckets.bucket,
    buckets.label,
    count(bookings.id)::integer as enquiries,
    count(bookings.id) filter (
      where bookings.status in (
        'confirmed'::public.booking_status,
        'completed'::public.booking_status
      )
    )::integer as converted
  from week_buckets buckets
  left join public.bookings bookings
    on bookings.created_at >= buckets.bucket
   and bookings.created_at < buckets.bucket + interval '1 day'
  group by buckets.bucket, buckets.label
),
month_buckets as (
  select bucket, to_char(bucket, 'DD Mon') as label
  from generate_series(
    date_trunc('week', current_timestamp) - interval '3 weeks',
    date_trunc('week', current_timestamp),
    interval '1 week'
  ) as bucket
),
month_stats as (
  select
    buckets.bucket,
    buckets.label,
    count(bookings.id)::integer as enquiries,
    count(bookings.id) filter (
      where bookings.status in (
        'confirmed'::public.booking_status,
        'completed'::public.booking_status
      )
    )::integer as converted
  from month_buckets buckets
  left join public.bookings bookings
    on bookings.created_at >= buckets.bucket
   and bookings.created_at < buckets.bucket + interval '1 week'
  group by buckets.bucket, buckets.label
),
year_buckets as (
  select bucket, to_char(bucket, 'Mon') as label
  from generate_series(
    date_trunc('month', current_timestamp) - interval '11 months',
    date_trunc('month', current_timestamp),
    interval '1 month'
  ) as bucket
),
year_stats as (
  select
    buckets.bucket,
    buckets.label,
    count(bookings.id)::integer as enquiries,
    count(bookings.id) filter (
      where bookings.status in (
        'confirmed'::public.booking_status,
        'completed'::public.booking_status
      )
    )::integer as converted
  from year_buckets buckets
  left join public.bookings bookings
    on bookings.created_at >= buckets.bucket
   and bookings.created_at < buckets.bucket + interval '1 month'
  group by buckets.bucket, buckets.label
),
published_trip_totals as (
  select
    trips.destination_id,
    count(*)::integer as packages
  from public.trips trips
  where trips.status = 'published'::public.publish_status
  group by trips.destination_id
),
active_booking_totals as (
  select
    bookings.destination_id,
    count(*)::integer as bookings
  from public.bookings bookings
  where bookings.status <> 'cancelled'::public.booking_status
    and bookings.destination_id is not null
  group by bookings.destination_id
),
destination_rollup as (
  select
    destinations.name,
    coalesce(destinations.country, destinations.name) as country,
    coalesce(published_trip_totals.packages, 0)::integer as packages,
    coalesce(active_booking_totals.bookings, 0)::integer as bookings
  from public.destinations destinations
  left join published_trip_totals
    on published_trip_totals.destination_id = destinations.id
  left join active_booking_totals
    on active_booking_totals.destination_id = destinations.id
  where destinations.status <> 'archived'::public.publish_status
  order by
    coalesce(active_booking_totals.bookings, 0) desc,
    coalesce(published_trip_totals.packages, 0) desc,
    destinations.name asc
  limit 6
),
recent_activity as (
  select action, entity_table, created_at
  from public.audit_log
  order by created_at desc
  limit 4
)
select jsonb_build_object(
  'tripCounts', (select to_jsonb(trip_counts) from trip_counts),
  'destinationCounts', (select to_jsonb(destination_counts) from destination_counts),
  'bookingCounts', (select to_jsonb(booking_counts) from booking_counts),
  'contentCounts', (select to_jsonb(content_counts) from content_counts),
  'analytics', jsonb_build_object(
    'week', coalesce(
      (select jsonb_agg(jsonb_build_object(
        'label', label,
        'enquiries', enquiries,
        'converted', converted
      ) order by bucket) from week_stats),
      '[]'::jsonb
    ),
    'month', coalesce(
      (select jsonb_agg(jsonb_build_object(
        'label', label,
        'enquiries', enquiries,
        'converted', converted
      ) order by bucket) from month_stats),
      '[]'::jsonb
    ),
    'year', coalesce(
      (select jsonb_agg(jsonb_build_object(
        'label', label,
        'enquiries', enquiries,
        'converted', converted
      ) order by bucket) from year_stats),
      '[]'::jsonb
    )
  ),
  'destinations', coalesce(
    (select jsonb_agg(jsonb_build_object(
      'name', name,
      'country', country,
      'packages', packages,
      'bookings', bookings
    ) order by bookings desc, packages desc, name asc) from destination_rollup),
    '[]'::jsonb
  ),
  'activity', coalesce(
    (select jsonb_agg(jsonb_build_object(
      'action', action,
      'entity', entity_table,
      'createdAt', created_at
    ) order by created_at desc) from recent_activity),
    '[]'::jsonb
  )
)
from trip_counts, destination_counts, booking_counts, content_counts;
$function$;

revoke all on function public.admin_dashboard_snapshot() from public;
revoke all on function public.admin_dashboard_snapshot() from anon;
revoke all on function public.admin_dashboard_snapshot() from authenticated;
grant execute on function public.admin_dashboard_snapshot() to service_role;
