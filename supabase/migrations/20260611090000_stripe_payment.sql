-- SP-1: Stripe payment columns on bookings
-- Adds stripe session/intent tracking and payment_status to bookings.
-- Enquiry-only bookings keep payment_status = null.

alter table public.bookings
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id  text,
  add column if not exists payment_status            text
    check (payment_status in ('pending', 'paid', 'failed', 'expired'));

-- Unique partial index: only rows that have a session ID (avoids null conflicts).
create unique index if not exists bookings_stripe_session_uidx
  on public.bookings(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index if not exists bookings_stripe_intent_idx
  on public.bookings(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create index if not exists bookings_payment_status_idx
  on public.bookings(payment_status)
  where payment_status is not null;
