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
- optional admin dashboard/resource APIs when `ADMIN_PREVIEW_TOKEN` is present

