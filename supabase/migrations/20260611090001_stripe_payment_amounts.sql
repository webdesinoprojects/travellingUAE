-- SP-1 patch: add payment amount tracking and paid timestamp to bookings.
-- Safe to apply whether or not 20260611090000 has already been applied.

alter table public.bookings
  add column if not exists paid_amount   numeric,
  add column if not exists paid_currency text,
  add column if not exists paid_at       timestamptz;
