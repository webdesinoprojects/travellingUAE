-- eSIM email OTP verification + activation email delivery state (Phase 3C).
--
-- Two concerns:
--  1. Pre-payment email verification: a 6-digit OTP is emailed and its HASH
--     (HMAC, never plaintext) stored here. Payment is blocked until verified.
--  2. Activation email delivery state on esim_orders, so the fulfilled QR /
--     activation email is sent once and admin resend is auditable.
--
-- Security: esim_email_verifications has RLS enabled with NO public policy - the
-- OTP hash is only ever touched by the service-role server client. Nothing here
-- is readable by anon/authenticated clients.
--
-- NOT applied by Codex. Apply before deploying Phase 3C code.

create table if not exists public.esim_email_verifications (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  otp_hash text,
  otp_expires_at timestamptz,
  attempts integer not null default 0,
  send_count integer not null default 0,
  last_sent_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists esim_email_verifications_verified_idx
  on public.esim_email_verifications (email, verified_at);

drop trigger if exists set_esim_email_verifications_updated_at
  on public.esim_email_verifications;

create trigger set_esim_email_verifications_updated_at
  before update on public.esim_email_verifications
  for each row execute function public.set_updated_at();

alter table public.esim_email_verifications enable row level security;
-- No public/anon/editor policy: OTP state is service-role only.

-- Activation email delivery state on the order.
alter table public.esim_orders
  add column if not exists email_verified_at timestamptz,
  add column if not exists activation_email_lookup_token_hash text,
  add column if not exists activation_email_status text,
  add column if not exists activation_email_sent_at timestamptz,
  add column if not exists activation_email_error text;

create index if not exists esim_orders_activation_email_lookup_idx
  on public.esim_orders (activation_email_lookup_token_hash)
  where activation_email_lookup_token_hash is not null;
