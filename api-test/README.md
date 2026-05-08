# Fly Time API Tests

This folder contains repeatable smoke tests for the backend APIs.

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

## Output

The script writes:

- `api-test/reports/latest.md`
- `api-test/reports/latest.json`

The report includes endpoint status, basic response shape checks, and timings. It never prints secret values from `.env`.

## Coverage

Current smoke coverage:

- public trip destination list
- destination package filter endpoint
- trip detail endpoint
- booking itinerary endpoint
- segment option endpoint
- option selection mutation
- booking mutation linked to option session
- admin API anonymous rejection
- optional admin dashboard/resource APIs when an admin token is present
- optional admin CMS page create/update/archive smoke
- optional itinerary segment and activity option create/update/archive smoke
