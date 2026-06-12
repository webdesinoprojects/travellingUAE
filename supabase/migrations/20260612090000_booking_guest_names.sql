-- HP-4B preparation: split guest name storage + provider order tracking.
--
-- customer_name stays for admin display and backward compat.
-- customer_first_name / customer_last_name are for the RateHawk booking form.
-- provider_order_id / provider_order_status track the final hotel order state.
--
-- These columns are nullable. New Stripe-checkout bookings will have first/last
-- populated. Legacy enquiry bookings may only have customer_name (left as-is).

alter table public.bookings
  add column if not exists customer_first_name   text,
  add column if not exists customer_last_name    text,
  add column if not exists provider_order_id     text,
  add column if not exists provider_order_status text
    check (provider_order_status in (
      'processing', 'confirmed', 'failed', 'cancelled', 'pending_review'
    ));

-- Index for admin order lookups and support queries.
create index if not exists bookings_provider_order_id_idx
  on public.bookings(provider_order_id)
  where provider_order_id is not null;

-- Index for admin monitoring: find bookings where order is failed/processing.
create index if not exists bookings_provider_order_status_idx
  on public.bookings(provider_order_status)
  where provider_order_status is not null;
