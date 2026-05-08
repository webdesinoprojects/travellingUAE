# Phase 3 Carry-Over

Phase 3 now has protected admin APIs, admin session auth, generic resource CRUD, itinerary segment CRUD, option CRUD, and audit log writes.

These items are intentionally left for later phases because they need provider decisions or full editor UX work, not because the backend route foundation is missing.

## Admin Editors

- Build full per-resource forms for destinations, trips, pages, navigation, translations, home sections, media, bookings, newsletter, and users.
- Add field-level editors for trip gallery, highlights, inclusions, exclusions, terms, and itinerary day copy.
- Add optimistic row refresh and table search against protected admin APIs instead of relying on server-rendered snapshots.

## Trip Detail Content Verification

- `trip_inclusions` is wired in `getPublicTripPackage()` and renders in `What's Included` through `pkg.inclusions`. Seed/update rows here and verify the visible list changes on the trip detail page.
- `trip_gallery` is wired in `getPublicTripPackage()` and renders through `TripGallery`. Seed/update image rows here and verify the gallery changes on the trip detail page.
- `trip_itinerary_items` is queried and mapped into `pkg.itinerary`, but the current `TripDetail` component does not consume `pkg.itinerary`; it still builds fallback itinerary copy unless the newer `trip_itinerary_segments` data exists. Wire this fallback UI to render DB itinerary rows.
- `trip_itinerary_segments` is wired separately through `GET /api/public/trips/[destination]/[trip]/itinerary` and renders the dynamic option builder when published segment rows exist.
- Add smoke coverage that inserts 3-4 rows into `trip_inclusions`, `trip_gallery`, and `trip_itinerary_items`, fetches `GET /api/public/trips/[destination]/[trip]`, and confirms the response reflects the inserted content without exposing private/admin fields.
- Add browser QA for one seeded trip: verify included text, gallery images, fallback itinerary text, and dynamic itinerary segments appear in the expected section.

## Admin Auth And RBAC

- Current Phase 3 auth supports Supabase Auth plus `profiles` rows with only two roles: `admin` and `editor`; `is_active=true` is required.
- Current admin session uses an httpOnly `flytime-admin-access` cookie created by `POST /api/admin/session`; APIs also support the server-only preview token path for smoke tests.
- Current resource protection is coarse: `admin` for bookings, newsletter, users, audit/settings-like areas; `editor` for content/trip/media/page operations.
- Not yet implemented: a three-level client-facing RBAC model such as `content`, `editorial`, and `admin/full_access`.
- Add a proper permission matrix for sidebar visibility, page access, API access, and CRUD actions before client handoff.
- Add invite/create-admin flow or a safe local seed script for creating Supabase Auth users plus matching `profiles` rows. Do not hardcode demo credentials in code.
- Add password reset and account disable flows if the client wants non-technical admin onboarding.

## Media Manager

- Add Cloudinary/ImageKit signing or upload endpoints after the final media provider is confirmed.
- Add provider folder sync and safe thumbnail generation.
- Keep provider private keys server-only; never expose upload secrets to the browser.

## Admin Auth UX

- Create/invite real Supabase Auth users and matching `profiles` rows for admin/editor roles.
- Add password reset and invite flow if the client wants non-technical admin onboarding.
- Add session refresh flow if admins need longer than the current access-token cookie window.

## Sensitive Operations

- Build a private booking inbox UI that fetches protected API data only after auth.
- Add export endpoints for bookings/newsletter only after rate limiting and audit requirements are finalized.
- Add role-specific permissions beyond `admin` and `editor` if the client needs finance/support/media separation.

## Provider-Dependent

- Flight, hotel, and transport live provider CRUD/sync remains Phase 5 until provider docs, auth method, sandbox credentials, rate limits, and quote expiry rules are provided.
