# Fly Time Full Backend Plan

This file is the backend source of truth for Fly Time. Keep it updated whenever schema, routes, auth, provider integrations, or admin modules change.

## Goals

- Replace hardcoded public/admin data with Supabase-backed data access.
- Keep customer data, booking details, API keys, provider secrets, and admin notes server-only.
- Support at least 10k active users without coupling UI components directly to database rows.
- Make admin pages useful now with mock/fallback-safe DTOs, but keep the final data shape aligned with Supabase.
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
| Phase 1 | Public booking/contact/newsletter routes | Partial | Existing forms can call these routes; email send/rate limit still pending | Booking route tested |
| Phase 1 | Admin dashboard read APIs | Partial | Admin UI reads DAL-backed preview/fallback data | Build passed; admin preview token still temporary |
| Phase 2 | Itinerary/options schema | Done | Booking UI wiring still pending | Remote migration applied |
| Phase 2 | Itinerary timeline API | Done | Pending frontend booking-page timeline replacement | Smoke tested |
| Phase 2 | Flight/hotel/transfer/activity option APIs | Done for seeded/manual options | Pending modal/sidebar option picker UI wiring | Smoke tested flight options |
| Phase 2 | Selection session API | Done | Pending frontend selection state wiring | Smoke tested with HTTP-only cookie |
| Phase 2 | Booking linked to selected option session | Done | Existing booking API supports linked option session; final booking form UI still pending | Smoke tested and DB-count verified |
| Phase 2 | Trip list filters | Partial | API supports query filters; current UI still needs sidebar/menu behavior cleanup and URL round-trip | Public destination filter API tested |
| Phase 2 | Remove static trip dependency | Partial | DAL falls back to `src/data/trips.ts` when DB is unavailable; final production mode should rely on Supabase seed/admin data | Pending final cleanup |
| Phase 3 | Admin CRUD APIs | Pending | Admin forms still demo/read-focused | Not started |
| Phase 3 | Audit log writes for admin mutations | Pending | Not UI-specific | Not started |
| Phase 3 | Media manager | Pending | Admin media UI pending | Not started |
| Phase 4 | CMS pages, footer legal pages, dynamic nav | Pending | Footer/nav/home still need full backend wiring | Not started |
| Phase 4 | EN/AR translations | Pending | Language toggle is not backend-backed yet | Not started |
| Phase 5 | Provider integrations | Pending | Flight/hotel/transport screens need provider-backed option data | Waiting on provider docs/credentials |
| Phase 5 | Resend email notifications | Pending | User-facing forms should stay generic on email failure | Not started |
| Phase 5 | Rate limiting | Pending | Not UI-specific | Not started |

Frontend wiring rule:

- Every new API slice must list its frontend consumer before the slice is considered complete.
- Public pages should consume server DAL/API DTOs, not raw Supabase rows.
- Fallback/static data may remain only as a development safety net until the matching admin CRUD and seed data exist.
- When admin CRUD is added, the relevant public page must be rechecked so backend changes are visible without manual code edits.

## Backend Folder Structure

```txt
src/
  app/
    api/
      public/
        home/route.ts
        trips/route.ts
        trips/[destination]/route.ts
        trips/[destination]/[trip]/route.ts
        trips/[destination]/[trip]/itinerary/route.ts
        trips/[destination]/[trip]/options/route.ts
        pages/[slug]/route.ts
        translations/[locale]/route.ts
      bookings/route.ts
      contact/route.ts
      newsletter/route.ts
      admin/
        dashboard/route.ts
        resources/[resource]/route.ts
        bookings/[id]/route.ts
        media/route.ts
  server/
    admin/
      dal.ts
      dto.ts
      fallback.ts
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

All admin routes must verify admin/editor access before returning private data. Until auth is wired, server data access may use a fallback DTO for preview only.

### `GET /api/admin/dashboard`

Returns dashboard DTO:

- metrics
- package cards
- recent bookings
- destination stats
- content queue
- activity feed
- chart data
- calendar items
- finance quick stats

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

### Future CRUD Routes

- `POST /api/admin/destinations`
- `PATCH /api/admin/destinations/[id]`
- `POST /api/admin/trips`
- `PATCH /api/admin/trips/[id]`
- `POST /api/admin/trips/[id]/gallery`
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

Every mutation must:

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
  - Package manager.
- `/admin/categories`
  - Categories and tags.
- `/admin/media`
  - Image/video manager.
- `/admin/home`
  - Hero, quick access, Fly Time Picks, route board, services, testimonials.
- `/admin/pages`
  - Legal/service pages.
- `/admin/navigation`
  - Header/footer menus.
- `/admin/translations`
  - EN/AR content dictionary.
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
- `/visa-desk`
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

### Phase 5: Booking And Provider Modules

- Booking form.
- Flight API integration.
- Hotel API integration.
- Transport enquiry/provider integration.
- Email notifications.
- Rate limiting.
- Provider quote snapshot retention/cleanup job.

## Client Questions File

Open questions and API key requests should be tracked in `.clientmd`.

Current confirmed assumptions:

- Supabase is the database.
- Cloudinary or ImageKit will handle media.
- Public customers do not need login yet.
- Admin dashboard must exist first, backend connection follows.
- Flight/hotel provider details are pending.
