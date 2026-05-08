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

## Safety Notes

- Do not paste `.env` values into SQL Editor.
- Do not rerun a migration that already succeeded unless you reset the database.
- If SQL Editor fails midway, stop and share the exact database error before trying to patch manually.
- Demo seed data will be added as a separate ordered seed file after this schema is applied.
