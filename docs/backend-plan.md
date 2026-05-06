# Fly Time Backend Plan

This document is the backend checklist for moving the current static frontend to a Supabase-backed app.

## Current Phase

Phase 1 is the database foundation:

- Supabase CLI and `@supabase/supabase-js` are installed.
- Initial migration is in `supabase/migrations/20260506101603_init_core_schema.sql`.
- Core CMS tables are modeled for destinations, trips, tags, categories, media, services, collections, site sections, navigation, footer links, pages, testimonials, translations, bookings, contact submissions, and newsletter subscribers.
- Row Level Security is enabled on every public table.
- Public reads are limited to published CMS content.
- Customer bookings and newsletter emails are admin/server-only in Supabase. Public forms should write through Next.js Route Handlers using the service role key on the server.

## Required API Surface

Public read APIs and server data loaders:

- Home page sections: hero, quick links, Fly Time Picks, route board, services, testimonials, footer, navigation.
- Trip destination list: all published destinations with counts and poster data.
- Trip package listing: destination, filters, sort, search, categories, stars, flights, durations.
- Trip detail: gallery, summary, inclusions, exclusions, highlights, terms, itinerary map, related packages.
- Static CMS pages: terms, privacy, refund policy, about, contact, Hajj and Umrah, visa desk, travel desk, wellness.
- Locale dictionary: English and Arabic translations by namespace.

Public mutation APIs:

- `POST /api/bookings`: validates booking details, inserts booking server-side, sends admin notification, returns a generic success/error message.
- `POST /api/newsletter`: validates email, upserts subscriber server-side, returns a generic success/error message.
- `POST /api/contact`: validates enquiry form, stores it in `contact_submissions` server-side, sends notification.

Admin routes and APIs:

- Auth-protected `/admin` dashboard.
- CRUD for destinations, trips, trip gallery, itinerary, pricing, duration, inclusions, exclusions, highlights, terms.
- CRUD for categories and tags.
- Media manager for Cloudinary or ImageKit assets.
- Home page CMS: hero, search defaults, bento packages, services, testimonials, route board, footer and navigation.
- Booking inbox with status changes and private admin notes.
- Newsletter subscriber list.
- Translation manager for English and Arabic copy.
- Audit log viewer for admin changes.

## Security Rules

- Do not use `SUPABASE_SERVICE_ROLE_KEY`, Cloudinary secret, ImageKit private key, or Resend key in Client Components.
- Customer forms must call our Next.js API routes, not Supabase directly from the browser.
- API route responses should use generic user-facing errors. Actual errors belong in server logs only.
- Booking/admin private fields should never be rendered into public pages or passed to Client Components.
- Admin access is based on Supabase Auth plus `profiles.role` and `profiles.is_active`.
- Add rate limiting before public mutation routes go live.

## Scale Notes

- The schema uses indexes on slugs, statuses, sort order, filters, bookings, and lookup tables.
- `published_destination_cards` and `published_trip_cards` provide compact read shapes for high-traffic listing pages.
- Listing pages should fetch paginated records and aggregate counts server-side.
- Public reads should use selective queries or views, not `select *`.
- Mutations should be small Route Handlers with validation, rate limiting, and server-only Supabase access.
- Media should use Cloudinary or ImageKit URLs with transformed sizes for cards, hero images, and galleries.

## Environment Keys Needed

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_PASSWORD`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `IMAGEKIT_PUBLIC_KEY`
- `IMAGEKIT_PRIVATE_KEY`
- `IMAGEKIT_URL_ENDPOINT`
- `RESEND_API_KEY`
- `ADMIN_NOTIFICATION_EMAIL`

Only the `NEXT_PUBLIC_*` values are allowed in browser code.
