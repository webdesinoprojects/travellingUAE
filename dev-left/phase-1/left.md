# Phase 1 Left For Later

Phase 1 is closed as the backend foundation, but these items were intentionally deferred because they belong to production hardening or later feature wiring.

## Auth And Admin Access

Status: deferred to Phase 3.

- Replace temporary `ADMIN_PREVIEW_TOKEN` admin API access with real Supabase Auth.
- Enforce `profiles.role in ('admin', 'editor')` and `profiles.is_active = true` for admin pages and APIs.
- Add proper admin login/session UI.
- Add admin logout and session-expiry behavior.
- Decide whether editors can write all CMS content or only selected modules.

## Static Fallback Cleanup

Status: keep temporarily until admin CRUD and fuller seed data exist.

- `src/server/public/dal.ts` still falls back to `src/data/trips.ts` when Supabase data/env is unavailable.
- Keep this fallback during active development so pages do not hard-crash.
- Remove or gate fallback before production once admin CRUD and enough Supabase content exist.
- Re-test `/trips`, `/trips/[destination]`, and `/trips/[destination]/[tripSlug]` after fallback removal.

## Supabase Generated Types

Status: blocked by local Docker requirement.

- `supabase gen types typescript --db-url ...` failed because Supabase CLI tried to inspect the `postgres-meta` Docker image.
- Current backend compiles because Supabase calls are DTO-mapped manually.
- Later options:
  - install/start Docker Desktop and run type generation,
  - generate types in CI,
  - or add a separate schema typing workflow.

## Public Mutations Hardening

Status: deferred to Phase 5 production hardening.

- Add rate limiting for:
  - `POST /api/bookings`
  - `POST /api/contact`
  - `POST /api/newsletter`
  - `POST /api/public/trips/[destination]/[trip]/selection`
- Add bot/spam protection if client wants public forms exposed without login.
- Add request size limits and stricter payload validation where needed.
- Keep backend errors generic for users; server logs only for actual errors.

## Email Notifications

Status: deferred to Phase 5.

- Wire Resend for:
  - booking/enquiry notification to admin,
  - contact form notification,
  - optional customer acknowledgement email.
- Failed email must not delete or fail a saved booking/contact submission.
- Do not expose Resend/API errors to users.

## API Test Expansion

Status: smoke tests exist; deeper CRUD tests deferred.

- Current `api-test/run-smoke.ps1` covers core public read APIs, option selection, and booking mutation.
- Add contact/newsletter mutation checks with safe demo input.
- Add admin preview tests after `ADMIN_PREVIEW_TOKEN` is set.
- Add real CRUD tests once Phase 3 admin write APIs exist.
- Add a non-mutating CI-safe mode as default if needed.

## Frontend Wiring Audit

Status: partially complete.

- Public trip pages already read through the server DAL.
- Booking page still needs to consume the itinerary/options/selection APIs.
- Contact/newsletter forms should be rechecked against the backend routes before production.
- Admin dashboard is read-wired, but admin CRUD forms are not implemented yet.

## Deployment Readiness

Status: deferred.

- Confirm production env variables are present without printing values.
- Confirm Supabase RLS policies after final admin auth is wired.
- Confirm `NEXT_PUBLIC_SITE_URL` matches deployed domain.
- Confirm Google font fetches work in deployment build.
- Add deployment smoke-test instructions using `api-test/run-smoke.ps1`.

