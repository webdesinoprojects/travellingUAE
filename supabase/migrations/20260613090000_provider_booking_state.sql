-- Provider booking state machine + durable outbox + sanitized event history.
--
-- Foundation for the verified ETG v3 booking chain (create -> finish ->
-- finish/status + webhook). See dev/ratehawk-booking-doc-verification.md.
--
-- Design notes:
--   * payment_status (Stripe) stays SEPARATE from provider booking state. This
--     migration never overloads one onto the other.
--   * provider_order_status is widened to the full async state machine. Every
--     value previously allowed ('processing','confirmed','failed','cancelled',
--     'pending_review') is still allowed, so existing rows never break. All
--     existing rows have NULL here (HP-4B was never run), so nothing migrates.
--   * Atomic transitions are enforced by provider_status_version (optimistic
--     lock): update ... set version = version + 1 where id = ? and version = ?.
--   * No provider hashes (p-/h-/sr-), PII, or raw payloads are stored in any new
--     column or table. The prebook_hash continues to live only in
--     provider_quote_snapshots.metadata (server-only).
--   * These tables are operational/internal. RLS is enabled with editor/admin
--     policies only; the service role (server code) bypasses RLS.
--   * provider_booking_attempts: stores EACH attempt with unique partner_order_id
--     for reconciliation (not just the latest). Read-only for editors.
--   * provider_booking_events: append-only, no updates/deletes for editors.
--   * provider_booking_jobs: restricted payload, no hashes/PII/card data.
--
-- NOT applied yet. Apply order is documented in docs/sql-run-order.md. No ETG
-- order is created by any code in this slice; the booking feature flag is off.

-- 1. Widen the provider booking-process state machine on bookings ------------

alter table public.bookings
  drop constraint if exists bookings_provider_order_status_check;

-- Ensure the column exists even if 20260612090000 was not applied first.
alter table public.bookings
  add column if not exists provider_order_status text;

alter table public.bookings
  add constraint bookings_provider_order_status_check
  check (provider_order_status in (
    'pending',         -- booking row created, provider order not started
    'creating',        -- create booking process (booking/form) in flight
    'starting',        -- start booking process (booking/finish) in flight
    'processing',      -- ETG processing; polling finish/status
    'requires_3ds',    -- 3DS redirect required (payment_type 'now')
    'confirmed',       -- terminal success (status ok/completed or webhook confirmed)
    'failed',          -- terminal failure
    'cancel_pending',  -- cancellation requested, not yet acknowledged
    'cancelled',       -- terminal cancelled
    'pending_review'   -- ambiguous (cut-off reached / hash expired); manual review
  ));

-- 2. Provider order identity + reconciliation columns on bookings ------------
-- NOTE: provider_partner_order_id now tracks only the LATEST attempt. Full
-- attempt history is stored in provider_booking_attempts table below.

alter table public.bookings
  add column if not exists provider_order_id        text,  -- ETG order_id (idempotent re-decl)
  add column if not exists provider_order_item_id   text,  -- ETG item_id
  add column if not exists provider_partner_order_id text, -- last partner_order_id attempted (new per attempt)
  add column if not exists provider_attempt_count   integer not null default 0,
  add column if not exists provider_result_code     text,  -- sanitized short slug only
  add column if not exists provider_payment_type    text,
  add column if not exists provider_booking_cutoff_at timestamptz, -- ETG booking cut-off deadline
  add column if not exists provider_last_status_at  timestamptz,   -- last status poll/update
  add column if not exists provider_status_version  integer not null default 0, -- optimistic lock
  add column if not exists provider_confirmed_at    timestamptz,
  add column if not exists provider_cancelled_at    timestamptz;

alter table public.bookings
  drop constraint if exists bookings_provider_payment_type_check;

alter table public.bookings
  add constraint bookings_provider_payment_type_check
  check (provider_payment_type is null or provider_payment_type in ('hotel', 'now', 'deposit'));

create index if not exists bookings_provider_order_id_idx
  on public.bookings(provider_order_id)
  where provider_order_id is not null;

create index if not exists bookings_provider_order_status_idx
  on public.bookings(provider_order_status)
  where provider_order_status is not null;

-- 2b. Provider booking attempts - stores EACH attempt for reconciliation ---------
-- Each attempt gets a unique partner_order_id. This table preserves the full
-- history for reconciliation, not just the latest attempt.

create table if not exists public.provider_booking_attempts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  partner_order_id text not null,  -- unique per attempt (UUID)
  attempt_number integer not null, -- 1-indexed attempt count for this booking
  status text not null default 'pending' check (status in (
    'pending',    -- created, not yet submitted
    'submitted', -- sent to provider
    'completed', -- provider acknowledged (may still fail later)
    'failed'     -- terminal failure on this attempt
  )),
  provider_order_id text,          -- ETG order_id if allocated
  provider_order_item_id text,     -- ETG item_id if allocated
  error_code text,                 -- sanitized short slug only
  created_at timestamptz not null default now(),
  completed_at timestamptz         -- when status became completed/failed
);

-- Unique partner_order_id per attempt (no duplicates across ALL bookings)
create unique index if not exists provider_booking_attempts_partner_order_uidx
  on public.provider_booking_attempts(partner_order_id);

-- Unique attempt sequence per booking (no duplicate attempt numbers per booking)
create unique index if not exists provider_booking_attempts_booking_attempt_uidx
  on public.provider_booking_attempts(booking_id, attempt_number);

create index if not exists provider_booking_attempts_booking_idx
  on public.provider_booking_attempts(booking_id, attempt_number);

-- 3. Durable booking job / outbox -------------------------------------------
-- One row per provider-side action to perform. A background worker leases due
-- rows, runs an explicit state-machine step, and records the outcome. Retries
-- are explicit transitions here, NOT generic HTTP-client retries.
--
-- Each job_type is a distinct step in the ETG chain:
--   create_booking  = POST booking/form (creates a new attempt)
--   start_booking  = POST booking/finish (sends guest/room info)
--   poll_status    = POST booking/finish/status (checks completion)
--   cancel_booking = POST order/cancel (cancels a confirmed booking)
--   sync_order_info = POST order/info (retrieves HCN/voucher post-confirmation)
--
-- Non-idempotent steps are never combined. Each job has a single purpose.

create table if not exists public.provider_booking_jobs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  job_type text not null check (job_type in (
    'create_booking',   -- create booking process (booking/form)
    'start_booking',    -- start booking process (booking/finish)
    'poll_status',      -- check booking status (booking/finish/status)
    'cancel_booking',   -- cancel order (order/cancel)
    'sync_order_info'   -- retrieve order info (order/info)
  )),
  status text not null default 'queued' check (status in (
    'queued', 'leased', 'processing', 'succeeded', 'failed', 'dead'
  )),
  -- Idempotency: a given logical action is enqueued at most once per booking.
  dedupe_key text not null,
  run_after timestamptz not null default now(),
  attempts integer not null default 0,
  max_attempts integer not null default 10,
  lease_owner text,
  leased_until timestamptz,
  last_error_code text,            -- sanitized short slug only; never a payload
  partner_order_id text,            -- current attempt id; never a provider hash
  attempt_id uuid,                  -- links to provider_booking_attempts(id)
  payload jsonb not null default '{}'::jsonb, -- safe-only ids/counts; no hashes/PII
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists provider_booking_jobs_dedupe_uidx
  on public.provider_booking_jobs(dedupe_key);

create index if not exists provider_booking_jobs_due_idx
  on public.provider_booking_jobs(status, run_after);

create index if not exists provider_booking_jobs_booking_idx
  on public.provider_booking_jobs(booking_id);

-- Add FK from jobs.attempt_id to attempts table (after both tables exist)
alter table public.provider_booking_jobs
  drop constraint if exists provider_booking_jobs_attempt_fk;

alter table public.provider_booking_jobs
  add constraint provider_booking_jobs_attempt_fk
  foreign key (attempt_id) references public.provider_booking_attempts(id) on delete set null;

-- 4. Sanitized provider event history ---------------------------------------
-- Append-only audit trail of each provider step + classified outcome. Holds NO
-- raw provider payloads, hashes, PII, or card data: only a short sanitized
-- result code, http status, and the state transition.

create table if not exists public.provider_booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  job_id uuid references public.provider_booking_jobs(id) on delete set null,
  step text not null check (step in (
    'booking_form', 'booking_finish', 'booking_status', 'webhook', 'cancel', 'order_info'
  )),
  outcome text not null check (outcome in (
    'ok', 'retry', 'proceed', 'poll', 'requires_3ds', 'terminal', 'unknown'
  )),
  provider_result_code text,       -- sanitized short slug only
  http_status integer,
  from_state text,
  to_state text,
  attempt integer,
  note text,                       -- safe human-readable note only
  occurred_at timestamptz not null default now()
);

create index if not exists provider_booking_events_booking_idx
  on public.provider_booking_events(booking_id, occurred_at);

-- 5. Triggers ----------------------------------------------------------------
-- Use drop if exists for safe repeatability.

drop trigger if exists set_provider_booking_jobs_updated_at
  on public.provider_booking_jobs;

create trigger set_provider_booking_jobs_updated_at
  before update on public.provider_booking_jobs
  for each row execute function public.set_updated_at();

-- 6. Row level security ------------------------------------------------------
-- Internal operational tables. Service role bypasses RLS.
-- provider_booking_jobs: editors can READ only, not mutate.
-- provider_booking_events: editors can READ only (append-only, no updates/deletes).
-- provider_booking_attempts: editors can READ only (immutable attempt history).

alter table public.provider_booking_jobs enable row level security;
alter table public.provider_booking_events enable row level security;
alter table public.provider_booking_attempts enable row level security;

-- Jobs: editors can only read, not mutate (service role handles all mutations)
drop policy if exists "provider_booking_jobs editor read"
  on public.provider_booking_jobs;
create policy "provider_booking_jobs editor read"
  on public.provider_booking_jobs for select
  using (public.is_editor_or_admin());

-- Events: append-only - editors can SELECT only. Service role handles INSERT
-- for audit integrity. No UPDATE or DELETE for editors.
drop policy if exists "provider_booking_events editor read"
  on public.provider_booking_events;
create policy "provider_booking_events editor read"
  on public.provider_booking_events for select
  using (public.is_editor_or_admin());

-- Attempts: read-only for editors (service role handles creation)
drop policy if exists "provider_booking_attempts editor read"
  on public.provider_booking_attempts;
create policy "provider_booking_attempts editor read"
  on public.provider_booking_attempts for select
  using (public.is_editor_or_admin());
