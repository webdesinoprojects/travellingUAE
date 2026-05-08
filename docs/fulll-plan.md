**Backend Report (Source Of Truth v1)**

1. **Current frontend routes already present**
- `/`
- `/trips`
- `/trips/[destination]`
- `/trips/[destination]/[tripSlug]`
- Loading/error/not-found variants for destination and trip detail.

2. **Public pages still needed**
- `/services` and `/services/[slug]` for “What We Handle”.
- `/collections/flytime-picks` for the first homepage collection.
- `/collections/routes` for “Routes People Ask For” (separate from `/trips`).
- `/pages/[slug]` CMS pages for footer links: terms, privacy, refund, contact, etc.
- Language-aware versions for EN/AR content output.

3. **Admin pages needed (protected)**
- `/admin/login`
- `/admin` dashboard overview
- `/admin/destinations`
- `/admin/trips`
- `/admin/categories`
- `/admin/tags`
- `/admin/services`
- `/admin/collections` (Fly Time Picks / Routes People Ask For)
- `/admin/pages` (footer CMS pages)
- `/admin/navigation` (header/footer/social)
- `/admin/home` (hero, sections, testimonials)
- `/admin/bookings`
- `/admin/newsletter`
- `/admin/translations`
- `/admin/media`

4. **Core database model (Supabase)**
- `profiles` (id, role: admin/editor, status)
- `destinations`
- `trips`
- `trip_media`
- `trip_features`
- `trip_itinerary_items`
- `trip_terms`
- `categories`
- `tags`
- `trip_categories` (join)
- `trip_tags` (join)
- `services`
- `collections`
- `collection_items`
- `pages` (slug-based CMS)
- `site_sections` (hero, nav, footer blocks)
- `testimonials`
- `bookings`
- `newsletter_subscribers`
- `locales`
- `translations`
- `media_assets` (Cloudinary/ImageKit metadata only)

5. **Public APIs required**
- `GET /api/v1/site/home`
- `GET /api/v1/site/navigation`
- `GET /api/v1/site/footer`
- `GET /api/v1/collections/:slug`
- `GET /api/v1/services`
- `GET /api/v1/services/:slug`
- `GET /api/v1/pages/:slug`
- `GET /api/v1/destinations`
- `GET /api/v1/destinations/:slug`
- `GET /api/v1/trips` with filters (`destination`, `location`, `q`, `duration_min`, `duration_max`, `with_flights`, `hotel_star`, `categories`, `sort`, `page`)
- `GET /api/v1/trips/:slug`
- `POST /api/v1/bookings`
- `POST /api/v1/newsletter/subscribe`
- `GET /api/v1/i18n?locale=en|ar`

6. **Admin APIs required**
- CRUD for: destinations, trips, categories, tags, services, collections, pages, testimonials, nav/footer, translations.
- `GET /api/v1/admin/bookings`, `PATCH /api/v1/admin/bookings/:id` (status updates).
- `GET /api/v1/admin/newsletter/subscribers`.
- `POST /api/v1/admin/media/sign-upload` (Cloudinary/ImageKit signed uploads).
- `POST /api/v1/admin/media/delete`.

7. **Auth and protection model**
- Public website remains no-login.
- Admin uses Supabase Auth only.
- Middleware protects `/admin/*`.
- Roles from `profiles.role`.
- RLS: public `SELECT` on publishable content, admin/editor write permissions, bookings/newsletter read only for admin/editor.

8. **Operational/security requirements**
- Standard API envelope: `success`, `data`, `errorCode`, `message`.
- Never return raw DB/provider errors to frontend.
- Server-side validation on all write endpoints.
- Rate-limit `bookings` and `newsletter`.
- Audit columns on mutable tables (`created_by`, `updated_by`, timestamps).

9. **Build order**
- Phase 1: schema + RLS + public read APIs.
- Phase 2: bookings/newsletter write APIs.
- Phase 3: admin auth + protected dashboard + CRUD.
- Phase 4: EN/AR translation pipeline.
- Phase 5: media pipeline + polishing + analytics.

If you want, I can now convert this into a committed `docs/backend-blueprint.md` and immediately start Phase 1 with SQL migrations + API scaffolding.