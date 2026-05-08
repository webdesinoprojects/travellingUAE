-- Development/demo seed for backend API testing.
-- Run only after both migrations have been applied.

insert into public.locales (code, name, direction, is_default, is_active)
values
  ('en', 'English', 'ltr', true, true),
  ('ar', 'Arabic', 'rtl', false, true)
on conflict (code) do update
set name = excluded.name,
    direction = excluded.direction,
    is_active = excluded.is_active;

insert into public.media_assets (id, provider, url, alt_text, folder)
values
  ('00000000-0000-4000-8000-000000000101', 'external', 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=1200&q=82', 'Aircraft flying above clouds', 'demo/flights'),
  ('00000000-0000-4000-8000-000000000102', 'external', 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=82', 'Hotel exterior with warm lights', 'demo/hotels'),
  ('00000000-0000-4000-8000-000000000103', 'external', 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=82', 'Mountain route and lake view', 'demo/destinations'),
  ('00000000-0000-4000-8000-000000000104', 'external', 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=82', 'Historic stone landmark', 'demo/activities'),
  ('00000000-0000-4000-8000-000000000105', 'external', 'https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=1200&q=82', 'Private black sedan transfer vehicle', 'demo/transfers')
on conflict (id) do update
set url = excluded.url,
    alt_text = excluded.alt_text,
    folder = excluded.folder;

insert into public.external_providers (id, slug, name, service_type, base_url, is_active)
values
  ('00000000-0000-4000-8000-000000000201', 'demo-flight-provider', 'Demo Flight Provider', 'flight', 'https://provider.example/flights', true),
  ('00000000-0000-4000-8000-000000000202', 'demo-hotel-provider', 'Demo Hotel Provider', 'hotel', 'https://provider.example/hotels', true),
  ('00000000-0000-4000-8000-000000000203', 'demo-transfer-provider', 'Demo Transfer Provider', 'transfer', 'https://provider.example/transfers', true),
  ('00000000-0000-4000-8000-000000000204', 'demo-activity-provider', 'Demo Activity Provider', 'activity', 'https://provider.example/activities', true),
  ('00000000-0000-4000-8000-000000000205', 'demo-media-provider', 'Demo Media Provider', 'media', 'https://provider.example/media', true)
on conflict (slug) do update
set name = excluded.name,
    service_type = excluded.service_type,
    base_url = excluded.base_url,
    is_active = excluded.is_active;

insert into public.destinations (
  id,
  slug,
  name,
  country,
  city,
  result_title,
  currency,
  package_date,
  poster_media_id,
  poster_title,
  poster_price,
  poster_season,
  latitude,
  longitude,
  map_zoom,
  status,
  sort_order
)
values (
  '00000000-0000-4000-8000-000000000301',
  'armenia',
  'Armenia',
  'Armenia',
  'Yerevan',
  'Trips in Armenia',
  'SAR',
  '2026-05-27',
  '00000000-0000-4000-8000-000000000103',
  'Yerevan',
  2327,
  'Summer',
  40.1872,
  44.5152,
  11,
  'published',
  10
)
on conflict (slug) do update
set name = excluded.name,
    country = excluded.country,
    city = excluded.city,
    result_title = excluded.result_title,
    currency = excluded.currency,
    package_date = excluded.package_date,
    poster_media_id = excluded.poster_media_id,
    poster_title = excluded.poster_title,
    poster_price = excluded.poster_price,
    poster_season = excluded.poster_season,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    map_zoom = excluded.map_zoom,
    status = excluded.status,
    sort_order = excluded.sort_order;

insert into public.trips (
  id,
  destination_id,
  slug,
  title,
  city,
  summary,
  overview,
  badge,
  duration_days,
  duration_label,
  nights,
  has_flights,
  hotel_star,
  price_amount,
  currency,
  start_date,
  travelers_label,
  hero_media_id,
  card_media_id,
  latitude,
  longitude,
  map_zoom,
  status,
  sort_order
)
values (
  '00000000-0000-4000-8000-000000000401',
  '00000000-0000-4000-8000-000000000301',
  'yerevan-flexible-city-break',
  'Yerevan Flexible City Break',
  'Yerevan',
  'Flights, hotel, transfers, and activities can be changed before enquiry.',
  'A backend-driven Yerevan package built to test selectable flights, transfers, hotels, and date-wise activities.',
  'Configurable',
  3,
  '3 Days',
  2,
  true,
  4,
  2327,
  'SAR',
  '2026-05-27',
  '2 adults',
  '00000000-0000-4000-8000-000000000103',
  '00000000-0000-4000-8000-000000000103',
  40.1872,
  44.5152,
  12,
  'published',
  10
)
on conflict (destination_id, slug) do update
set title = excluded.title,
    city = excluded.city,
    summary = excluded.summary,
    overview = excluded.overview,
    badge = excluded.badge,
    duration_days = excluded.duration_days,
    duration_label = excluded.duration_label,
    nights = excluded.nights,
    has_flights = excluded.has_flights,
    hotel_star = excluded.hotel_star,
    price_amount = excluded.price_amount,
    currency = excluded.currency,
    start_date = excluded.start_date,
    travelers_label = excluded.travelers_label,
    hero_media_id = excluded.hero_media_id,
    card_media_id = excluded.card_media_id,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    map_zoom = excluded.map_zoom,
    status = excluded.status,
    sort_order = excluded.sort_order;

insert into public.trip_itinerary_segments (
  id,
  trip_id,
  segment_type,
  direction,
  title,
  subtitle,
  description,
  day_offset,
  start_time,
  origin_label,
  origin_iata,
  destination_label,
  destination_iata,
  location_label,
  latitude,
  longitude,
  is_required,
  is_changeable,
  status,
  sort_order
)
values
  ('00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000401', 'flight', 'outbound', 'Flight from Dubai to Yerevan', 'Outbound flight', 'Choose the outbound flight that matches the itinerary.', 0, '08:05', 'Dubai', 'DXB', 'Yerevan', 'EVN', null, null, null, true, true, 'published', 10),
  ('00000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000401', 'transfer', 'local', 'Transfer from Airport to Hotel', 'Arrival transfer', 'Private transfer from airport to hotel.', 0, '13:45', 'Yerevan Airport', 'EVN', 'Yerevan Hotel', null, 'Yerevan', 40.1473, 44.3959, true, true, 'published', 20),
  ('00000000-0000-4000-8000-000000000503', '00000000-0000-4000-8000-000000000401', 'hotel', 'local', 'Hotels in Yerevan', 'Hotel stay', 'Choose a hotel and room option.', 0, null, null, null, null, null, 'Yerevan', 40.1872, 44.5152, true, true, 'published', 30),
  ('00000000-0000-4000-8000-000000000504', '00000000-0000-4000-8000-000000000401', 'activity', 'local', 'Activities in Yerevan', 'Day activities', 'Choose optional sightseeing for day one.', 0, '15:00', null, null, null, null, 'Yerevan', 40.1872, 44.5152, false, true, 'published', 40),
  ('00000000-0000-4000-8000-000000000505', '00000000-0000-4000-8000-000000000401', 'activity', 'local', 'Activities in Yerevan', 'Day activities', 'Choose optional sightseeing for day two.', 1, '10:00', null, null, null, null, 'Yerevan', 40.1872, 44.5152, false, true, 'published', 50),
  ('00000000-0000-4000-8000-000000000506', '00000000-0000-4000-8000-000000000401', 'transfer', 'return', 'Transfer from Hotel to Airport', 'Return transfer', 'Private transfer from hotel to airport.', 2, '09:45', 'Yerevan Hotel', null, 'Yerevan Airport', 'EVN', 'Yerevan', 40.1473, 44.3959, true, true, 'published', 60),
  ('00000000-0000-4000-8000-000000000507', '00000000-0000-4000-8000-000000000401', 'flight', 'return', 'Flight from Yerevan to Dubai', 'Return flight', 'Choose the return flight that matches the itinerary.', 2, '12:25', 'Yerevan', 'EVN', 'Dubai', 'DXB', null, null, null, true, true, 'published', 70)
on conflict (id) do update
set title = excluded.title,
    subtitle = excluded.subtitle,
    description = excluded.description,
    day_offset = excluded.day_offset,
    start_time = excluded.start_time,
    origin_label = excluded.origin_label,
    origin_iata = excluded.origin_iata,
    destination_label = excluded.destination_label,
    destination_iata = excluded.destination_iata,
    location_label = excluded.location_label,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    is_required = excluded.is_required,
    is_changeable = excluded.is_changeable,
    status = excluded.status,
    sort_order = excluded.sort_order;

insert into public.trip_flight_options (
  id,
  trip_id,
  segment_id,
  provider_id,
  airline_name,
  airline_code,
  airline_logo_url,
  flight_number,
  origin_iata,
  origin_label,
  destination_iata,
  destination_label,
  departure_at,
  arrival_at,
  duration_minutes,
  stops_count,
  layover_airports,
  cabin,
  fare_class,
  baggage_label,
  price_delta_amount,
  currency,
  is_default,
  status
)
values
  ('00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000201', 'flydubai', 'FZ', null, 'FZ717', 'DXB', 'Dubai (DXB-Dubai Intl.)', 'EVN', 'Yerevan (EVN-Zvartnots Intl.)', '2026-05-27 08:05:00+04', '2026-05-27 13:20:00+04', 315, 0, '{}', 'Economy', 'M', 'adult: 30 kg', 0, 'SAR', true, 'available'),
  ('00000000-0000-4000-8000-000000000602', '00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000201', 'Middle East Airlines', 'ME', null, 'ME429', 'DXB', 'Dubai (DXB-Dubai Intl.)', 'EVN', 'Yerevan (EVN-Zvartnots Intl.)', '2026-05-27 08:05:00+04', '2026-05-28 09:10:00+04', 720, 1, array['BEY'], 'Economy', 'L', 'adult: 1 checked bag', 984, 'SAR', false, 'available'),
  ('00000000-0000-4000-8000-000000000603', '00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000201', 'EgyptAir', 'MS', null, 'MS913', 'DXB', 'Dubai (DXB-Dubai Intl.)', 'EVN', 'Yerevan (EVN-Zvartnots Intl.)', '2026-05-27 16:20:00+04', '2026-05-28 07:15:00+04', 895, 2, array['CAI','SSH'], 'Economy', 'K', 'adult: 30 kg', 3820, 'SAR', false, 'available'),
  ('00000000-0000-4000-8000-000000000604', '00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000201', 'Emirates', 'EK', null, 'EK2268', 'DXB', 'Dubai (DXB-Dubai Intl.)', 'EVN', 'Yerevan (EVN-Zvartnots Intl.)', '2026-05-27 08:05:00+04', '2026-05-27 13:20:00+04', 315, 0, '{}', 'Economy', 'B', 'adult: 30 kg', 1762, 'SAR', false, 'available'),
  ('00000000-0000-4000-8000-000000000605', '00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000507', '00000000-0000-4000-8000-000000000201', 'flydubai', 'FZ', null, 'FZ718', 'EVN', 'Yerevan (EVN-Zvartnots Intl.)', 'DXB', 'Dubai (DXB-Dubai Intl.)', '2026-05-29 12:25:00+04', '2026-05-29 17:55:00+04', 330, 0, '{}', 'Economy', 'O', 'adult: 30 kg', 0, 'SAR', true, 'available')
on conflict (id) do update
set airline_name = excluded.airline_name,
    airline_code = excluded.airline_code,
    flight_number = excluded.flight_number,
    departure_at = excluded.departure_at,
    arrival_at = excluded.arrival_at,
    duration_minutes = excluded.duration_minutes,
    stops_count = excluded.stops_count,
    layover_airports = excluded.layover_airports,
    cabin = excluded.cabin,
    fare_class = excluded.fare_class,
    baggage_label = excluded.baggage_label,
    price_delta_amount = excluded.price_delta_amount,
    is_default = excluded.is_default,
    status = excluded.status;

insert into public.trip_hotel_options (
  id,
  trip_id,
  segment_id,
  provider_id,
  hotel_name,
  address,
  star_rating,
  room_name,
  board_basis,
  check_in_day_offset,
  check_out_day_offset,
  nights,
  latitude,
  longitude,
  image_url,
  guest_rating,
  amenities,
  price_delta_amount,
  currency,
  is_default,
  status
)
values
  ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000503', '00000000-0000-4000-8000-000000000202', 'Boulevard Hotel', '37 Pavstos Buzand, Yerevan', 4, 'Deluxe Double room with balcony', 'Breakfast included', 0, 2, 2, 40.1816, 44.5107, 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=82', 8.6, array['Breakfast','Central location','Non-smoking'], 0, 'SAR', true, 'available'),
  ('00000000-0000-4000-8000-000000000702', '00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000503', '00000000-0000-4000-8000-000000000202', 'Royal Plaza by Stellar Hotels', '9 Martiros Saryan Street, Yerevan', 4, 'Economy Double or Twin Room', 'Room only', 0, 2, 2, 40.1855, 44.5066, 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=900&q=82', 8.2, array['Restaurant','WiFi','City center'], 183, 'SAR', false, 'available'),
  ('00000000-0000-4000-8000-000000000703', '00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000503', '00000000-0000-4000-8000-000000000202', 'Opera Suite Hotel', 'Baghramyan 1st Lane, Yerevan', 4, 'Executive Suite King', 'Breakfast included', 0, 2, 2, 40.1901, 44.5159, 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=900&q=82', 8.8, array['Suite','Breakfast','Fitness'], 195, 'SAR', false, 'available'),
  ('00000000-0000-4000-8000-000000000704', '00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000503', '00000000-0000-4000-8000-000000000202', 'Republica Hotel Yerevan', '7/1 Amiryan Street, Yerevan', 4, 'Comfort Double Room', 'Breakfast included', 0, 2, 2, 40.1799, 44.5102, 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=900&q=82', 9.0, array['Breakfast','WiFi','Family rooms'], 245, 'SAR', false, 'available')
on conflict (id) do update
set hotel_name = excluded.hotel_name,
    address = excluded.address,
    star_rating = excluded.star_rating,
    room_name = excluded.room_name,
    board_basis = excluded.board_basis,
    image_url = excluded.image_url,
    guest_rating = excluded.guest_rating,
    amenities = excluded.amenities,
    price_delta_amount = excluded.price_delta_amount,
    is_default = excluded.is_default,
    status = excluded.status;

insert into public.trip_transfer_options (
  id,
  trip_id,
  segment_id,
  provider_id,
  title,
  pickup_label,
  dropoff_label,
  vehicle_type,
  vehicle_image_url,
  luggage_count,
  pax_min,
  pax_max,
  duration_minutes,
  price_delta_amount,
  currency,
  is_default,
  status
)
values
  ('00000000-0000-4000-8000-000000000801', '00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000203', 'Car (1-3)', 'Yerevan Airport', 'Yerevan Hotel', 'car', 'https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=700&q=82', 2, 1, 3, 30, 0, 'SAR', true, 'available'),
  ('00000000-0000-4000-8000-000000000802', '00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000203', 'Mini Van (4-7)', 'Yerevan Airport', 'Yerevan Hotel', 'mini-van', 'https://images.unsplash.com/photo-1549924231-f129b911e442?auto=format&fit=crop&w=700&q=82', 4, 4, 7, 30, 55, 'SAR', false, 'available'),
  ('00000000-0000-4000-8000-000000000803', '00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000506', '00000000-0000-4000-8000-000000000203', 'Car (1-3)', 'Yerevan Hotel', 'Yerevan Airport', 'car', 'https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=700&q=82', 2, 1, 3, 30, 0, 'SAR', true, 'available'),
  ('00000000-0000-4000-8000-000000000804', '00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000506', '00000000-0000-4000-8000-000000000203', 'Mini Van (4-7)', 'Yerevan Hotel', 'Yerevan Airport', 'mini-van', 'https://images.unsplash.com/photo-1549924231-f129b911e442?auto=format&fit=crop&w=700&q=82', 4, 4, 7, 30, 55, 'SAR', false, 'available')
on conflict (id) do update
set title = excluded.title,
    pickup_label = excluded.pickup_label,
    dropoff_label = excluded.dropoff_label,
    vehicle_type = excluded.vehicle_type,
    vehicle_image_url = excluded.vehicle_image_url,
    luggage_count = excluded.luggage_count,
    pax_min = excluded.pax_min,
    pax_max = excluded.pax_max,
    duration_minutes = excluded.duration_minutes,
    price_delta_amount = excluded.price_delta_amount,
    is_default = excluded.is_default,
    status = excluded.status;

insert into public.trip_activity_options (
  id,
  trip_id,
  segment_id,
  provider_id,
  title,
  description,
  category,
  day_offset,
  duration_minutes,
  pickup_included,
  location_label,
  latitude,
  longitude,
  image_url,
  price_delta_amount,
  currency,
  is_default,
  status
)
values
  ('00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000504', '00000000-0000-4000-8000-000000000204', 'Private Yerevan City Tour: Erebuni, Matenadaran & Tsitsernakaberd Museums', 'Explore the highlights of Yerevan on a half-day city tour.', 'Half Day Tour', 0, 300, true, 'Yerevan', 40.1872, 44.5152, 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=82', 355, 'SAR', true, 'available'),
  ('00000000-0000-4000-8000-000000000902', '00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000504', '00000000-0000-4000-8000-000000000204', 'Food and Heritage Evening Walk', 'A relaxed guided walk with local snacks and cultural stops.', 'Evening Tour', 0, 180, true, 'Yerevan', 40.1811, 44.5136, 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=900&q=82', 240, 'SAR', false, 'available'),
  ('00000000-0000-4000-8000-000000000903', '00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000505', '00000000-0000-4000-8000-000000000204', 'Private Half Day Echmiadzin Cathedral, Hripsime & Zvartnots Temple from Yerevan', 'Explore UNESCO listed religious landmarks around Yerevan.', 'Day Trips & Excursions', 1, 420, true, 'Yerevan', 40.1596, 44.2919, 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=82', 385, 'SAR', true, 'available'),
  ('00000000-0000-4000-8000-000000000904', '00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000505', '00000000-0000-4000-8000-000000000204', 'Day Trip to Garni, Geghard and Lake Sevan', 'Discover Armenia cultural and natural highlights in one full-day tour.', 'Day Trips & Excursions', 1, 540, true, 'Lake Sevan', 40.5475, 44.9618, 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=82', 420, 'SAR', false, 'available')
on conflict (id) do update
set title = excluded.title,
    description = excluded.description,
    category = excluded.category,
    day_offset = excluded.day_offset,
    duration_minutes = excluded.duration_minutes,
    pickup_included = excluded.pickup_included,
    location_label = excluded.location_label,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    image_url = excluded.image_url,
    price_delta_amount = excluded.price_delta_amount,
    is_default = excluded.is_default,
    status = excluded.status;
