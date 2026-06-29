-- Cancellation + post-booking reconciliation columns (prompt 05).
--
-- Adds the post-confirmation fields needed for ETG order/info reconciliation and
-- the cancellation lifecycle, plus a SEPARATE refund state machine.
--
-- Design notes:
--   * Refund state is independent of payment_status (Stripe) and
--     provider_order_status (ETG). An ETG cancellation NEVER auto-issues a Stripe
--     refund; refund_state starts at 'none' and only a human approval moves it.
--   * provider_hotel_confirmation_number is a provider identifier: it is stored
--     server-side for vouchers/support but must never appear in a public DTO/log.
--   * Cancellation penalty is stored so the deadline/penalty can be shown before
--     a final cancel confirmation and used by the refund policy evaluator.
--   * provider_order_status already supports confirmed/cancel_pending/cancelled/
--     pending_review (migration 20260613090000); no new states are needed.
--
-- NOT applied yet. Depends on 20260613090000_provider_booking_state.sql.

alter table public.bookings
  add column if not exists provider_hotel_confirmation_number text, -- HCN; server-only, never public
  add column if not exists provider_order_info_synced_at timestamptz,
  add column if not exists provider_cancel_requested_at timestamptz,
  add column if not exists provider_cancel_penalty_amount numeric,
  add column if not exists provider_cancel_penalty_currency text,
  add column if not exists provider_refund_state text not null default 'none',
  add column if not exists provider_refund_state_version integer not null default 0;

alter table public.bookings
  drop constraint if exists bookings_provider_refund_state_check;

alter table public.bookings
  add constraint bookings_provider_refund_state_check
  check (provider_refund_state in (
    'none',      -- no refund considered (non-refundable / unpaid / not cancelled)
    'review',    -- cancellation done; a human must decide the refund (DEFAULT path)
    'approved',  -- a human approved a refund amount; not yet issued
    'rejected',  -- a human declined a refund
    'processed'  -- refund issued via the separate Stripe refund flow
  ));

-- Atomic cancellation request: the confirmed -> cancel_pending transition AND the
-- durable cancel_booking job are created in ONE transaction (a single function
-- body). If the job insert fails, the whole thing rolls back, so a booking can
-- never be left in cancel_pending without a durable job. The booking row is
-- locked FOR UPDATE to serialize concurrent admin cancel requests.
create or replace function public.request_provider_cancellation(
  p_booking_id uuid,
  p_partner_order_id text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_version integer;
begin
  select provider_order_status, provider_status_version
    into v_status, v_version
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    return 'not_found';
  end if;

  -- Reject a missing/invalid partner_order_id BEFORE moving the booking to
  -- cancel_pending, so the cancel job can never be created without a usable id.
  if p_partner_order_id is null or length(trim(p_partner_order_id)) < 3 then
    return 'missing_partner_order_id';
  end if;

  if v_status is distinct from 'confirmed' then
    if v_status = 'cancel_pending' then return 'already_cancelling'; end if;
    if v_status in ('cancelled', 'failed') then return 'already_terminal'; end if;
    return 'not_confirmed';
  end if;

  update public.bookings
     set provider_order_status = 'cancel_pending',
         provider_status_version = v_version + 1,
         provider_cancel_requested_at = now(),
         provider_last_status_at = now()
   where id = p_booking_id;

  insert into public.provider_booking_jobs (
    booking_id, job_type, status, dedupe_key, run_after,
    max_attempts, partner_order_id, payload
  )
  values (
    p_booking_id, 'cancel_booking', 'queued',
    'cancel_booking:' || p_booking_id::text, now(),
    2, p_partner_order_id, jsonb_build_object('trigger', 'admin_cancel')
  )
  on conflict (dedupe_key) do nothing;

  return 'requested';
end;
$$;

-- Service role (server code) executes this; lock down PUBLIC and grant explicitly.
revoke all on function public.request_provider_cancellation(uuid, text) from public;
grant execute on function public.request_provider_cancellation(uuid, text)
  to service_role;
