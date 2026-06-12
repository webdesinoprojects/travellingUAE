# Fly Time Full Backend Plan

This file is the backend source of truth for Fly Time. Keep it updated whenever schema, routes, auth, provider integrations, or admin modules change.

## Goals

- Replace hardcoded public/admin data with Supabase-backed data access.
- Keep customer data, booking details, API keys, provider secrets, and admin notes server-only.
- Support at least 10k active users without coupling UI components directly to database rows.
- Use database-backed admin/public DTOs for completed modules; development fallback data must not masquerade as published production content.
- Prepare for flight, hotel, and transport provider APIs without exposing provider keys to the browser.
- Support English and Arabic content later through CMS-backed translations.

## Non-Negotiables

- Browser code may only use `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and other intentionally public values.
- `SUPABASE_SERVICE_ROLE_KEY`, provider API secrets, Resend keys, ImageKit private key, and Cloudinary secret stay in server-only modules.
- Public forms call Next.js route handlers. They never insert directly into Supabase from the browser.
- API responses must return generic user-facing errors. Backend details stay in server logs only.
- Components receive DTOs, not raw Supabase rows.
- Every mutation validates input server-side and re-checks authorization inside the data layer.
- Admin routes need Supabase Auth plus `profiles.role` and `profiles.is_active` before production.
- Admin login is handled by the server route only; Supabase access and refresh tokens are held in HTTP-only cookies and never returned to admin browser code.
- Authentication operations use fresh Supabase clients, separate from the cached anonymous public-content client, so signing into admin cannot alter the authorization context of public DAL reads.

## Backend Progress Tracker

Status legend:

- Done: implemented and verified locally.
- Partial: usable foundation exists, but not final production scope.
- Pending: not implemented yet.

Deferred work that should not block the active phase is tracked under `dev-left/<phase>/left.md`.
For Phase 1 carry-over, see `dev-left/phase-1/left.md`.

| Phase | Area | Backend Status | Frontend Wiring | Verification |
| --- | --- | --- | --- | --- |
| Phase 1 | Backend plan and folder structure | Done | Not UI-specific | `full-bakcned-plan.md` maintained |
| Phase 1 | Supabase core schema | Done | Public pages can read seeded data through DAL | Remote migration applied |
| Phase 1 | Server-only Supabase clients | Done | Not UI-specific | `lint`, `tsc`, `build` passed |
| Phase 1 | Safe API response helpers and validation helpers | Done | Public forms use generic error responses | API smoke tests cover public mutations |
| Phase 1 | Public trip DAL | Partial | `/trips`, `/trips/[destination]`, `/trips/[destination]/[tripSlug]` read through DAL with fallback safety | Public trip APIs tested |
| Phase 1 | Public booking/contact/newsletter routes | Partial | Existing forms can call these routes; email send/rate limit still pending | Booking create plus protected admin read/cancel lifecycle tested |
| Phase 1 | Admin dashboard read APIs | Code ready / migration pending | Protected dashboard DTO now uses server-only aggregate counts, enquiry conversion graphs, status distribution, destination activity, readiness counts, recent enquiries, and safe audit metadata; no payment revenue is shown before payment integration | Local `lint`, `tsc`, `build`, script parser passed; apply `20260524090000_admin_dashboard_snapshot.sql` before authenticated smoke |
| Phase 2 | Itinerary/options schema | Done | Trip detail can render backend itinerary segments | Remote migration applied |
| Phase 2 | Itinerary timeline API | Done | Initial trip detail page wiring done via `TripItineraryPlanner` | Smoke tested; production build passed |
| Phase 2 | Flight/hotel/transfer/activity option APIs | Done for seeded/manual options | Initial option picker drawer wired on trip detail page | Smoke tested all four option types |
| Phase 2 | Selection session API | Done | Initial selection update wiring done with HTTP-only session cookie | Smoke tested with HTTP-only cookie |
| Phase 2 | Booking linked to selected option session | Done | Existing booking API supports linked option session; final booking form UI still pending | Smoke tested |
| Phase 2 | Trip list filters | Partial | Desktop sidebar, mobile left slide-in menu, URL round-trip, and shared server filter helper are wired; DB-level pagination/filter query is still pending for large inventory | Public destination filter API tested |
| Phase 2 | Remove static trip dependency | Partial | DAL falls back to `src/data/trips.ts` when DB is unavailable; final production mode should rely on Supabase seed/admin data | Pending final cleanup |
| Phase 3 | Admin auth | Done for session flow / hardening pending | `/admin` pages require a verified Supabase admin/editor session; server-side login issues HTTP-only cookies, supports remembered 30-day refresh through Proxy, and browser admin CRUD uses cookie auth rather than bearer tokens | `api-test/reports/admin-session-latest.md` passed `36/36` read/auth checks, including forced access expiry and protected-request renewal; production login rate limiting/MFA policy still pending |
| Phase 3 | Admin CRUD APIs | Done for backend routes / partial UI | Generic resources plus protected trip highlight, inclusion, exclusion, term, gallery and itinerary-day CRUD routes exist; `/admin/trips` now edits those public detail sections through protected APIs; CRUD-backed protected list reads return live safe DTO rows | Trip-content editor/API/public reflection passed in `api-test/reports/navigation-cms-latest.md`; highlight/exclusion/term extension compiles and is in smoke coverage, but needs an authenticated rerun with `ADMIN_PREVIEW_TOKEN` |
| Phase 3 | Audit log writes for admin mutations | Done | Protected audit-log view returns action/table/time metadata only | Booking/content/CMS mutation audit reads passed in authenticated smoke |
| Phase 3 | Itinerary segment/option and core content CRUD APIs | Done for routes | Trip admin APIs can create/update/delete core highlight/inclusion/exclusion/term/gallery/itinerary-day rows and create/update/archive selectable segments/options; stored itinerary days now render in the trip-detail fallback UI | `lint`, `tsc`, production build and authenticated API lifecycle passed for the earlier content set; rerun authenticated smoke for the newly expanded text rows |
| Phase 3 | Admin forms | Partial | Dedicated editors are wired for trip highlights, inclusions, exclusions, terms, gallery, itinerary content, Phase 4 CMS modules, booking inbox (list/detail/add-enquiry/CSV-export), destination create/edit/archive, category create/edit/archive with real trip-assignment counts via embedded aggregate, and (AD-4) trip core record create/edit/archive at `/admin/trips/new` and `/admin/trips/[id]` covering destination, title, slug, city, summary, overview, badge, duration days/label, nights, has-flights, hotel star, price/currency, start date, travelers label, latitude/longitude/map zoom, sort order, and status; `/admin/trips` now renders the editorial list (operational pattern) with search/status/cursor pagination across all statuses (driven by `trips` table, not the `published_trip_cards` view); protected admin-only preview at `/admin/trips/[id]/preview` and `GET /api/admin/trips/[tripId]/preview` renders draft trips through the admin Supabase client without leaking them publicly (public DAL still filters `status='published'`); `TripEditor` create-form clears only on confirmed success and keeps values on failed save; `TripContentEditor` `createFormKey` resets the create form only after a successful POST, never on failure; responsive overflow fixed across mobile/tablet/desktop (`min-w-0` + `w-full min-w-0` inputs, itinerary grid `sm:grid-cols-2 lg:grid-cols-4`); trips added to `OPERATIONAL_RESOURCES` so DB failure returns empty list, never mock data; topbar search is a real accessible control with URL-synced status filter and cursor pagination using `updated_at`+`id` tie-breaker; row open buttons are real routes for bookings/destinations/categories/trips; sidebar badges removed; `AdminCrudPanel` removed from operational pages; booking CSV export exposes `X-Export-Limit` and `X-Export-Truncated` headers; Tags module, destination/trip media selection, trip category/tag assignment UI, and full RBAC remain tracked in `dev-left/phase-3/left.md`. Draft revisions for trip child content (inclusions/gallery/itinerary/etc.) are explicitly **not** implemented — the schema has no revision/draft column — so editing a *published* trip's child content goes live immediately; this limitation is documented as blocked pending a schema decision. | AD-4 verified: `tsc`, lint, and production build clean; authenticated smoke `172/172` in `api-test/reports/ad4-smoke-latest.md` (2026-05-26) against `npm run dev` (dev mode, `Secure: false`, port 3010) — includes trip cursor pagination, draft preview returning content for admin, anonymous rejection of the preview, draft excluded from public list, public reflection after publish, lifecycle archive, plus the 4 session-cookie tests that previously failed in production mode now passing in dev mode |
| Phase 3 | Media manager | Partial (AD-5A/AD-5B done, AD-5C pending) | Media asset metadata CRUD is wired through `/api/admin/resources/media`; AD-5A adds the ImageKit upload foundation: server-only `src/server/media/imagekit.ts` (HMAC-SHA1 upload-auth signing, server-side `verifyImageKitFile` via private key, mime/size/private-file allowlist, strict folder normalization), protected `GET /api/admin/media/upload-auth` (editor role, returns public token/signature/expire/publicKey/uploadEndpoint only; audit omits token/signature values), and protected `POST /api/admin/media` (editor role, normalizes/rejects unsafe folders before provider verification, validates fileId server-side against ImageKit `/v1/files/{id}/details`, derives folder from verified `filePath`, rejects folder mismatches, writes `created_by`, and stores a safe `media_assets` row). AD-5B adds `media_assets.status`, archive/restore behavior, `/admin/media` visual library, search/status/folder/cursor filtering, metadata edit UI, and protected restore route. Cloudinary remains an enum/trusted-host option but ImageKit is the active provider path. AD-5C picker wiring across trip/destination/home editors remains deferred. | AD-5A verified: `183/183` in `api-test/reports/ad5a-fix-smoke-latest.md`. AD-5B migration applied remotely on 2026-06-01; AD-5B media lifecycle checks pass in `api-test/reports/ad5b-smoke-latest.md` (create/list/patch/archive/list archived/restore/list published/folder filter/anonymous restore rejection/cleanup). The latest full smoke still has unrelated homepage CMS public-reflection failures for created cards/services. |
| Phase 4 | CMS pages, footer legal pages, dynamic nav | Partial | Header nav/footer and CMS pages read through public DAL/API; authenticated Home CMS edits hero media, collection headings/cards, services and testimonials; `/admin/navigation` edits header links, dropdown links, footer columns and footer links; `/admin/pages` edits legal/service page content; `/admin/home` now also edits footer contact info (tagline/address/phone/email) and social platform hrefs via `GET/PATCH /api/admin/home/footer`. Public DTO only includes `https://` social links; missing configured-DB rows return empty settings not fake copy; contact fields can be cleared without reintroducing static text. `npm run seed:home` restores the DB-backed homepage/footer demo rows without hardcoded public replacement rows. Service landing pages, quick-access settings, and section-level headings are pending. | Authenticated footer settings read/publish/restore verified in `footer-settings-auth-latest.md` (`127/127`, 0 failed); `npm run seed:home` returned published CMS counts and `/api/public/home` + `/api/public/navigation` were checked on localhost; dashboard aggregate explicitly skipped |
| Phase 4 | EN/AR translations | Partial | Public locale/translation API and locale cookie route are wired; `/admin/translations` now edits stored phrases through a protected DTO and audited CRUD; header nav/enquire labels, home hero copy, and hero service labels consume the public bundle with fallback merging | Protected editor/public publish-update-archive lifecycle passed in the `109/109` report; pending full dictionaries and remaining component-level localized rendering |
| Phase 5 | Stripe payment (SP-1 done + hardened) | Done (test-mode hosted Checkout gate) | "Pay hotel add-on with card" in `CheckoutForm`; Stripe Checkout URL redirect; full booking confirmation success page | Migrations: `20260611090000_stripe_payment.sql` (session_id/intent_id/status), `20260611090001_stripe_payment_amounts.sql` (paid_amount/paid_currency/paid_at) — both applied remotely. Routes: `POST /api/public/trips/[d]/[t]/checkout/stripe-session` (returns `{ url }` only, no IDs), `POST /api/webhook/stripe` (raw body sig verify; paid terminal; failed/expired only from pending; 500 on DB fail → Stripe retry). Success page: trip-ownership verified (session_id cross-checked against trip/destination slugs), full booking card (ref, guest, travel date, hotel add-on paid, next steps). CheckoutForm: "Total party size" label, mode-aware copy, no contradictory text. HP-4B (final RateHawk order) deferred — requirements documented in `dev-left/phase-5/left.md`. Smoke: `api-test/run-stripe-sp1-smoke.ps1`. |
| Phase 5 | Provider integrations | In progress (RateHawk HP-1 + HP-2 + HP-3 + HP-4A hotel done; HP-4A hardened 2026-06-12) | Hotels are now provider-backed through search, option selection, recheck/prebook and itinerary selection; flights/transfers/activities confirmed NOT available via RateHawk API and stay manual/enquiry-only | HP-1 foundation: `src/server/providers/ratehawk/{config,client,hotels,errors}.ts` + protected `GET /api/admin/providers/ratehawk/hotel-search-test` (production client: Basic auth, timeouts, retry/backoff, circuit breaker, concurrency limiter, rate-limit capture, sanitized logs). HP-2 wiring: live RateHawk hotel rates flow through the existing public options API (`/api/public/trips/[destination]/[trip]/options?type=hotel`) for segments whose `metadata.hotel_source` is `live`/`hybrid` with a `ratehawk.region_id`; manual `trip_hotel_options` remain as fallback. HP-3 recheck/prebook: `search/hp/` sends numeric `hid`, uses stored `match_hash`, parses `data.hotels[].rates`, obtains hotelpage `book_hash`, then `hotel/prebook/` sends `{ hash: bookHash }`; selected provider booking token is stored server-only as `provider_quote_snapshots.metadata.prebook_hash` and bound to itinerary selection by `prebook_snapshot_id`. Verified endpoint families: `overview`, `search/multicomplete`, `search/serp/region`, `hotel/info`, `search/hp`, `hotel/prebook`. HP-1 smoke `7/7`; HP-2 smoke `10/10`; HP-3 local verification returned `/prebook` 200 and `/selection` 201 with no provider hashes/secrets exposed. HP-4A checkout summary hardening (2026-06-12): prebook snapshot `safe_payload` now stores `cancellation_summary` string, `board_basis`, and `nights`; `CheckoutLineItem` type extended; checkout page shows board basis + nights for live hotel selections. No migration needed (mapping on segment metadata + existing `external_providers`/`provider_quote_snapshots`). HP-4B (final order) deferred with documented requirements. |
| Phase 5 | Resend email notifications | Pending | User-facing forms should stay generic on email failure | Not started |
| Phase 5 | Rate limiting | Pending | Not UI-specific | Not started |

Frontend wiring rule:

- Every new API slice must list its frontend consumer before the slice is considered complete.
- Public pages should consume server DAL/API DTOs, not raw Supabase rows.
- Fallback/static data may remain only when backend configuration is unavailable for development; configured CMS production surfaces must show empty/unavailable states instead of fabricated inventory.
- When admin CRUD is added, the relevant public page must be rechecked so backend changes are visible without manual code edits.

Testing and seeding rule:

- Read `dev/testing-contract.md` before changing backend routes, seed data, smoke tests, provider modules, or admin CRUD.
- `supabase/seed.sql` is for deterministic baseline/demo fixtures and lookup rows only.
- Direct SQL seed does not prove CRUD, auth, audit logging, DTO shaping, frontend wiring, or user-facing error behavior.
- `npm run seed:home` is the repeatable content seed for restoring public homepage/footer CMS rows in a configured development database; it upserts deterministic demo rows and verifies published row counts without printing secrets.
- Backend confidence comes from route-level tests that create, read, update, and delete/archive safe test records through public/admin APIs.
- Every new mutation-capable module should add smoke coverage in `api-test/run-smoke.ps1` or document the blocker in the matching `dev-left/<phase>/left.md`.
- API smoke reports must never print secrets, raw provider payloads, service role keys, card data, real customer PII, or raw backend errors.
- Local admin test accounts are provisioned with `npm run admin:bootstrap` from ignored `ADMIN_DEV_EMAIL`/`ADMIN_DEV_PASSWORD` values. The bootstrap command may create/reset the Supabase Auth account and its active `profiles` row but must never print the password or service-role key.

## Backend Folder Structure

```txt
src/
  app/
    api/
      public/
        navigation/route.ts
        home/route.ts
        trips/route.ts
        trips/[destination]/route.ts
        trips/[destination]/[trip]/route.ts
        trips/[destination]/[trip]/itinerary/route.ts
        trips/[destination]/[trip]/options/route.ts
      pages/[slug]/route.ts
      locale/route.ts
      translations/[locale]/route.ts
      bookings/route.ts
      contact/route.ts
      newsletter/route.ts
      admin/
        session/route.ts
        dashboard/route.ts
        resources/[resource]/route.ts
        resources/[resource]/[id]/route.ts
        trips/[tripId]/segments/route.ts
        trips/[tripId]/segments/[segmentId]/route.ts
        trips/[tripId]/segments/[segmentId]/options/route.ts
        trips/[tripId]/segments/[segmentId]/options/[optionId]/route.ts
        bookings/[id]/route.ts
        media/route.ts
  server/
    admin/
      access.ts
      dal.ts
      dto.ts
      fallback.ts
      itinerary-resources.ts
      resources.ts
    public/
      dal.ts
      dto.ts
      fallback.ts
      filters.ts
    mutations/
      bookings.ts
      contact.ts
      newsletter.ts
      validation.ts
    supabase/
      client.ts
      auth.ts
    http/
      response.ts
      validation.ts
      rate-limit.ts
    providers/
      media.ts
      email.ts
      flights.ts
      hotels.ts
      transport.ts
    itinerary/
      dal.ts
      dto.ts
      selection.ts
  types/
    supabase.ts
    api.ts
supabase/
  migrations/
  seed.sql
```

## Existing Supabase Schema

The initial migration is `supabase/migrations/20260506101603_init_core_schema.sql`.

### Auth And Access

- `profiles`
  - Linked to `auth.users`.
  - Fields: `email`, `full_name`, `role`, `is_active`.
  - Admin protection is based on `role = admin` and active profile.
- Functions:
  - `public.is_admin()`
  - `public.is_editor_or_admin()`
  - `public.set_updated_at()`

### Localization

- `locales`
  - `code`, `name`, `direction`, `is_default`, `is_active`.
  - Existing seed inserts `en` and `ar`.
- `translations`
  - `locale_code`, `namespace`, `translation_key`, `value`, `status`.
  - Used by language toggle for public site and trip pages.

### Media

- `media_assets`
  - Provider metadata for `cloudinary`, `imagekit`, or `external`.
  - Public fields: url, alt text, width/height, folder.
  - Never stores provider secret keys.

### Trip Inventory

- `destinations`
  - Country/city landing data.
  - Slug, name, poster media, result title, package date, currency, map coordinates.
- `trips`
  - Package records.
  - Destination, slug, title, city, overview, price, currency, duration, flights, hotel stars, map coordinates, status.
- Join/detail tables:
  - `trip_categories`
  - `trip_tags`
  - `trip_features`
  - `trip_bullets`
  - `trip_highlights`
  - `trip_inclusions`
  - `trip_exclusions`
  - `trip_terms`
  - `trip_gallery`
  - `trip_itinerary_items`
- Rich itinerary/option tables:
  - `trip_itinerary_segments`
  - `trip_flight_options`
  - `trip_hotel_options`
  - `trip_transfer_options`
  - `trip_activity_options`
  - `trip_option_selection_sessions`
  - `trip_option_selections`
- Views:
  - `published_destination_cards`
  - `published_trip_cards`

### Site CMS

- `services`
  - Flight desk, hotels, cruise, visa, passport, transport, wellness, Hajj/Umrah service cards/pages.
- `collections`
  - Home sections such as Fly Time Picks and route boards.
- `collection_items`
  - Cards inside a collection with title, price, media, href, metadata.
- `site_sections`
  - Flexible JSON content for hero, search config, quick access, social links, etc.
  - `home.hero` now has a protected editor path for public background media and alt text.
- `navigation_items`
  - Header and footer nav.
- `footer_columns`
  - Footer grouping.
- `footer_links`
  - Footer links under columns.
- `pages`
  - Legal/service pages: terms, privacy, refund, about, contact, Hajj, visa, travel desk, etc.
- `testimonials`
  - Traveler reviews and optional image.

Development seed coverage:

- `supabase/seed.sql` now includes published demo rows for CMS pages, homepage hero media, header navigation, footer columns/links, home collections/items, service tiles, testimonials, and EN/AR common/search translations.
- `scripts/seed-home-footer.mjs` can restore just the public home/footer CMS rows after the schema exists, using the same DTO-backed tables instead of static public replacement data.
- These rows let public pages read from Supabase instead of relying only on typed fallback data after the seed is applied.
- The seed contains demo/public content only; no customer PII, provider credentials, admin notes, or API secrets.

### Customer/Admin Operations

- `bookings`
  - Customer booking/enquiry requests.
  - Contains customer name/email/phone and admin notes.
  - Public pages never query this directly.
- `newsletter_subscribers`
  - Email and source.
- `contact_submissions`
  - Contact/enquiry form.
- `audit_log`
  - Tracks admin mutations.
- `admin_dashboard_snapshot()`
  - Server-only aggregate RPC for protected dashboard operational counts and safe audit metadata.
  - Granted only to `service_role`; returns no customer contact fields, notes, raw audit payloads, or secrets.
  - Uses separate trip/enquiry destination rollups and supporting status/date/audit indexes to avoid joined row multiplication as enquiry volume grows.
  - Migration prepared in `supabase/migrations/20260524090000_admin_dashboard_snapshot.sql`; remote deployment is pending due current CLI/project access limitations.

## Schema Extensions Still Needed

The rich itinerary and option model is now part of the schema because the booking screen needs selectable flight, hotel, transfer, and activity options before the final provider integrations are confirmed.

### Provider Metadata

- `external_providers`
  - `slug`, `name`, `service_type`, `is_active`, `base_url`, `metadata`.
  - No secret values.
- `provider_quote_snapshots`
  - Provider, service type, request hash, provider reference, safe payload, price, currency, expiry, status.
  - Stores no raw sensitive provider response and no passenger PII.
- Future `provider_request_logs`
  - Provider, endpoint key, request hash, response status, latency, created_at.
  - Should store no raw PII and no full provider payload unless explicitly safe.

### Itinerary Segment Model

- `trip_itinerary_segments`
  - Defines timeline blocks shown on the booking page.
  - Segment types: `flight`, `transfer`, `hotel`, `activity`, `stay`, `note`.
  - Direction: `outbound`, `return`, `local`.
  - Stores date offset from package start, optional time range, origin/destination labels, IATA codes, map coordinates, required/changeable flags, and display order.
  - Public reads are allowed only when the parent trip is published.
  - Admin/editor writes are protected by RLS.

### Flight Module

- `flight_enquiries`
  - Customer contact, origin, destination, departure date, return date, cabin, travelers, flexible dates, status.
- `trip_flight_options`
  - Child options for flight segments.
  - Stores airline, logo URL, flight number, origin/destination IATA and labels, departure/arrival timestamps, duration, stops, layover airports, cabin, fare class, baggage label, price delta, currency, default flag, status, expiry, and safe metadata.
  - Provider payload is represented through `provider_quote_snapshots`; raw secrets/full responses are not exposed.

### Hotel Module

- `hotel_enquiries`
  - Destination/city, check-in, check-out, rooms, adults, children, room preference, budget, status.
- `trip_hotel_options`
  - Child options for hotel segments.
  - Stores hotel name, address, star rating, room name, board basis, check-in/out offsets, nights, coordinates, image URL/media, guest rating, amenities, price delta, currency, default flag, status, expiry.

### Transport Module

- `transport_enquiries`
  - Pickup, drop-off, date/time, vehicle type, passengers, luggage, status.
- `trip_transfer_options`
  - Child options for transfer segments.
  - Stores pickup/drop labels, vehicle title/type/image, luggage count, passenger min/max, duration, price delta, currency, default flag, status, expiry.

### Activity Module

- `trip_activity_options`
  - Child options for activity segments.
  - Stores day offset, title, description, category, duration, pickup included flag, location, coordinates, image/media, price delta, currency, default flag, status, expiry.

### Selection Session Model

- `trip_option_selection_sessions`
  - Server-controlled quote/selection session for a user choosing options before final booking.
  - Stores hashed session token only, trip, optional booking, travel date, travelers, total selected delta, expiry, and status.
  - Status: `draft`, `submitted`, `expired`, `converted`.
  - Direct Supabase reads/writes are admin-only; public browser must use Next route handlers.
- `trip_option_selections`
  - Stores selected option per itinerary segment.
  - Uses explicit nullable FKs for flight/hotel/transfer/activity options and a check constraint so exactly one option is selected.
  - Stores price delta snapshot so provider quote changes do not corrupt an already-selected session.

### Rate Limiting

- `rate_limit_events` or external Redis/Upstash store.
  - Key hash, route, created_at.
  - Needed before public mutation routes go live at scale.

## Public API Routes

### `GET /api/public/navigation`

Returns safe public navigation DTOs.

Response:

- `header`
- `footer`

Backend source:

- `navigation_items`
- `footer_columns`
- `footer_links`

Fallback:

- Header navigation reads published database rows when present. If no published header rows exist, it falls back to the permanent Fly Time baseline menu so the public header never renders blank.
- Footer columns still read published database rows when Supabase is configured; footer fallback is only for unconfigured local development.
- The baseline header menu is Flights, Visa Desk, Holidays, Wellness, Travel Desk, Hajj & Umrah, and Journal. Hajj & Umrah links to the dedicated `/hajj-umrah` page.

### `GET /api/public/home`

Returns the public home page DTO.

Response:

- `navigation`
- `hero`
- `quickAccess`
- `flyTimePicks`
- `routeBoard`
- `services`
- `testimonials`
- `footer`
- `socialLinks`

Backend source:

- `navigation_items`
- `site_sections`
- `collections`
- `collection_items`
- `services`
- `testimonials`
- `footer_columns`
- `footer_links`

Current hero behavior:

- Public DTO exposes only normalized `hero.backgroundImage` and `hero.backgroundAlt`.
- Published hero media is read from the `site_sections` row keyed `home.hero`.
- Invalid or missing media falls back to the typed bundled hero.
- Admin-entered external media is restricted to approved HTTPS image hosts configured for Next Image.

### `GET /api/public/trips`

Returns destination cards for `/trips`.

Query:

- `locale`
- `limit`
- `offset`

Response:

- `destinations[]`
- `total`

Backend source:

- `published_destination_cards`

### `GET /api/public/trips/[destination]`

Returns one destination with filter metadata and trip cards.

Query:

- `q`
- `city`
- `minDuration`
- `maxDuration`
- `flights` = `with | without`
- `stars`
- `categories`
- `sort` = `recommended | cheapest | duration`
- `limit`
- `offset`

Response:

- `destination`
- `destinations`
- `filters`
- `packages`
- `total`
- `rangeLabel`

Backend source:

- `destinations`
- `published_trip_cards`
- categories/tags aggregate counts.

### `GET /api/public/trips/[destination]/[trip]`

Returns full trip detail.

Response:

- `destination`
- `package`
- `gallery`
- `features`
- `bullets`
- `highlights`
- `inclusions`
- `exclusions`
- `terms`
- `itinerary`
- `mapLocation`
- `recommended`

Current content behavior:

- `trip_inclusions`, `trip_gallery`, and `trip_itinerary_items` are returned as safe public DTO fields.
- When selectable itinerary segments are not present, the trip detail page renders stored `trip_itinerary_items` day title/body rows instead of hardcoded day copy.
- The public DAL selects only the columns required for each DTO; admin-only fields and raw database rows are not sent to the browser.

Backend source:

- `trips`
- all trip detail child tables.

### `GET /api/public/trips/[destination]/[trip]/itinerary`

Returns the booking-page itinerary timeline.

Response:

- `trip`
- `segments[]`
- `summaryTimeline[]`
- default selected options for flight, hotel, transfer, and activity blocks
- safe map coordinates only

Backend source:

- `trip_itinerary_segments`
- `trip_flight_options`
- `trip_hotel_options`
- `trip_transfer_options`
- `trip_activity_options`

### `GET /api/public/trips/[destination]/[trip]/options`

Returns selectable options for one segment.

Query:

- `segmentId`
- `type` = `flight | hotel | transfer | activity`
- flight filters: `stops`, `airline`, `layover`, `departFrom`, `departTo`, `arriveFrom`, `arriveTo`, `sort`
- hotel filters: `q`, `stars`, `room`, `sort`
- transfer filters: `vehicle`, `pax`, `sort`
- activity filters: `day`, `category`, `pickup`, `sort`

Response:

- `segment`
- `filters`
- `options[]`
- `total`

Rules:

- The browser receives only safe option DTOs.
- Provider references, request hashes, and raw payloads stay server-side.

### `POST /api/public/trips/[destination]/[trip]/selection`

Creates or updates a server-side option selection session.

Accepted input:

- `sessionToken` if continuing an existing session
- `travelDate`
- `travelersCount`
- `segmentId`
- `optionType`
- `optionId`

Response:

- safe `sessionId`
- selected segment summary
- total price delta
- itinerary summary

Rules:

- Store only a hashed session token.
- Validate option belongs to the trip and segment.
- Reject expired or unavailable options.
- Recalculate total server-side.

### `GET /api/public/pages/[slug]`

Returns a published CMS/legal/service page.

Response:

- `title`
- `excerpt`
- `body`
- `seo`

### `GET /api/public/translations/[locale]`

Returns dictionaries by namespace.

Query:

- `namespace`

Response:

- `locale`
- `direction`
- `messages`

Current status:

- Implemented with Supabase-backed `locales` and `translations` reads.
- Falls back to safe EN/AR common/search dictionaries when DB content is missing.
- Merges DB translation rows over fallback messages so partial production dictionaries do not blank missing labels.
- Header receives public locale metadata from the server and renders the visible language selector without exposing private data.
- Header navigation labels, header enquire CTA, home hero copy, quick access labels, and hero service labels read from the public translation bundle.
- Full page-copy replacement still requires real translation rows and component-level message wiring across remaining sections.

### `GET /api/public/locale`

Sets the public locale preference and redirects back to a safe local path.

Query:

- `locale`
- `returnTo`

Rules:

- Only resolves to supported public locales.
- `returnTo` must be a same-site path; external redirects are rejected.
- Stores the locale in an HTTP-only, same-site cookie.
- No user, booking, provider, or secret data is stored in the cookie.

## Public Mutation Routes

### `POST /api/bookings`

Creates a booking/enquiry.

Accepted input:

- `tripSlug`
- `destinationSlug`
- `fullName`
- `email`
- `phone`
- `nationality`
- `travelersCount`
- `travelDate`
- `message`
- future: selected add-ons, room choice, flight preference.

Response:

- Success: `{ ok: true, message: "Your request has been received." }`
- Failure: generic error only.

Server work:

- Validate input.
- Resolve trip/destination IDs server-side.
- Insert into `bookings` using service role.
- Send admin email through Resend when configured.
- No raw error details in response.

### `POST /api/newsletter`

Accepted input:

- `email`
- `locale`
- `source`

Server work:

- Validate email.
- Upsert subscriber.
- No duplicate email leak.

### `POST /api/contact`

Accepted input:

- `fullName`
- `email`
- `phone`
- `subject`
- `message`
- `source`

Server work:

- Validate input.
- Insert into `contact_submissions`.
- Send admin notification when configured.

## Admin API Routes

All admin routes verify admin/editor access before returning private data. The preview token path exists only for local smoke testing; production admin sessions use verified Supabase Auth/profile access.

### `GET /api/admin/dashboard`

Returns dashboard DTO:

- metrics
- package cards
- recent bookings
- destination stats
- content queue
- activity feed
- enquiry/conversion chart data
- calendar items
- operational quick stats only; revenue remains absent until payment/provider data exists

Current implementation:

- When the database migration is applied, `dataSource = database` and the dashboard reads `admin_dashboard_snapshot()` plus compact published-trip/recent-enquiry DTOs.
- The aggregate RPC computes counts in PostgreSQL rather than loading full tables into the Next.js process.
- Empty database results render as empty/zero states and do not substitute demo package cards or destination activity.
- A typed fallback exists only for environments without working backend configuration; the protected smoke check rejects fallback output when verifying a configured development database.

### `GET /api/admin/resources/[resource]`

Allowed resources:

- bookings
- destinations
- trips
- categories
- media
- home
- pages
- navigation
- translations
- newsletter
- users
- settings
- audit-log

Response:

- resource config
- stats
- columns
- rows
- queue
- allowed actions

Current read behavior:

- CRUD-backed protected modules read ordered compact DTO rows from Supabase; newsletter/profile fields are redacted before they reach the admin UI.
- `audit-log` reads only safe operational metadata (`action`, entity table and time), never the stored before/after payload.
- Destination/trip resource list rows and dashboard recent enquiries use compact live DTOs. Protected dashboard operational aggregates are implemented through `admin_dashboard_snapshot()` but cannot be counted as live-verified until its pending migration is deployed. Resource-page statistics/queue panels still require dedicated database aggregation.

### Admin CRUD Routes

Implemented generic resource routes:

- `POST /api/admin/resources/[resource]`
- `PATCH /api/admin/resources/[resource]/[id]`
- `DELETE /api/admin/resources/[resource]/[id]`

Implemented resource-specific CMS route:

- `GET /api/admin/home/hero`
- `PATCH /api/admin/home/hero`
- `GET /api/admin/home/content`
- `POST /api/admin/home/content/[entity]`
- `PATCH /api/admin/home/content/[entity]/[id]`
- `DELETE /api/admin/home/content/[entity]/[id]`
- `GET /api/admin/navigation/content`
- `POST /api/admin/navigation/content/[entity]`
- `PATCH /api/admin/navigation/content/[entity]/[id]`
- `DELETE /api/admin/navigation/content/[entity]/[id]`
- `GET /api/admin/pages/content`
- `GET /api/admin/translations/content`

The Home hero route accepts a trusted public image URL, accessible alt text, and publish state; it writes a safe audit entry and revalidates the homepage. It does not expose media-provider credentials or raw database records.

Home content entities are `collections`, `items`, `services`, and `testimonials`. The content routes validate publish-ready fields, internal links and approved stored media references before publishing; writes are audited and revalidate the public homepage. In configured database mode, unpublished or incomplete rows are excluded instead of being replaced with static public content.

Navigation content entities are `header-items`, `footer-columns`, and `footer-links`. The routes validate internal same-site hrefs, publish state, and published parent relationships; writes are audited and revalidate the shared public layout and navigation API.

Generic CMS resource updates preserve stable public identifiers by default: editing a destination, trip, category or page title does not silently regenerate its slug, and editing a site-section title does not silently regenerate its key. An explicit slug/key field is required to intentionally change a public identifier.

`/admin/pages` reads full protected page content through `GET /api/admin/pages/content` and saves through the audited generic page mutations. Publishing a CMS page now requires a non-empty public slug, title and body; drafts may be completed before publication.

`/admin/translations` reads full protected phrase content through `GET /api/admin/translations/content` and saves through audited generic translation mutations. Translation writes validate locale, namespace and key identifiers; publishing requires non-empty text and revalidates locale-dependent public surfaces.

Implemented trip-detail content routes:

- `GET /api/admin/trips/[tripId]/content/[contentType]`
- `POST /api/admin/trips/[tripId]/content/[contentType]`
- `PATCH /api/admin/trips/[tripId]/content/[contentType]/[itemId]`
- `DELETE /api/admin/trips/[tripId]/content/[contentType]/[itemId]`

Supported `contentType` values are `highlights`, `inclusions`, `exclusions`, `terms`, `gallery`, and `itinerary`. `/admin/trips` now exposes a real editor workspace for those records, including trip switching through protected reads. Gallery URLs are restricted to trusted public delivery hosts, optional itinerary map fields can be cleared safely through validated updates, all writes are audited, and public trip detail consumes the resulting DTOs. These core tables currently do not have draft/version columns, so edits to a published trip become public immediately until a versioned content workflow is added.

All trip, content, segment, and option mutations invalidate the trip list, destination result pages, and dynamic trip-detail page pattern using Next 16 `revalidatePath` route-pattern rules, so subsequent public navigation resolves updated backend data.

Implemented itinerary/option routes:

- `POST /api/admin/trips/[tripId]/segments`
- `PATCH /api/admin/trips/[tripId]/segments/[segmentId]`
- `DELETE /api/admin/trips/[tripId]/segments/[segmentId]`
- `POST /api/admin/trips/[tripId]/segments/[segmentId]/options`
- `PATCH /api/admin/trips/[tripId]/segments/[segmentId]/options/[optionId]?type=flight|hotel|transfer|activity`
- `DELETE /api/admin/trips/[tripId]/segments/[segmentId]/options/[optionId]?type=flight|hotel|transfer|activity`

Every implemented mutation:

- Validates the request body.
- Re-checks admin/editor role.
- Uses the service role only in server-only modules.
- Writes an audit log row.
- Returns safe DTOs and generic errors only.
- Revalidates admin/public paths related to trips and CMS data.

Remaining resource-specific editor screens are tracked under `dev-left/phase-3/left.md`.

Authenticated lifecycle verification:

- `api-test/reports/latest.md` passed against the approved development database on 2026-05-23.
- Public booking creation is read back through both the protected dashboard recent-bookings DTO and booking inbox API, then soft-cancelled through the admin API.
- Interrupted `API Smoke Tester` enquiries are also soft-cancelled by the suite so no test enquiry remains actionable.
- Home hero, homepage collection/card/service/testimonial CMS, CMS page, translation, trip inclusion/gallery/itinerary, itinerary segment/option, and safe audit-log metadata paths were exercised through APIs.
- `api-test/reports/home-cms-latest.md` passed `75/75` for the Home CMS extension, including protected create/update/archive and public DTO reflection. Its dashboard assertion was explicitly skipped because that separate aggregate migration remains undeployed.
- `api-test/reports/navigation-cms-latest.md` passed `109/109` for the navigation/footer/page/translation/trip-content extension, including protected header/footer create-update-archive, protected page and translation editor readback, validation rejection, public DTO reflection, stable CMS page URL verification, public phrase publish/update/archive reflection, protected trip inclusion/gallery/itinerary editor readback, optional itinerary map-field clearing, and safe audit assertions. Its dashboard aggregate assertion was explicitly skipped because that separate migration remains undeployed.
- `api-test/reports/trip-content-latest.md` passed `28/28` after extending trip highlights/exclusions/terms, but that run did not include an admin token, so it verified public routes and protected anonymous rejection only. Rerun with `ADMIN_PREVIEW_TOKEN` before marking the new text-content mutation lifecycle authenticated.
- The new protected dashboard aggregate assertion has been added to `api-test/run-smoke.ps1` but remains blocked until `supabase/migrations/20260524090000_admin_dashboard_snapshot.sql` is applied remotely.

### Resource-Specific CRUD Routes Still Optional

- `POST /api/admin/destinations`
- `PATCH /api/admin/destinations/[id]`
- `POST /api/admin/trips`
- `PATCH /api/admin/trips/[id]`
- `POST /api/admin/trips/[id]/segments`
- `PATCH /api/admin/trips/[id]/segments/[segmentId]`
- `DELETE /api/admin/trips/[id]/segments/[segmentId]`
- `POST /api/admin/trips/[id]/segments/[segmentId]/options`
- `PATCH /api/admin/trips/[id]/segments/[segmentId]/options/[optionId]`
- `DELETE /api/admin/trips/[id]/segments/[segmentId]/options/[optionId]`
- `POST /api/admin/media`
- `PATCH /api/admin/bookings/[id]`
- `PATCH /api/admin/pages/[id]`
- `PATCH /api/admin/navigation/[id]`
- `PATCH /api/admin/translations/[id]`

Any future resource-specific mutation must:

- Validate request body.
- Re-check admin/editor role.
- Write audit log.
- Return safe DTO only.
- Revalidate related paths/tags if using cached public pages.

## Admin UI Routes

- `/admin`
  - Dashboard overview.
- `/admin/bookings`
  - Booking inbox and status management.
- `/admin/destinations`
  - Country/city destination manager.
- `/admin/trips`
  - Trip highlights, inclusions, exclusions, terms, gallery and itinerary-day editor is connected to protected reads/writes and public trip-detail output; core package fields and versioned publication workflow remain to be added.
- `/admin/categories`
  - Categories and tags.
- `/admin/media`
  - Image/video manager.
- `/admin/home`
  - Hero background, homepage collection/card, service, and testimonial editors are connected to protected APIs and public homepage output.
  - Quick access controls and remaining section-level display settings still need dedicated production editor screens.
- `/admin/pages`
  - Legal/service page editor is connected to protected full-content reads, audited CRUD writes and dynamic public page rendering.
- `/admin/navigation`
  - Header links/dropdown parents and footer columns/links are connected to protected APIs and public shared-layout output.
- `/admin/translations`
  - EN/AR content dictionary editor is connected to protected stored-translation reads and audited CRUD writes; published changes are visible through the public locale bundle.
- `/admin/newsletter`
  - Subscriber list.
- `/admin/users`
  - Admin/editor access.
- `/admin/settings`
  - Safe config health only.
- `/admin/audit-log`
  - Activity and sensitive operations.

## Public UI Routes That Need Backend Data

- `/`
  - Home CMS, nav, footer, testimonials.
- `/trips`
  - Destination list, default selected destination listing.
- `/trips/[destination]`
  - Destination trip list with filter sidebar.
- `/trips/[destination]/[tripSlug]`
  - Trip booking/detail page.
- `/terms`
- `/privacy`
- `/refund-policy`
- `/about`
- `/contact`
- `/hajj-umrah`
- `/gulf-visa`
- `/global-visa`
- `/travel-desk`
- `/wellness`
- Future:
  - `/flights`
  - `/hotels`
  - `/transport`
  - service-specific booking/enquiry pages.

## Filter Sidebar Change

Client requested a sidebar/menu-style filter instead of the current drawer behavior.

Required behavior:

- Desktop: persistent left filter sidebar beside package results.
- Tablet/mobile: slide-in sidebar from the left for easier thumb reach.
- Same filters:
  - destination/city
  - search keyword
  - duration min/max
  - flights with/without
  - hotel stars
  - categories/tags
  - sort
- Filter values should round-trip through query params for sharable URLs later.

## Booking/Service Pages Still Pending

Screens are pending from client:

- Trip booking/enquiry flow.
- Flight page/search/enquiry.
- Hotel page/search/enquiry.
- Transport page/enquiry.

Backend assumptions until screens arrive:

- No online payment yet.
- Form submissions become admin enquiries.
- Provider API results are server-fetched, cached, and redacted before client render.
- Customers do not need login unless client later confirms account features.
- Option selection happens in a temporary server-side session before final booking/enquiry submission.
- The right-side mini timeline is generated from itinerary segments plus selected/default options.

## Provider Integrations

### Media

Potential providers:

- Cloudinary
- ImageKit

Needed keys:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `IMAGEKIT_PUBLIC_KEY`
- `IMAGEKIT_PRIVATE_KEY`
- `IMAGEKIT_URL_ENDPOINT`

Rules:

- Upload/signing endpoints are server-only.
- Browser receives upload signature only if provider flow requires it and signature scope is limited.
- Store transformed public URLs in `media_assets`.

### Email

Provider:

- Resend preferred unless client chooses another.

Needed keys:

- `RESEND_API_KEY`
- `ADMIN_NOTIFICATION_EMAIL`

Rules:

- Email send happens after DB insert.
- Failed email should not lose the customer submission.

### Flight/Hotel/Transport APIs

Needed from client:

- Provider name.
- API base URL/docs.
- Auth method.
- API key/client id/secret.
- Sandbox credentials.
- Rate limits.
- Required passenger/hotel/transport fields.
- Quote expiration rules.
- Whether booking is live booking or enquiry-only.

Provider safety rules:

- Provider API keys must be used only in `src/server/providers/*`.
- Public option APIs must normalize provider responses into `trip_*_options` or safe in-memory DTOs.
- Store provider result snapshots only when the payload is safe and useful for replay/debug.
- Never log full provider requests when they include traveler/customer data.
- Provider caches must respect quote expiry.

## Environment Variables

Public:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`

Server-only:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_PASSWORD`
- `RESEND_API_KEY`
- `ADMIN_NOTIFICATION_EMAIL`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `IMAGEKIT_PUBLIC_KEY`
- `IMAGEKIT_PRIVATE_KEY`
- `IMAGEKIT_URL_ENDPOINT`
- Future provider API secrets.
- `ADMIN_PREVIEW_TOKEN` for temporary direct admin API testing before real auth.

## Scale And Performance

- Use indexed views/queries for listing pages.
- Keep list DTOs compact; fetch trip detail only on detail page.
- Paginate admin and public lists.
- Avoid logging request bodies with PII.
- Add rate limiting to public mutation routes.
- Use provider response cache for expensive flight/hotel lookups.
- Use quote/session expiry so stale provider prices cannot be selected.
- Validate option ownership by trip and segment before saving selections.
- Use image transformations and Next image sizes.
- Avoid `select *`; select only needed fields.
- Keep static fallback out of client bundles.

## Implementation Phases

### Phase 1: Backend Foundation

- Backend plan file.
- Server-only Supabase helpers.
- Safe JSON response helpers.
- Public and admin DAL modules.
- Route handlers for core read/mutation routes.
- Admin dashboard data loaded via DAL instead of component-level mock imports.
- Protected dashboard operational summaries computed through a server-only aggregate RPC; its deployment must be completed in the target Supabase project.

### Phase 2: Public Dynamic Trips

- Replace `src/data/trips.ts` reads with public DAL.
- Seed current trips into Supabase.
- Add filter query support.
- Replace drawer with persistent/slide-in filter sidebar.
- Add itinerary timeline API for trip booking/detail page.
- Add safe option APIs for flight, hotel, transfer, and activity changes.
- Add selection session API that updates the itinerary without exposing provider internals.

### Phase 3: Admin CRUD

- Admin auth.
- Admin forms.
- CRUD route handlers.
- Audit log.
- Media manager.
- Validation and error boundaries.
- CRUD for itinerary segments and segment option records.

### Phase 4: CMS Pages And Locale

- Footer legal pages.
- Header/footer dynamic nav.
- Home CMS sections.
- EN/AR dictionary and route-level language handling.
- Backend-managed service landing content for frontend baseline pages such as `/gulf-visa` and `/global-visa`.

### Phase 5: Booking And Provider Modules

- Booking form.
- Flight API integration.
- Hotel API integration.
  - HP-1 RateHawk/ETG hotel provider foundation: **done** (server-only config/client/adapter + protected admin readiness/search test route, verified against the live test key). See `dev/ratehawk-hp1-implementation-note.md`.
  - HP-2 package hotel option wiring: **done** (live quotes into `trip_hotel_options` + `provider_quote_snapshots`, manual fallback preserved, selection/booking safe). See `dev/ratehawk-hp2-implementation-note.md`.
  - HP-3 prebook/recheck: **done** (search/hp/ adapter sends numeric `hid`, uses stored `match_hash`, parses `data.hotels[].rates`, obtains the hotelpage `book_hash`, then hotel/prebook sends `{ hash: bookHash }`; prebook route `POST /api/public/trips/[d]/[t]/prebook`; price-change + unavailable UI in TripItineraryPlanner; provider booking token stored server-only as `provider_quote_snapshots.metadata.prebook_hash`). See `dev/ratehawk-hp3-implementation-note.md`.
  - HP-4A checkout/review flow with prebook gate: **done** (2026-06-10). See below.
  - HP-5 static content sync + mapping admin: pending (hotel names/images currently fetched live per-hotel via `hotel/info`; a cached dump removes that per-request cost).
- Transport enquiry/provider integration (RateHawk confirmed: no transfer API on this account — keep manual/enquiry).
- Flight API integration (RateHawk confirmed: no flight API on this account — keep manual/enquiry until a flight provider is supplied).
- Email notifications.
- Rate limiting (per-host circuit breaker + outbound concurrency limiter exist in the RateHawk client; a shared/distributed limiter for multi-instance deploys is still pending).
- Provider quote snapshot retention/cleanup job.

## Client Questions File

Open questions and API key requests should be tracked in `.clientmd`.

Current confirmed assumptions:

- Supabase is the database.
- Cloudinary or ImageKit will handle media.
- Public customers do not need login yet.
- Admin dashboard must exist first, backend connection follows.
- Flight/hotel provider details are pending.
