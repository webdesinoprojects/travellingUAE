# Supabase SQL Run Order

Use this only if you are applying SQL manually in Supabase SQL Editor.

## Option A: Supabase CLI

Preferred when the project is linked:

```bash
npm run db:push
```

The CLI applies migrations in timestamp order.

## Option B: SQL Editor

Run files in this exact order.

### 1. Core Schema

Run:

```txt
supabase/migrations/20260506101603_init_core_schema.sql
```

This creates core auth/profile helpers, CMS tables, destination/trip tables, bookings, newsletter, contact submissions, translations, audit log, views, indexes, triggers, and RLS policies.

Skip this file if it has already been applied to the target database.

### 2. Itinerary And Option Schema

Run:

```txt
supabase/migrations/20260508090000_itinerary_options.sql
```

This creates provider metadata, quote snapshots, booking itinerary segments, flight/hotel/transfer/activity options, option selection sessions, selection rows, indexes, triggers, and RLS policies.

### 3. Protected Admin Dashboard Aggregates

Run:

```txt
supabase/migrations/20260524090000_admin_dashboard_snapshot.sql
```

This creates supporting indexes for status/date/destination/audit summary reads plus the server-only `admin_dashboard_snapshot()` RPC used by the protected admin dashboard for counts, enquiry conversion series, destination activity, draft readiness, and safe audit metadata. Execute permission is granted only to `service_role`; the function does not return contact fields, notes, or secret values. Destination totals are aggregated independently before joining, avoiding row multiplication as enquiry volume grows.

Current deployment note:

- On 24 May 2026, CLI deployment could not be completed from this workspace because `supabase link` was rejected for insufficient project privileges and the direct Postgres host derived from the configured project URL did not resolve.
- On 1 June 2026, step 3 was applied with `supabase db push --db-url ...` using the configured remote database password read from `.env` without printing secrets. Keep this note for other environments that may still need the migration.

### 4. Media Asset Status (AD-5B)

Run:

```txt
supabase/migrations/20260601090000_media_assets_status.sql
```

This adds a real `status public.publish_status` column to `media_assets`, backfills every existing row to `published` (current home/trip/footer/destination media is already live demo content), sets `published` as the new default, indexes `(status, updated_at desc, id desc)` and `(folder, status)` for the admin library list query, drops the old `media public read` policy that exposed every row, and replaces it with `media public read published` so anonymous/public reads only see `status='published'`. The existing `media editor manage` policy continues to allow admin/editor management across all statuses; protected admin routes call through the service-role client so they remain unaffected.

Apply this before running AD-5B smoke coverage. Without it, archive/restore and the `?status=archived` filter will report PostgREST "column media_assets.status does not exist".

Deployment note:

- On 1 June 2026, step 4 was applied to the configured Supabase project with the same direct `db push --db-url ...` approach. The migration is idempotent for policy replacement (`drop policy if exists` for both the previous and replacement public read policies).

### 5. Stripe Payment Tracking

Run these only after the core schema exists, because they alter `public.bookings`.

Run:

```txt
supabase/migrations/20260611090000_stripe_payment.sql
```

Then run:

```txt
supabase/migrations/20260611090001_stripe_payment_amounts.sql
```

These add Stripe checkout session/payment intent tracking, payment status, paid amount, paid currency, and paid timestamp fields to `bookings`.

If SQL Editor reports `relation "public.bookings" does not exist`, stop and apply step 1 first. That error means the target database does not have the Fly Time core schema yet, or the SQL is being run against the wrong Supabase project.

## Repeatable Demo Content Seeds

After the schema exists, the homepage/footer CMS demo rows can be restored without rerunning the full seed:

```bash
npm run seed:home
```

This upserts only public CMS content needed for the home screen and footer:

- `home.hero` and `home.footer`
- Fly Time Picks and Routes People Ask For collections/cards
- What We Handle service cards
- Stories From The Route testimonials
- footer columns and links
- referenced public media rows

The command uses the service-role key from `.env`, does not print secrets, and verifies that published CMS rows exist after the write.

## Safety Notes

- Do not paste `.env` values into SQL Editor.
- Do not rerun a migration that already succeeded unless you reset the database.
- If SQL Editor fails midway, stop and share the exact database error before trying to patch manually.
- Demo seed data will be added as a separate ordered seed file after this schema is applied.
