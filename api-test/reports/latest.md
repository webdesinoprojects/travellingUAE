# Fly Time API Smoke Report

- Status: PASS
- Base URL: http://localhost:3000
- Generated: 2026-05-08 10:24:30 UTC
- Passed: 12
- Failed: 0
- Mutations: enabled

| Status | Test | Method | Endpoint | HTTP | Time | Detail |
| --- | --- | --- | --- | ---: | ---: | --- |
| PASS | Public destinations list | GET | `/api/public/trips` | 200 | 640ms | destinations=1, total=1 |
| PASS | Destination packages filter | GET | `/api/public/trips/armenia?sort=cheapest&minDuration=1&maxDuration=10&flights=with` | 200 | 1321ms | packages=1, destination=armenia |
| PASS | Trip detail | GET | `/api/public/trips/armenia/yerevan-flexible-city-break` | 200 | 2059ms | package=yerevan-flexible-city-break, recommended=0 |
| PASS | Booking itinerary | GET | `/api/public/trips/armenia/yerevan-flexible-city-break/itinerary` | 200 | 1739ms | segments=7, trip=yerevan-flexible-city-break |
| PASS | Flight options | GET | `/api/public/trips/armenia/yerevan-flexible-city-break/options?segmentId=00000000-0000-4000-8000-000000000501&type=flight&sort=price` | 200 | 1703ms | options=4, segment=00000000-0000-4000-8000-000000000501 |
| PASS | Hotel options | GET | `/api/public/trips/armenia/yerevan-flexible-city-break/options?segmentId=00000000-0000-4000-8000-000000000503&type=hotel&sort=price` | 200 | 862ms | options=4, segment=00000000-0000-4000-8000-000000000503 |
| PASS | Transfer options | GET | `/api/public/trips/armenia/yerevan-flexible-city-break/options?segmentId=00000000-0000-4000-8000-000000000502&type=transfer&sort=price` | 200 | 804ms | options=2, segment=00000000-0000-4000-8000-000000000502 |
| PASS | Activity options | GET | `/api/public/trips/armenia/yerevan-flexible-city-break/options?segmentId=00000000-0000-4000-8000-000000000504&type=activity&sort=price` | 200 | 806ms | options=2, segment=00000000-0000-4000-8000-000000000504 |
| PASS | Select flight option | POST | `/api/public/trips/armenia/yerevan-flexible-city-break/selection` | 201 | 2557ms | selected=00000000-0000-4000-8000-000000000601, totalDelta=+ SAR0 |
| PASS | Create booking linked to option session | POST | `/api/bookings` | 201 | 861ms | booking accepted |
| PASS | Admin dashboard preview | GET | `/api/admin/dashboard` | 0 | 0ms | skipped because ADMIN_PREVIEW_TOKEN is not set |
| PASS | Admin trips resource preview | GET | `/api/admin/resources/trips` | 0 | 0ms | skipped because ADMIN_PREVIEW_TOKEN is not set |
