# Phase 5 Carry-Over

Phase 5 (booking + provider modules) has started. This session implemented the
RateHawk / ETG hotel provider **foundation** (HP-1) only. Everything is
server-only; the browser never calls RateHawk.

## Done (HP-1: RateHawk hotel provider foundation)

- Server-only env resolver: `src/server/providers/ratehawk/config.ts`
  - Selects the active env via `RATEHAWK_ENV` (sandbox | test | prod).
  - Returns redacted readiness (`configured`, host origin only, presence flags,
    list of missing var names). Credentials never leave the module, never logged.
- Production-grade server-only HTTP client: `src/server/providers/ratehawk/client.ts`
  - HTTP Basic auth (KEY_ID:API_KEY) built per request; never logged.
  - Bounded per-request timeouts via `AbortController`, cancels on inbound abort.
  - Safe retry with exponential backoff + jitter for **idempotent reads only**
    (overview/suggest/search); non-idempotent calls (future prebook/booking)
    will pass `idempotent:false` and never auto-retry.
  - Per-host circuit breaker (opens after 5 consecutive failures, 15s cooldown,
    half-open trial) so a provider outage fails fast under load.
  - Outbound concurrency limiter (semaphore, cap 24) to respect ETG simultaneous
    request limits and protect us at 10k+ concurrent users.
  - Rate-limit header capture (`X-RateLimit-*` / `RateLimit-*` / `Retry-After`).
  - Typed `RateHawkError` with codes; sanitized logs (method, path, status,
    attempt, ms, rate-limit remaining, short provider code only).
- Hotel adapter: `src/server/providers/ratehawk/hotels.ts`
  - Only **verified** ETG v3 endpoints implemented:
    - `GET  /api/b2b/v3/overview/` — credentials + per-endpoint permission/limits.
    - `POST /api/b2b/v3/search/multicomplete/` — region/hotel autocomplete.
    - `POST /api/b2b/v3/search/serp/region/` — hotel availability by region.
  - Strict server-side validation (dates, residency ISO-2, 1-4 rooms, 1-6 adults,
    0-4 children aged 0-17, ≤30 nights, ≤730 days ahead, currency/language).
  - Sanitized DTOs only (hid, rates count, cheapest amount, currency, totals).
    No raw provider payloads, no internal hashes exposed in this slice.
  - 5-minute in-process search cache (per commitments) with bounded size.
- Friendly error mapper: `src/server/providers/ratehawk/errors.ts`
  - Validation errors -> safe 400 with their own short message.
  - Every provider/network error -> generic message (429/502/503); raw cause
    stays in server logs only.
- Protected admin test route:
  `GET /api/admin/providers/ratehawk/hotel-search-test`
  - `verifyAdminApiAccess(request, "editor")`; anonymous -> 401.
  - `mode=overview|suggest|search`; returns `configured:false` (HTTP 200) when
    credentials are missing so build/admin tooling stay healthy.
  - Writes an audit log entry (`provider.ratehawk.hotel_search_test`) with
    `{ provider, env, mode }` only — no secrets.
- Env placeholders already present in `.env.example` (no values committed).
- Tests:
  - `api-test/run-smoke.ps1`: added anonymous-rejection step for the provider route.
  - New focused `api-test/run-ratehawk-smoke.ps1` writes
    `api-test/reports/ratehawk-hotel-foundation-latest.{md,json}`.
  - Result: **7/7 PASS** against the live **test** key (overview 25 endpoints,
    suggest 5 regions/5 hotels, region search 47 hotels, no secret leak,
    anonymous rejection, validation rejection).
- Verification: `npx tsc --noEmit`, `npm run lint`, `npm run build` all clean;
  route registered in the build output.

## Done (HP-2: package hotel option wiring)

- Provider mapping decision: **no migration needed.** Region + source mode live on
  `trip_itinerary_segments.metadata` (read on the existing segment lookup; not
  searched/filtered), e.g.
  `{ "hotel_source": "live"|"hybrid"|"manual", "ratehawk": { "region_id": 475, "nights": 2, "residency": "ae" } }`.
  Set through the existing admin segment update API (no new endpoint). If a
  cross-cutting, queryable mapping is ever needed (HP-5 admin review), add a
  dedicated `provider_destination_mappings` table then.
- Price extraction fixed: rates read `payment_options.payment_types[].show_amount`
  / `show_currency_code` (was reading a non-existent `rate.show_amount`, hence the
  null `cheapestAmount`). Verified live: cheapest 56 USD etc.
- New adapter ops in `hotels.ts`: `searchRegionRatesDetailed` (per-hotel cheapest
  rate + server-only `search_hash`/`match_hash` + room/meal) and `getHotelStaticInfo`
  (`POST /api/b2b/v3/hotel/info/` → name/star/image/address). Meal slugs normalized
  to the committed board-basis labels.
- New orchestrator `src/server/providers/ratehawk/hotel-options.ts`: region search →
  enrich cheapest N (bounded, default 12) with static content → safe `LiveHotelQuote[]`.
- DAL wiring (`src/server/itinerary/dal.ts`):
  - `getOptionsByType` dispatches hotel to manual / live / hybrid by source mode.
    Manual query now filters `provider_id is null` so live rows are not double-served.
  - `getLiveHotelOptions` persists `provider_quote_snapshots` (server-only hashes in
    snapshot metadata) + selectable `trip_hotel_options` rows (provider_id,
    quote_snapshot_id, 30-min `expires_at`), reusing fresh rows by `request_hash`
    and expiring stale ones. Search currency = trip currency (no FX mismatch).
  - Ensures a single `external_providers` row (`ratehawk-hotel`) lazily; no creds in DB.
  - `getAdminOption` now rejects expired options (`expires_at` filter) and returns the
    `quote_snapshot_id`; selection stores `{ provider, quote_snapshot_id }` in the
    selection metadata.
  - Live failures are swallowed (logged sanitized) so the page always falls back.
- Frontend: `TripItineraryPlanner` shows a "Live rates" badge for `isLive` hotels;
  existing loading skeletons + generic error states cover live results.
- Tests: `api-test/run-ratehawk-hp2-smoke.ps1` → `ratehawk-hp2-latest.{md,json}`,
  **10/10** against the live test key (manual fallback, hybrid live options=12,
  no hash/secret leak, live select, booking attaches session, unknown option
  rejected, segment reverted to manual).

## RateHawk account confirmations (2026-06-09)

- Fly Time is on the **Affiliate API** product (not B2B) commercially. NOTE: this
  key's `overview` lists `api/b2b/v3/...` paths and live calls succeed on them, so
  the implemented `/api/b2b/v3/...` paths are correct for this key. Re-confirm the
  exact path family at certification; affiliate equivalents are `/api/affiliate/v3/...`.
- **No sandbox keys** for Affiliate API — only the **test** key. Sandbox-only flows
  cannot be exercised.
- Test key supports hotel **search, booking, cancellation, static dump**.
- Production access is post-certification; **IP whitelisting required** during
  certification; **webhook URL** needed later.
- RateHawk API is **hotels only** for this account — no flights/transfers/activities.
  Those stay manual/enquiry-only until another provider is supplied.

## What works with the current RateHawk test key

- The test `KEY_ID`/`API_KEY` authenticate successfully.
- Overview reports **25 permitted endpoints** for this key (search, hotelpage,
  prebook, order/booking, etc. are visible in the permission list).
- Live region autocomplete and live region availability search both return real
  data through the Fly Time backend route.

## Blocked / pending (precise reasons)

- **HP-2 package hotel option wiring** — DONE (see above).
- **HP-3 prebook / recheck** — **DONE** (2026-06-10). Implemented:
  - `searchHotelPage()` adapter (`POST /api/b2b/v3/search/hp/`): sends numeric hotel ids as `hid`, uses stored `match_hash`, parses `data.hotels[].rates`, and returns the selected hotelpage `book_hash`.
  - `prebookHotelRate()` adapter (`POST /api/b2b/v3/hotel/prebook/`): non-idempotent, 15s timeout, sends `{ hash: bookHash }`, parses `data.hotels[].rates[0].payment_options`, and stores the returned provider booking token server-only as `metadata.prebook_hash`.
  - `prebookLiveHotelOption()` in DAL: validates option -> hp recheck -> hotelpage `book_hash` -> prebook -> stores result in `provider_quote_snapshots`. Manual options skip ETG and return `confirmed` immediately.
  - Public route `POST /api/public/trips/[destination]/[trip]/prebook`.
  - Frontend: "Confirming your room..." spinner; price-change reconfirmation panel; unavailable error. Manual options bypass prebook entirely.
  - HP-2 fix: `safe_payload` now stores checkin/checkout/residency/guests/currency for the hp recheck. `buildSelectionPayload` `isLiveHotel` bug fixed (was checking `option.isLive` via `mapOption` path which never sets it; now checks `quoteSnapshotId !== null`).
  - Live local verification after the correction: `/prebook` returned 200 and `/selection` returned 201; selected hotel appeared in the itinerary UI.
  - Smoke: `api-test/run-ratehawk-hp3-smoke.ps1` -> `ratehawk-hp3-latest.{md,json}`.
  - See `dev/ratehawk-hp3-implementation-note.md`.
- **Live persistence on a public GET** — `getLiveHotelOptions` writes snapshot +
  option rows during the public options call (bounded by request_hash reuse +
  5-min adapter cache + 30-min row TTL). A scheduled cleanup job for expired
  `trip_hotel_options`/`provider_quote_snapshots` rows is still pending.
- **Hotel names/images** — currently fetched live per hotel via `hotel/info`
  (bounded to ~12). HP-5 static-content dump + cache removes this per-request cost
  and enables broader, content-quality-gated listings.
- **HP-2 smoke booking residue** — leaves one clearly-named `API Smoke HP2 Tester`
  enquiry (not auto-cancelled by the focused script); safe/pending. Fold into the
  main run-smoke booking cleanup later if desired.
- **HP-4A checkout/review** — **DONE** (2026-06-10; hardened 2026-06-12). `getCheckoutSummary()` validates session + prebook snapshots + selections; returns safe `CheckoutSummaryDTO`. `/trips/[d]/[t]/checkout` page (server component) shows expired-state or full review + `CheckoutForm`. `POST /api/bookings` linked to selection session. "Continue to checkout" CTA in `TripItineraryPlanner`. No DB migration needed. **Checkout summary completeness fix (2026-06-12):** prebook snapshot `safe_payload` now also stores `cancellation_summary` (human-readable string), `board_basis`, and `nights`. `CheckoutLineItem` type extended with `boardBasis`/`nights`. Checkout page renders board basis + nights below hotel option label. Previous `cancellation_summary` read bug fixed (safe_payload only had `cancellation_free_before`/`policies_count`, not the pre-built string — now stores both). Smoke: `api-test/run-ratehawk-hp4a-smoke.ps1`.
- **SP-1 Stripe hosted Checkout gate** — **DONE** (2026-06-11; hardened 2026-06-12). Implemented:
  - `src/server/payments/stripe.ts`: server-only Stripe client singleton, `hasStripeEnv()`, `toStripeAmount()` (zero-decimal-currency aware), `fromStripeAmount()`.
  - Migration `20260611090000_stripe_payment.sql`: adds `stripe_checkout_session_id` (unique partial index), `stripe_payment_intent_id`, and `payment_status` (`pending|paid|failed|expired`) to `bookings`. **Applied remotely.**
  - Migration `20260611090001_stripe_payment_amounts.sql`: adds `paid_amount`, `paid_currency`, `paid_at` to `bookings`. **Applied remotely.**
  - `POST /api/public/trips/[d]/[t]/checkout/stripe-session`: validates session + prebook; creates booking with `payment_status='pending'`; creates Stripe Checkout session; orphan cleanup on failure; returns `{ url }` only — no internal IDs exposed.
  - `POST /api/webhook/stripe`: raw body + `Stripe-Signature` verification; `checkout.session.completed`/`expired`/`payment_intent.payment_failed`; paid is terminal (`neq`), expired/failed only from pending (`eq`); stores `paid_amount`/`paid_currency`/`paid_at`; returns 500 on DB failure so Stripe retries.
  - `/trips/[d]/[t]/checkout/success`: verifies by session ID **cross-checked against trip/destination slugs** (not URL alone). Full booking confirmation card: reference, guest, travel date, hotel add-on paid, "What Happens Next" steps.
  - `/trips/[d]/[t]/checkout/cancel`: link back to checkout.
  - `CheckoutForm`: `stripeSessionPath` prop; travelers label "Total party size" + clarifying note; mode-aware copy ("Send enquiry (pay later)" vs "Submit booking request"); "or pay your hotel add-on now" divider; no contradictory copy.
  - **Webhook setup**: Snapshot payload required (not Thin); API version `2026-05-27.dahlia`; 7 recommended events. `STRIPE_WEBHOOK_SECRET` must match the configured destination's signing secret in Vercel env.
  - Smoke: `api-test/run-stripe-sp1-smoke.ps1` — 10 steps.
  - `tsc` + `lint` + `build` clean.
- **HP-4B final RateHawk booking** — intentionally NOT implemented. Per the RateHawk commitments
  and the integration plan, no final provider booking until search + prebook are
  built and tested, and booking order/cancellation flows are certified. Booking
  against the test key could create real test orders, so it stays deferred.

  **HP-4B requirements (documented for planning):**
  - Trigger: `checkout.session.completed` webhook receives `payment_status = 'paid'`
  - Input path: `booking.option_session_id` → `trip_option_selections` → `metadata.prebook_snapshot_id` → `provider_quote_snapshots.metadata.prebook_hash` (server-only)
  - RateHawk call: `POST /api/b2b/v3/hotel/order/` with `{ hash: prebookHash, language: "en", rooms: [...] }`
  - Idempotency guard: check `booking.metadata.provider_order_id` already set before calling; never call twice for the same session
  - Store result: `provider_order_id` + `provider_order_status` in booking metadata or a new `provider_orders` table
  - **Schema gap**: need at least one new column (`provider_order_id text`, `provider_order_status text`) on `bookings` or a new `provider_orders` table — propose migration before coding
  - **Customer data blockers** (room guest payload required by RateHawk):
    - `first_name` / `last_name` per traveler — currently only lead guest full name is collected; RateHawk needs per-room passenger arrays
    - `date_of_birth` — may be required by certain hotel/destination combinations; not currently collected
  - **Timing**: `prebook_hash` is time-limited; HP-4B must be called promptly after `checkout.session.completed`, not lazily
  - **Cancellation flow**: must also implement `DELETE /api/b2b/v3/hotel/order/cancel/` paired with any future refund/cancel path
  - **Do not implement until**: customer payload form is extended to collect per-traveler guest names + optional DOB, and schema migration is reviewed and applied
- **Sandbox credentials** — `RATEHAWK_SANDBOX_KEY_ID` / `_API_KEY` are absent;
  only `test` credentials are present. Sandbox-only booking scenarios cannot be
  exercised until sandbox keys are supplied.
- **Distributed throttling** — the circuit breaker / concurrency limiter /
  search cache are in-process. On multi-instance or serverless (Vercel) each
  instance keeps its own counters. A shared store (Redis/Upstash) is the
  documented next step for globally-correct rate limiting at scale.
- **`external_providers` row sync** — optional HP-1 step deferred to avoid schema
  risk; no provider credentials are (or should be) stored in the DB.
- **Flight / transfer / activity providers** — CONFIRMED not available via RateHawk
  for this account (hotels only). Keep manual/enquiry-only until a separate flight
  and/or transfer/activity provider is supplied (see `dev/client-api-keys-needed.md`).
- **Resend email notifications** and **quote snapshot cleanup job** — not started.

## Security posture (verified this slice)

- No `NEXT_PUBLIC_RATEHAWK_*` exists.
- No API key, Basic Auth header, or raw provider payload appears in any route
  response, report, or log (smoke includes an explicit secret-leak scan).
- Provider calls live only in `src/server/providers/ratehawk/*` (`server-only`).
- The admin route is protected by `verifyAdminApiAccess`.
- User-facing errors are generic; raw causes stay in server logs.
