# Fly Time API Smoke Report

- Status: PASS
- Base URL: http://localhost:3000
- Generated: 2026-05-08 11:26:23 UTC
- Passed: 22
- Failed: 0
- Mutations: enabled

| Status | Test | Method | Endpoint | HTTP | Time | Detail |
| --- | --- | --- | --- | ---: | ---: | --- |
| PASS | Public destinations list | GET | `/api/public/trips` | 200 | 1072ms | destinations=1, total=1 |
| PASS | Destination packages filter | GET | `/api/public/trips/armenia?sort=cheapest&minDuration=1&maxDuration=10&flights=with` | 200 | 1407ms | packages=1, destination=armenia |
| PASS | Trip detail | GET | `/api/public/trips/armenia/yerevan-flexible-city-break` | 200 | 1959ms | package=yerevan-flexible-city-break, recommended=0 |
| PASS | Booking itinerary | GET | `/api/public/trips/armenia/yerevan-flexible-city-break/itinerary` | 200 | 1879ms | segments=7, trip=yerevan-flexible-city-break |
| PASS | Flight options | GET | `/api/public/trips/armenia/yerevan-flexible-city-break/options?segmentId=00000000-0000-4000-8000-000000000501&type=flight&sort=price` | 200 | 1552ms | options=4, segment=00000000-0000-4000-8000-000000000501 |
| PASS | Hotel options | GET | `/api/public/trips/armenia/yerevan-flexible-city-break/options?segmentId=00000000-0000-4000-8000-000000000503&type=hotel&sort=price` | 200 | 751ms | options=4, segment=00000000-0000-4000-8000-000000000503 |
| PASS | Transfer options | GET | `/api/public/trips/armenia/yerevan-flexible-city-break/options?segmentId=00000000-0000-4000-8000-000000000502&type=transfer&sort=price` | 200 | 759ms | options=2, segment=00000000-0000-4000-8000-000000000502 |
| PASS | Activity options | GET | `/api/public/trips/armenia/yerevan-flexible-city-break/options?segmentId=00000000-0000-4000-8000-000000000504&type=activity&sort=price` | 200 | 777ms | options=2, segment=00000000-0000-4000-8000-000000000504 |
| PASS | Select flight option | POST | `/api/public/trips/armenia/yerevan-flexible-city-break/selection` | 201 | 2314ms | selected=00000000-0000-4000-8000-000000000601, totalDelta=+ SAR0 |
| PASS | Create booking linked to option session | POST | `/api/bookings` | 201 | 855ms | booking accepted |
| PASS | Admin dashboard rejects anonymous access | GET | `/api/admin/dashboard` | 401 | 62ms | protected admin route rejects missing credentials |
| PASS | Admin dashboard preview | GET | `/api/admin/dashboard` | 200 | 239ms | metrics=4, bookings=4 |
| PASS | Admin trips resource preview | GET | `/api/admin/resources/trips` | 200 | 1025ms | rows=1 |
| PASS | Admin create CMS page | POST | `/api/admin/resources/pages` | 201 | 431ms | page=755afd38-8f12-4afc-81bc-ce78e17e18a3, action=created |
| PASS | Admin update CMS page | PATCH | `/api/admin/resources/pages/755afd38-8f12-4afc-81bc-ce78e17e18a3` | 200 | 1453ms | page=755afd38-8f12-4afc-81bc-ce78e17e18a3, action=updated |
| PASS | Admin archive CMS page | DELETE | `/api/admin/resources/pages/755afd38-8f12-4afc-81bc-ce78e17e18a3` | 200 | 585ms | page=755afd38-8f12-4afc-81bc-ce78e17e18a3, action=deleted |
| PASS | Admin create itinerary segment | POST | `/api/admin/trips/00000000-0000-4000-8000-000000000401/segments` | 201 | 1344ms | segment=6d9c1cc4-5277-4c94-a0b1-84bcc70b27b5, action=created |
| PASS | Admin create activity option | POST | `/api/admin/trips/00000000-0000-4000-8000-000000000401/segments/6d9c1cc4-5277-4c94-a0b1-84bcc70b27b5/options` | 201 | 1375ms | option=c3a6f78e-912e-499e-8d95-cfd8a764ab6a, action=created |
| PASS | Admin update activity option | PATCH | `/api/admin/trips/00000000-0000-4000-8000-000000000401/segments/6d9c1cc4-5277-4c94-a0b1-84bcc70b27b5/options/c3a6f78e-912e-499e-8d95-cfd8a764ab6a?type=activity` | 200 | 1660ms | option=c3a6f78e-912e-499e-8d95-cfd8a764ab6a, action=updated |
| PASS | Admin remove activity option | DELETE | `/api/admin/trips/00000000-0000-4000-8000-000000000401/segments/6d9c1cc4-5277-4c94-a0b1-84bcc70b27b5/options/c3a6f78e-912e-499e-8d95-cfd8a764ab6a?type=activity` | 200 | 603ms | option=c3a6f78e-912e-499e-8d95-cfd8a764ab6a, action=deleted |
| PASS | Admin archive itinerary segment | DELETE | `/api/admin/trips/00000000-0000-4000-8000-000000000401/segments/6d9c1cc4-5277-4c94-a0b1-84bcc70b27b5` | 200 | 1524ms | segment=6d9c1cc4-5277-4c94-a0b1-84bcc70b27b5, action=deleted |
| PASS | Admin audit log resource preview | GET | `/api/admin/resources/audit-log` | 200 | 37ms | rows=3 |
