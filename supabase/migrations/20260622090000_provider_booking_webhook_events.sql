-- ETG booking-status webhook receipts + idempotency ledger (prompt 04).
--
-- The ETG Affiliate API pushes a signed booking-status callback to a registered
-- URL. This table is the durable receipt + dedupe ledger written BEFORE any
-- booking-state side effect, so a replayed delivery is a no-op and the route can
-- safely return 200.
--
-- Security:
--   * dedupe_key is a NON-SECRET fingerprint: sha256(timestamp + ':' + token).
--     The raw webhook token (a secret-equivalent nonce) is NEVER stored.
--   * No raw payloads, signatures, PII, hashes, or provider identifiers are kept
--     here. Only a short sanitized status slug + the normalized outcome.
--   * Service role (server code) writes; editors/admins may read for ops only.
--
-- NOT applied yet. Apply order is documented in docs/sql-run-order.md. Depends on
-- 20260613090000_provider_booking_state.sql (bookings provider columns).

create table if not exists public.provider_booking_webhook_events (
  id uuid primary key default gen_random_uuid(),
  -- Non-secret idempotency key: sha256(timestamp + ':' + token), hex.
  dedupe_key text not null,
  -- The booking this event matched, if any (null when no record matched).
  booking_id uuid references public.bookings(id) on delete set null,
  -- partner_order_id the callback referenced (not a provider hash).
  partner_order_id text,
  -- Sanitized raw webhook status value (e.g. 'completed','failed'); short slug only.
  raw_status text,
  -- Our normalized classification. 'completed'->success, 'failed'->failed. An
  -- unknown-but-signed status is recorded as 'unknown' for durable manual review
  -- (it is NEVER treated as success).
  normalized_outcome text not null check (normalized_outcome in (
    'success', 'failed', 'unknown'
  )),
  -- Always true for recorded rows: invalid-signature deliveries are rejected
  -- (HTTP 401) WITHOUT persistence, so a forged flood cannot fill this table.
  signature_valid boolean not null,
  -- Receipt processing lifecycle. A delivery is marked 'processed' ONLY after its
  -- side effects are durably applied; an unprocessed/'failed' receipt is re-claimed
  -- and retried by the next delivery, never swallowed.
  status text not null default 'received' check (status in (
    'received', 'processing', 'processed', 'failed'
  )),
  -- Lease: a worker claims a receipt by setting status='processing' + locked_until
  -- = now + lease. A stale lease (locked_until < now) is reclaimable after a crash.
  attempt_count integer not null default 0,
  locked_until timestamptz,
  locked_by text,
  processed_at timestamptz,
  -- Sanitized failure reason only (short slug); never a raw payload/PII/secret.
  error_message text,
  -- HTTP status we returned to ETG (for audit).
  http_status integer,
  received_at timestamptz not null default now()
);

-- Idempotency: a given signed delivery is recorded at most once.
create unique index if not exists provider_booking_webhook_events_dedupe_uidx
  on public.provider_booking_webhook_events(dedupe_key);

create index if not exists provider_booking_webhook_events_booking_idx
  on public.provider_booking_webhook_events(booking_id, received_at);

create index if not exists provider_booking_webhook_events_partner_idx
  on public.provider_booking_webhook_events(partner_order_id)
  where partner_order_id is not null;

-- Reclaim/monitoring of unprocessed receipts (status + expiring lease).
create index if not exists provider_booking_webhook_events_status_idx
  on public.provider_booking_webhook_events(status, locked_until);

-- RLS: internal operational table. Service role bypasses RLS. Editors read only.
alter table public.provider_booking_webhook_events enable row level security;

drop policy if exists "provider_booking_webhook_events editor read"
  on public.provider_booking_webhook_events;
create policy "provider_booking_webhook_events editor read"
  on public.provider_booking_webhook_events for select
  using (public.is_editor_or_admin());
