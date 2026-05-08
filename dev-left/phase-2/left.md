# Phase 2 Left For Later

Phase 2 has started. This file tracks the remaining Phase 2 work so backend and frontend wiring do not drift.

## Trip Detail Booking UI

Status: initial wiring done, final UX pending.

- `TripItineraryPlanner` now renders backend itinerary segments on the trip detail page.
- Change-option drawer fetches segment options from the backend.
- Selection posts to the backend and updates the current UI state.
- Still pending:
  - richer flight filters matching the reference screen: stops, baggage, airline, layover airport, departure windows, arrival windows.
  - hotel option detail modal and room options if the provider returns multiple rooms.
  - activity option detail modal.
  - transfer option modal layout closer to final client screen.
  - final booking/enquiry form fields once client confirms exact required fields.

Blocked by provider/client input:

- live flight/hotel/transport provider response shapes, auth rules, rate limits, and quote expiry rules.
- final passenger/booking/enquiry fields requested by the client.

## Trip Listing Filters

Status: partially wired.

- Desktop now has a persistent left filter sidebar beside results.
- Tablet/mobile now use a left slide-in sidebar/menu instead of a bottom drawer.
- Filter values now initialize from and write back to query params.
- Public destination API already supports the same filter query params and is covered by smoke tests.
- Page and API now share the same server-side filter parser/application helper.
- Still pending:
  - push filtering/pagination deeper into Supabase queries instead of filtering the destination DTO after it is loaded.
  - add pagination/infinite loading once there are enough backend packages.
  - add a browser smoke checklist for desktop/tablet/mobile filter behavior.

Not blocked by provider API keys:

- pagination.
- DB-level list query optimization.
- browser/UI smoke instructions.

Blocked by real inventory/admin work:

- final removal of fallback/static package data, because admin CRUD and full seed content are not complete yet.

Current filters:

- destination/city
- keyword
- duration min/max
- flights with/without
- hotel stars
- categories/tags
- sort

## Static Trip Data Reduction

Status: pending.

- Keep fallback data until admin CRUD and full seed content are ready.
- Reduce direct `src/data/trips.ts` dependency after Supabase has enough real/demo rows.
- Re-test all public trip routes after fallback cleanup.

## API Tests

Status: expanded smoke tests pass; Phase 2 UI-flow tests pending.

- Existing smoke script tests itinerary, options, selection, and booking API.
- Smoke script now tests flight, hotel, transfer, and activity option endpoints.
- Latest report is in `api-test/reports/latest.md`.
- Add optional browser/UI smoke instructions once the planner UX is stable.
