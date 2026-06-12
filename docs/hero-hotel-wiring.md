What exists already (reusable)

  All the hard RateHawk work is done. We have:
  - suggestRegionsAndHotels(query) — autocomplete destinations by name → returns region_id
  - searchRegionRatesDetailed(regionId, checkin, checkout, guests...) — full hotel search with prices
  - getHotelStaticInfo(hotelId) — name, stars, images, address, coordinates
  - searchHotelPage(hid, checkin, checkout, guests) — all rates for one hotel (fresh recheck)
  - prebookHotelRate(bookHash) — locks a rate, returns prebook_hash
  - 5-min in-process cache on search results, circuit breaker, concurrency limiter — all production-ready

  None of this is exposed publicly yet. It only runs inside the trip package flow. The standalone /hotels feature is a new public surface on top of the same engine.

  ---
  The full flow you described

  Homepage hero
    └─ User types "Dubai" → autocomplete from RateHawk multicomplete
    └─ Picks dates + rooms + guests → clicks Search Now
          ↓
  /hotels?region_id=868&checkin=2026-07-15&checkout=2026-07-18&adults=2
    └─ Server fetches hotels for that region
    └─ Enriches each with name, stars, image, price from
    └─ Shows filterable hotel cards (same UI language as trip options)
          ↓
  /hotels/[hotelId]?checkin=...&checkout=...&adults=...
    └─ Hotel detail: photos, amenities, map
    └─ All available rates + room types
    └─ User picks a rate → prebook (locks price)
          ↓
  /hotels/[hotelId]/checkout
    └─ Booking form (name, email, phone)
    └─ Stripe hosted checkout — full room rate (not a delta)
    └─ Success page with booking confirmation

  ---
  New routes needed

  API (server-only, never expose hashes)

  ┌───────────────────────────────────────────────────────────┬──────────────────────────────────────────────────┐
  │                           Route                           │                     Purpose                      │
  ├───────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
  │ GET /api/public/hotels/suggest?q=dubai                    │ Autocomplete — regions + hotels by name          │
  ├───────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
  │ POST /api/public/hotels/search                            │ Search hotels in a region, return safe card data │
  ├───────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
  │ GET /api/public/hotels/[hotelId]                          │ Hotel static info + fresh rates                  │
  ├───────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
  │ POST /api/public/hotels/[hotelId]/prebook                 │ Lock a rate, return prebookId (no hash)          │
  ├───────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
  │ POST /api/public/hotels/[hotelId]/checkout/stripe-session │ Create Stripe session for full room rate         │
  └───────────────────────────────────────────────────────────┴──────────────────────────────────────────────────┘

  Pages

  ┌────────────────────────────────────┬───────────────────────────────────────────┐
  │                Page                │                  Purpose                  │
  ├────────────────────────────────────┼───────────────────────────────────────────┤
  │ /hotels                            │ Search results — filterable hotel cards   │
  ├────────────────────────────────────┼───────────────────────────────────────────┤
  │ /hotels/[hotelId]                  │ Hotel detail — photos, rates, rate picker │
  ├────────────────────────────────────┼───────────────────────────────────────────┤
  │ /hotels/[hotelId]/checkout         │ Booking form + pay button                 │
  ├────────────────────────────────────┼───────────────────────────────────────────┤
  │ /hotels/[hotelId]/checkout/success │ Confirmation (reuse same pattern as trip) │
  ├────────────────────────────────────┼───────────────────────────────────────────┤
  │ /hotels/[hotelId]/checkout/cancel  │ Cancel page                               │
  └────────────────────────────────────┴───────────────────────────────────────────┘

  ---
  DB changes needed

  The existing provider_quote_snapshots and trip_hotel_options tables are tied to trip_itinerary_segments. Standalone hotel needs its own anchor:

  -- New: standalone hotel search session (replaces trip segment as anchor)
  create table public.hotel_search_sessions (
    id uuid primary key default gen_random_uuid(),
    region_id integer not null,
    checkin date not null,
    checkout date not null,
    guests jsonb not null,
    residency text not null,
    currency text not null,
    expires_at timestamptz not null,
    created_at timestamptz default now()
  );

  -- New: standalone hotel bookings (separate from trip bookings)
  create table public.hotel_bookings (
    id uuid primary key default gen_random_uuid(),
    hotel_id text not null,
    hotel_name text not null,
    room_name text not null,
    checkin date not null,
    checkout date not null,
    guests jsonb not null,
    customer_name text not null,
    customer_email text not null,
    customer_phone text not null,
    payment_status text check (payment_status in ('pending','paid','failed','expired')),
    stripe_checkout_session_id text,
    stripe_payment_intent_id text,
    paid_amount numeric,
    paid_currency text,
    paid_at timestamptz,
    prebook_snapshot_id uuid references public.provider_quote_snapshots(id),
    metadata jsonb default '{}',
    created_at timestamptz default now()
  );

  ---
  Security rules (same as trip flow, enforced from day 1)

  - search_hash, match_hash, book_hash, prebook_hash — stored in provider_quote_snapshots.metadata, never sent to browser
  - Browser only gets: hotel name, stars, image URL, price label, room name
  - No NEXT_PUBLIC_RATEHAWK_* vars
  - RateHawk never called from frontend — server proxy only
  - Stripe full-room-rate (not delta) — labeled clearly as charge_type: "hotel_room"

  ---
  Scope estimate

  ┌───────┬─────────────────────────────────────────────────┬──────────┐
  │ Phase │                      Work                       │ Estimate │
  ├───────┼─────────────────────────────────────────────────┼──────────┤
  │ HW-1  │ Suggest API + search API + /hotels results page │ 3–4 days │
  ├───────┼─────────────────────────────────────────────────┼──────────┤
  │ HW-2  │ Hotel detail page + rates + prebook             │ 2–3 days │
  ├───────┼─────────────────────────────────────────────────┼──────────┤
  │ HW-3  │ Booking form + Stripe + success/cancel          │ 2 days   │
  ├───────┼─────────────────────────────────────────────────┼──────────┤
  │ HW-DB │ Migrations for new tables                       │ half day │
  └───────┴─────────────────────────────────────────────────┴──────────┘

  Total: ~8–10 days of focused work.

  The RateHawk layer is already production-grade — no rework there. All the time goes to the new public API routes, pages, and DB schema.

  ---
  Want me to start with HW-DB (migrations) + HW-1 (suggest API + search results page) as the first chunk?
