# Fly Time API Tests

This folder contains repeatable smoke tests for the backend APIs.

Before changing this folder, read `dev/testing-contract.md`.

## Run

Start the app first:

```powershell
npm run dev
```

Then run:

```powershell
.\api-test\run-smoke.ps1 -BaseUrl http://localhost:3000
```

If Next uses another port, pass that URL:

```powershell
.\api-test\run-smoke.ps1 -BaseUrl http://localhost:3001
```

For local admin CRUD smoke tests without saving a preview token in `.env`, pass a temporary token to the app process and to the script in the same terminal:

```powershell
$env:ADMIN_PREVIEW_TOKEN = "temporary-local-token"
.\api-test\run-smoke.ps1 -BaseUrl http://localhost:3000 -AdminToken $env:ADMIN_PREVIEW_TOKEN
```

To verify the real Supabase admin login and 30-day remember-session lifecycle,
configure `ADMIN_DEV_EMAIL` and `ADMIN_DEV_PASSWORD` in ignored `.env`, then
create or reset that local development user:

```powershell
npm run admin:bootstrap
.\api-test\run-smoke.ps1 -BaseUrl http://localhost:3000 -SkipDashboardAggregate
```

The smoke runner sends those credentials only to the same-origin login route.
It records cookie-lifecycle assertions, never credential or cookie values.

While the prepared dashboard aggregate migration is deliberately not deployed, an incremental CMS lifecycle run may skip only that assertion and write a separately named report:

```powershell
.\api-test\run-smoke.ps1 -BaseUrl http://localhost:3001 -AdminToken $env:ADMIN_PREVIEW_TOKEN -SkipDashboardAggregate -ReportPath api-test/reports/navigation-cms-latest.md
```

This does not count as verification of the protected dashboard aggregate. A release verification run must omit `-SkipDashboardAggregate` after its migration is applied.

Use mutation mode only against a local or sandbox database. To run read/auth checks without creating, updating, deleting, selecting, or booking records:

```powershell
.\api-test\run-smoke.ps1 -BaseUrl http://localhost:3000 -SkipMutations
```

## Output

The script writes:

- `api-test/reports/latest.md`
- `api-test/reports/latest.json`

When a named incremental path is passed, its corresponding `.md` and `.json` files are written instead, for example `api-test/reports/home-cms-latest.md`.

The report includes endpoint status, basic response shape checks, and timings. It never prints secret values from `.env`.

## Coverage

Current smoke coverage:

- public trip destination list
- public CMS/legal page endpoint
- public navigation/footer endpoint
- public translations endpoint
- public Arabic translations endpoint
- public locale preference redirect/cookie endpoint
- public home content endpoint
- public home hero media DTO shape
- destination package filter endpoint
- trip detail endpoint
- booking itinerary endpoint
- segment option endpoint
- option selection mutation
- booking mutation linked to option session, protected dashboard/inbox readback, and audited soft-cancellation cleanup
- admin API anonymous rejection
- optional admin dashboard/resource APIs when an admin token is present, including live aggregate source validation and recent-booking visibility
- optional admin CMS page create/update/archive smoke
- optional authenticated translation editor read, validation rejection, publish/update/archive lifecycle with public locale DTO reflection
- optional authenticated Home CMS hero publish/public-read/restore smoke
- optional authenticated Home CMS collection heading, card, service, and testimonial create/update/archive lifecycle with public DTO reflection
- optional Home CMS test dependency bootstrap through protected APIs when a trusted media asset or collection is required, followed by cleanup/archive
- optional authenticated navigation and footer column/link create/update/archive lifecycle with public DTO reflection
- optional authenticated CMS page editor read, publish/update/archive lifecycle that rejects incomplete publication and verifies title edits preserve the published public slug
- optional authenticated trip highlight/inclusion/exclusion/term/gallery/itinerary-day create/update/protected-editor-read/public-read/delete smoke, including nullable itinerary map-field clearing
- optional itinerary segment and activity option create/update/archive smoke
- optional authenticated footer settings read/publish/restore lifecycle smoke (`GET/PATCH /api/admin/home/footer`); verified `127/127` in `api-test/reports/footer-settings-auth-latest.md`
- optional real admin sign-in, HTTP-only cookie assertions, protected-request renewal after forced access expiry, 30-day remembered refresh, and logout lifecycle when local bootstrap credentials are configured; verified `36/36` in `api-test/reports/admin-session-latest.md` in read/auth mode
- optional safe audit-log metadata read asserting an executed admin mutation is visible
- RateHawk/ETG hotel provider foundation (HP-1): anonymous rejection of the protected provider route in this suite, plus a dedicated focused runner `api-test/run-ratehawk-smoke.ps1` (env presence without printing values, authenticated overview readiness, secret-leak scan, live multicomplete suggest, live region availability search, and validation rejection) writing `api-test/reports/ratehawk-hotel-foundation-latest.{md,json}`; verified `7/7` against the live test key

## RateHawk Provider Foundation Smoke

Run the focused provider foundation coverage (calls Fly Time routes only, never
RateHawk from the browser/script, never prints secrets):

```powershell
$env:ADMIN_PREVIEW_TOKEN = "temporary-local-token"
.\api-test\run-ratehawk-smoke.ps1 -BaseUrl http://localhost:3000 -AdminToken $env:ADMIN_PREVIEW_TOKEN
```

Live overview/suggest/search steps run only when `RATEHAWK_<ENV>_KEY_ID` and
`RATEHAWK_<ENV>_API_KEY` are present in `.env`; otherwise they are reported as
skipped/blocked. The report never prints env values or provider payloads.

## RateHawk HP-2 Hotel Option Wiring Smoke

Verifies live RateHawk hotel rates wired into the public package option flow.
Discovers a published changeable hotel segment, checks manual fallback, then
(with admin token + credentials) configures the segment for hybrid live+manual
via the admin API, asserts live options return safely (no `search_hash`/
`match_hash`/secrets), selects a live option, books with the option session, and
verifies unknown/expired options are rejected — then reverts the segment.

```powershell
$env:ADMIN_PREVIEW_TOKEN = "temporary-local-token"
.\api-test\run-ratehawk-hp2-smoke.ps1 -BaseUrl http://localhost:3000 -AdminToken $env:ADMIN_PREVIEW_TOKEN
```

Writes `api-test/reports/ratehawk-hp2-latest.{md,json}`. Verified `10/10` against
the live test key. If no published hotel segment exists, it reports a clear skip.
It leaves one clearly-named `API Smoke HP2 Tester` enquiry.

## Testing Contract

Direct SQL seed data is only a baseline fixture strategy. It is useful for predictable demo content, lookup rows, and migration verification, but it does not prove that route validation, auth checks, audit logs, DTO shaping, or frontend-facing behavior works.

For every backend module that supports mutations, smoke tests should exercise the route lifecycle through the public/admin APIs:

- create a safe `API Smoke ...` record through the API;
- read it back through the API that the frontend or admin dashboard uses;
- update it through the API when supported;
- delete, archive, cancel, or clean it up through the API when supported;
- write the result to `api-test/reports/latest.md` and `api-test/reports/latest.json`;
- never print secrets, provider payloads, service role keys, card data, real customer data, or raw backend errors.

If a route cannot be tested because auth, a deliberately undeployed migration, provider credentials, or external sandbox access is missing, the smoke report should include a clear skipped/blocked reason.

The protected dashboard assertion requires `supabase/migrations/20260524090000_admin_dashboard_snapshot.sql` to be applied. Until that migration is deployed, use `-SkipDashboardAggregate` only for clearly named incremental module reports and do not report the dashboard aggregate extension as API-verified.

`-SkipMutations` must suppress every write lifecycle in this script. Never run mutation coverage against production customer data.

The booking lifecycle intentionally soft-cancels created `API Smoke Tester` enquiries rather than deleting them. It also cancels pending test enquiries from interrupted earlier runs, preserving audit history while ensuring no demo enquiry remains actionable.

CMS and navigation lifecycle runs clean up clearly named stale `API Smoke ...` rows from interrupted runs through protected archive APIs before creating fresh records. Reports retain safe status and assertion summaries only; failed route response bodies are not copied into report artifacts.
