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
  ('00000000-0000-4000-8000-000000000105', 'external', 'https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=1200&q=82', 'Private black sedan transfer vehicle', 'demo/transfers'),
  ('00000000-0000-4000-8000-000000000106', 'external', 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1200&q=82', 'Wellness spa treatment with oil', 'home/fly-time-picks'),
  ('00000000-0000-4000-8000-000000000107', 'external', 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1200&q=82', 'Kerala backwater boat route', 'home/fly-time-picks'),
  ('00000000-0000-4000-8000-000000000108', 'external', 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?auto=format&fit=crop&w=1200&q=82', 'Snowy mountain ridge with clouds', 'home/fly-time-picks'),
  ('00000000-0000-4000-8000-000000000109', 'external', 'https://images.unsplash.com/photo-1548574505-5e239809ee19?auto=format&fit=crop&w=1200&q=82', 'Blue water cruise terminal', 'home/fly-time-picks'),
  ('00000000-0000-4000-8000-000000000110', 'external', 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=82', 'Himalayan mountain route in Nepal', 'home/route-board'),
  ('00000000-0000-4000-8000-000000000111', 'external', 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1200&q=82', 'Vietnam coastline with boats', 'home/route-board'),
  ('00000000-0000-4000-8000-000000000112', 'external', 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=1200&q=82', 'Malaysia city garden skyline', 'home/route-board'),
  ('00000000-0000-4000-8000-000000000113', 'external', 'https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?auto=format&fit=crop&w=1200&q=82', 'Turkey city tower at sunset', 'home/route-board'),
  ('00000000-0000-4000-8000-000000000114', 'external', 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=82', 'Resort hotel pool and villas', 'home/services'),
  ('00000000-0000-4000-8000-000000000115', 'external', 'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1200&q=82', 'Travel document signing desk', 'home/services')
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

insert into public.pages (
  id,
  slug,
  title,
  excerpt,
  body,
  status,
  seo_title,
  seo_description
)
values
  (
    '00000000-0000-4000-8000-000000001001',
    'about',
    'About Fly Time',
    'A travel desk built for clear routes, practical support, and simple booking handoffs.',
    'Fly Time helps travelers plan flights, holidays, visas, stays, and local transport through one coordinated travel desk.\n\nThe website is prepared for backend-managed inventory, provider-backed search, and admin-managed content. Until live supplier keys are connected, service requests are handled as enquiries and routed through Fly Time operations.\n\nOur focus is to keep package information readable, pricing clear, and support steps visible before a traveler commits.',
    'published',
    'About Fly Time',
    'Learn how Fly Time handles flights, holidays, visas, stays, and travel support.'
  ),
  (
    '00000000-0000-4000-8000-000000001002',
    'contact',
    'Contact Fly Time',
    'Send trip, visa, hotel, flight, transfer, or support questions to the travel desk.',
    'For package enquiries, flight support, hotel stays, visas, transport, insurance, and custom routes, share the travel details through the enquiry form or contact the Fly Time team directly.\n\nDo not send passport scans, payment screenshots, or sensitive traveler documents until a verified Fly Time team member asks for them through an approved channel.',
    'published',
    'Contact Fly Time',
    'Contact Fly Time for travel enquiries, visa support, holiday routes, and hotel or flight help.'
  ),
  (
    '00000000-0000-4000-8000-000000001003',
    'terms',
    'Terms And Conditions',
    'General booking, enquiry, pricing, availability, and service terms for Fly Time customers.',
    'All package, hotel, flight, transfer, visa, and activity information shown on the website is subject to availability and final confirmation by Fly Time or the relevant supplier.\n\nPrices may change until a booking is confirmed. Provider rates, taxes, cancellation conditions, and availability can change during search, recheck, or booking confirmation.\n\nCustomers are responsible for sharing accurate traveler names, passport details, travel dates, nationality, residency, and contact information when requested. Fly Time may reject incomplete or inconsistent booking details.\n\nVisa approval, airline acceptance, hotel check-in, and border entry decisions are controlled by the relevant authorities or suppliers, not by Fly Time.',
    'published',
    'Fly Time Terms And Conditions',
    'Read Fly Time terms for enquiries, prices, availability, bookings, and supplier-controlled services.'
  ),
  (
    '00000000-0000-4000-8000-000000001004',
    'privacy',
    'Privacy Policy',
    'How Fly Time handles enquiry, booking, contact, and travel support information.',
    'Fly Time collects only the information needed to respond to enquiries, prepare quotes, process bookings, and support travel services.\n\nCustomer details are handled through server-side APIs and admin-only workflows. Sensitive API keys, supplier credentials, and internal booking notes are not exposed through public website code.\n\nTraveler documents and payment details should only be shared through verified channels. The website should not be used to publish or expose confidential booking data.',
    'published',
    'Fly Time Privacy Policy',
    'Learn how Fly Time handles enquiry, booking, and travel support information.'
  ),
  (
    '00000000-0000-4000-8000-000000001005',
    'refund-policy',
    'Refund And Cancellation Policy',
    'Cancellation and refund handling depends on each confirmed supplier rule.',
    'Refund and cancellation eligibility depends on the confirmed flight, hotel, transfer, visa, activity, or package supplier rules.\n\nSome services may be non-refundable after confirmation. Others may allow cancellation with fees or before a defined deadline.\n\nFinal cancellation conditions should be checked during the quote, recheck, and booking confirmation steps before payment is collected.',
    'published',
    'Fly Time Refund And Cancellation Policy',
    'Understand how Fly Time handles refund and cancellation conditions.'
  ),
  (
    '00000000-0000-4000-8000-000000001006',
    'passport-services',
    'Passport Services',
    'Support for passport-related travel desk enquiries and documentation guidance.',
    'Fly Time can help route passport service enquiries to the correct travel desk workflow.\n\nCustomers should confirm the required service, traveler nationality, current passport status, expected travel date, and urgency before submitting documents.',
    'published',
    'Fly Time Passport Services',
    'Passport-related travel support and documentation enquiry guidance.'
  ),
  (
    '00000000-0000-4000-8000-000000001007',
    'document-attestation',
    'Document Attestation',
    'Document attestation enquiry support for travel and administrative needs.',
    'Fly Time can receive document attestation enquiries and route them to the relevant support workflow.\n\nRequirements vary by document type, issuing country, destination country, and intended use. Final document handling should be confirmed before originals or sensitive scans are shared.',
    'published',
    'Fly Time Document Attestation',
    'Document attestation enquiry support for travel and administrative requirements.'
  ),
  (
    '00000000-0000-4000-8000-000000001019',
    'journal',
    'Fly Time Journal',
    'Travel desk notes, route updates, visa reminders, and destination planning guidance.',
    'The Fly Time journal is prepared for route notes, visa reminders, service updates, and practical travel planning guidance.\n\nEditors can replace this baseline page through the CMS once the publishing calendar is ready.',
    'published',
    'Fly Time Journal',
    'Travel desk notes, route updates, visa reminders, and destination planning guidance from Fly Time.'
  )
on conflict (slug) do update
set title = excluded.title,
    excerpt = excluded.excerpt,
    body = excluded.body,
    status = excluded.status,
    seo_title = excluded.seo_title,
    seo_description = excluded.seo_description;

insert into public.site_sections (
  id,
  key,
  title,
  eyebrow,
  description,
  payload,
  status
)
values
  (
    '00000000-0000-4000-8000-000000001008',
    'home.hero',
    'Home Hero',
    'Homepage',
    'Public homepage background media.',
    '{"backgroundImage":"https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=2200&q=86","backgroundAlt":"Road trip through a warm desert mountain route"}'::jsonb,
    'published'
  )
on conflict (key) do update
set title = excluded.title,
    eyebrow = excluded.eyebrow,
    description = excluded.description,
    payload = excluded.payload,
    status = excluded.status;

insert into public.site_sections (
  id,
  key,
  title,
  eyebrow,
  description,
  payload,
  status
)
values
  (
    '00000000-0000-4000-8000-000000001009',
    'home.footer',
    'Footer Settings',
    'Homepage',
    'Footer contact info and social platform links.',
    '{"contact":{"tagline":"Fly Time connects flights, stays, visas and destination support into a booking flow that feels calm from enquiry to departure.","address":"Head Office, BKM Hospital Bldg. Bypass Road, Payyanur, Kannur","phone":"+91 904 831 77 11","email":"hello@flytime.example"},"socialLinks":[{"platform":"facebook","label":"Facebook","href":"https://www.facebook.com/"},{"platform":"youtube","label":"YouTube","href":"https://www.youtube.com/"},{"platform":"instagram","label":"Instagram","href":"https://www.instagram.com/"},{"platform":"linkedin","label":"LinkedIn","href":"https://www.linkedin.com/"}]}'::jsonb,
    'published'
  )
on conflict (key) do update
set title = excluded.title,
    eyebrow = excluded.eyebrow,
    description = excluded.description,
    payload = excluded.payload,
    status = excluded.status;

insert into public.navigation_items (
  id,
  location,
  parent_id,
  label,
  href,
  has_dropdown,
  status,
  sort_order
)
values
  ('00000000-0000-4000-8000-000000001101', 'header', null, 'Flights', '/?service=flight#travel-search', false, 'published', 10),
  ('00000000-0000-4000-8000-000000001102', 'header', null, 'Visa Desk', '/?service=visa#travel-search', true, 'published', 20),
  ('00000000-0000-4000-8000-000000001103', 'header', '00000000-0000-4000-8000-000000001102', 'Gulf Visa', '/gulf-visa', false, 'published', 10),
  ('00000000-0000-4000-8000-000000001104', 'header', '00000000-0000-4000-8000-000000001102', 'Global Visa', '/global-visa', false, 'published', 20),
  ('00000000-0000-4000-8000-000000001105', 'header', '00000000-0000-4000-8000-000000001102', 'Document Attestation', '/document-attestation', false, 'archived', 30),
  ('00000000-0000-4000-8000-000000001106', 'header', null, 'Holidays', '/?service=packages#travel-search', true, 'published', 30),
  ('00000000-0000-4000-8000-000000001107', 'header', '00000000-0000-4000-8000-000000001106', 'Holiday Packages', '/?service=packages#travel-search', false, 'published', 10),
  ('00000000-0000-4000-8000-000000001108', 'header', '00000000-0000-4000-8000-000000001106', 'Customised Packages', '/?service=customized-packages#travel-search', false, 'published', 20),
  ('00000000-0000-4000-8000-000000001109', 'header', '00000000-0000-4000-8000-000000001106', 'Hajj & Umrah', '/hajj-umrah', false, 'published', 30),
  ('00000000-0000-4000-8000-000000001110', 'header', null, 'Wellness', '/?service=wellness#travel-search', false, 'published', 40),
  ('00000000-0000-4000-8000-000000001111', 'header', null, 'Travel Desk', '/?service=transfers#travel-search', true, 'published', 50),
  ('00000000-0000-4000-8000-000000001112', 'header', '00000000-0000-4000-8000-000000001111', 'Transfers', '/?service=transfers#travel-search', false, 'published', 10),
  ('00000000-0000-4000-8000-000000001113', 'header', '00000000-0000-4000-8000-000000001111', 'Car Rental', '/?service=car-rental#travel-search', false, 'published', 20),
  ('00000000-0000-4000-8000-000000001114', 'header', '00000000-0000-4000-8000-000000001111', 'Insurance', '/?service=insurance#travel-search', false, 'published', 30),
  ('00000000-0000-4000-8000-000000001115', 'header', '00000000-0000-4000-8000-000000001111', 'Assist Service', '/?service=assist-service#travel-search', false, 'published', 40),
  ('00000000-0000-4000-8000-000000001116', 'header', '00000000-0000-4000-8000-000000001111', 'E-SIM', '/?service=e-sim#travel-search', false, 'published', 50),
  ('00000000-0000-4000-8000-000000001117', 'header', null, 'Hajj & Umrah', '/hajj-umrah', false, 'published', 60),
  ('00000000-0000-4000-8000-000000001118', 'header', null, 'Journal', '/journal', false, 'published', 70)
on conflict (id) do update
set location = excluded.location,
    parent_id = excluded.parent_id,
    label = excluded.label,
    href = excluded.href,
    has_dropdown = excluded.has_dropdown,
    status = excluded.status,
    sort_order = excluded.sort_order;

insert into public.footer_columns (id, title, status, sort_order)
values
  ('00000000-0000-4000-8000-000000001201', 'Company', 'published', 10),
  ('00000000-0000-4000-8000-000000001202', 'Travel Desk', 'published', 20),
  ('00000000-0000-4000-8000-000000001203', 'Legal', 'published', 30)
on conflict (id) do update
set title = excluded.title,
    status = excluded.status,
    sort_order = excluded.sort_order;

insert into public.footer_links (id, column_id, label, href, status, sort_order)
values
  ('00000000-0000-4000-8000-000000001211', '00000000-0000-4000-8000-000000001201', 'About Fly Time', '/about', 'published', 10),
  ('00000000-0000-4000-8000-000000001212', '00000000-0000-4000-8000-000000001201', 'Work with us', '/contact', 'published', 20),
  ('00000000-0000-4000-8000-000000001213', '00000000-0000-4000-8000-000000001201', 'Contact desk', '/contact', 'published', 30),
  ('00000000-0000-4000-8000-000000001221', '00000000-0000-4000-8000-000000001202', 'India Tour Package', '/trips', 'published', 10),
  ('00000000-0000-4000-8000-000000001222', '00000000-0000-4000-8000-000000001202', 'International Tour Package', '/trips', 'published', 20),
  ('00000000-0000-4000-8000-000000001223', '00000000-0000-4000-8000-000000001202', 'Flight', '/?service=flight#travel-search', 'published', 30),
  ('00000000-0000-4000-8000-000000001224', '00000000-0000-4000-8000-000000001202', 'Global Visa', '/global-visa', 'published', 40),
  ('00000000-0000-4000-8000-000000001225', '00000000-0000-4000-8000-000000001202', 'Gulf Visa', '/gulf-visa', 'published', 50),
  ('00000000-0000-4000-8000-000000001226', '00000000-0000-4000-8000-000000001202', 'Hajj & Umrah', '/hajj-umrah', 'published', 60),
  ('00000000-0000-4000-8000-000000001227', '00000000-0000-4000-8000-000000001202', 'Passport Services', '/passport-services', 'published', 70),
  ('00000000-0000-4000-8000-000000001228', '00000000-0000-4000-8000-000000001202', 'Document Attestation', '/document-attestation', 'published', 80),
  ('00000000-0000-4000-8000-000000001229', '00000000-0000-4000-8000-000000001202', 'Travel Insurance', '/?service=insurance#travel-search', 'published', 90),
  ('00000000-0000-4000-8000-000000001230', '00000000-0000-4000-8000-000000001202', 'Cruise', '/?service=cruise#travel-search', 'published', 100),
  ('00000000-0000-4000-8000-000000001234', '00000000-0000-4000-8000-000000001202', 'Hotel Booking', '/?service=hotel#travel-search', 'published', 110),
  ('00000000-0000-4000-8000-000000001235', '00000000-0000-4000-8000-000000001202', 'Bus & Train Tickets', '/?service=transfers#travel-search', 'published', 120),
  ('00000000-0000-4000-8000-000000001231', '00000000-0000-4000-8000-000000001203', 'Privacy Policy', '/privacy', 'published', 10),
  ('00000000-0000-4000-8000-000000001232', '00000000-0000-4000-8000-000000001203', 'Terms & Conditions', '/terms', 'published', 20),
  ('00000000-0000-4000-8000-000000001233', '00000000-0000-4000-8000-000000001203', 'Refund Policy', '/refund-policy', 'published', 30)
on conflict (id) do update
set column_id = excluded.column_id,
    label = excluded.label,
    href = excluded.href,
    status = excluded.status,
    sort_order = excluded.sort_order;

insert into public.collections (
  id,
  slug,
  title,
  eyebrow,
  description,
  type,
  status,
  sort_order
)
values
  ('00000000-0000-4000-8000-000000001301', 'fly-time-picks', 'Fly Time Picks', 'Handpicked Deals', 'Seasonal offers with clear pricing, simple actions, and fast paths into package details.', 'flytime_picks', 'published', 10),
  ('00000000-0000-4000-8000-000000001302', 'routes-people-ask-for', 'Routes People Ask For', 'Holiday Lanes', 'A visual board of short breaks, city stays, alpine escapes and Eid routes that can open directly into available packages.', 'route_board', 'published', 20)
on conflict (slug) do update
set title = excluded.title,
    eyebrow = excluded.eyebrow,
    description = excluded.description,
    type = excluded.type,
    status = excluded.status,
    sort_order = excluded.sort_order;

insert into public.collection_items (
  id,
  collection_id,
  title,
  subtitle,
  price_label,
  duration_label,
  action_label,
  href,
  media_id,
  status,
  sort_order,
  metadata
)
values
  ('00000000-0000-4000-8000-000000001311', '00000000-0000-4000-8000-000000001301', 'Reset Retreats', 'A clear next step for fares, stays, and holiday routes.', 'INR 44,000', null, 'Plan Stay', '/?service=wellness#travel-search', '00000000-0000-4000-8000-000000000106', 'published', 10, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001312', '00000000-0000-4000-8000-000000001301', 'Backwater Weekends', 'A clear next step for fares, stays, and holiday routes.', 'INR 13,325', null, 'View Route', '/trips', '00000000-0000-4000-8000-000000000107', 'published', 20, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001313', '00000000-0000-4000-8000-000000001301', 'Flexible Air Fares', 'A clear next step for fares, stays, and holiday routes.', 'INR 16,799', null, 'Search Fare', '/?service=flight#travel-search', '00000000-0000-4000-8000-000000000101', 'published', 30, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001314', '00000000-0000-4000-8000-000000001301', 'Snowline Holidays', 'A clear next step for fares, stays, and holiday routes.', 'INR 16,500', null, 'View Stay', '/trips', '00000000-0000-4000-8000-000000000108', 'published', 40, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001315', '00000000-0000-4000-8000-000000001301', 'Blue Water Cruises', 'A clear next step for fares, stays, and holiday routes.', 'INR 33,990', null, 'Plan Cruise', '/?service=cruise#travel-search', '00000000-0000-4000-8000-000000000109', 'published', 50, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001321', '00000000-0000-4000-8000-000000001302', 'Kathmandu & Peaks', 'Nepal route', 'Starts INR 14,444', '4 Nights / 5 Days', 'View Route', '/trips', '00000000-0000-4000-8000-000000000110', 'published', 10, '{"size":"featured"}'::jsonb),
  ('00000000-0000-4000-8000-000000001322', '00000000-0000-4000-8000-000000001302', 'Vietnam Coastline', 'Vietnam route', 'Starts INR 33,899', '3 Nights / 4 Days', 'View Route', '/trips', '00000000-0000-4000-8000-000000000111', 'published', 20, '{"size":"small"}'::jsonb),
  ('00000000-0000-4000-8000-000000001323', '00000000-0000-4000-8000-000000001302', 'Malaysia City Break', 'Malaysia route', 'Starts INR 27,666', '3 Nights / 4 Days', 'View Route', '/trips', '00000000-0000-4000-8000-000000000112', 'published', 30, '{"size":"small"}'::jsonb),
  ('00000000-0000-4000-8000-000000001324', '00000000-0000-4000-8000-000000001302', 'Turkey Eid Route', 'Turkey route', 'Starts SAR 2,999', '3 Nights / 4 Days', 'View Route', '/trips/turkey', '00000000-0000-4000-8000-000000000113', 'published', 40, '{"size":"wide"}'::jsonb)
on conflict (id) do update
set collection_id = excluded.collection_id,
    title = excluded.title,
    subtitle = excluded.subtitle,
    price_label = excluded.price_label,
    duration_label = excluded.duration_label,
    action_label = excluded.action_label,
    href = excluded.href,
    media_id = excluded.media_id,
    status = excluded.status,
    sort_order = excluded.sort_order,
    metadata = excluded.metadata;

insert into public.services (
  id,
  slug,
  title,
  summary,
  body,
  icon,
  media_id,
  status,
  sort_order
)
values
  ('00000000-0000-4000-8000-000000001401', 'cruise-desk', 'Cruise Desk', 'Straightforward help, tidy documents, and quick handoffs.', 'Cruise requests are routed through the enquiry flow until live supplier integrations are connected.', 'cruise', '00000000-0000-4000-8000-000000000109', 'published', 10),
  ('00000000-0000-4000-8000-000000001402', 'hotel-stays', 'Hotel Stays', 'Straightforward help, tidy documents, and quick handoffs.', 'Hotel stays will later connect to provider-backed search, recheck, and booking confirmation.', 'hotel', '00000000-0000-4000-8000-000000000114', 'published', 20),
  ('00000000-0000-4000-8000-000000001403', 'rail-coach', 'Rail & Coach', 'Straightforward help, tidy documents, and quick handoffs.', 'Ground transport requests stay enquiry-based until provider scope is finalized.', 'bus', '00000000-0000-4000-8000-000000000105', 'published', 30),
  ('00000000-0000-4000-8000-000000001404', 'passport-desk', 'Passport Desk', 'Straightforward help, tidy documents, and quick handoffs.', 'Customers should share only required passport details through approved channels after verification.', 'passport', '00000000-0000-4000-8000-000000000115', 'published', 40),
  ('00000000-0000-4000-8000-000000001405', 'document-attestation', 'Document Attestation', 'Straightforward help, tidy documents, and quick handoffs.', 'Final attestation requirements depend on document type, issuing country, and destination country.', 'document', '00000000-0000-4000-8000-000000000115', 'published', 50),
  ('00000000-0000-4000-8000-000000001406', 'travel-cover', 'Travel Cover', 'Straightforward help, tidy documents, and quick handoffs.', 'Travel cover requests are handled as enquiries until the insurance provider flow is confirmed.', 'insurance', '00000000-0000-4000-8000-000000000102', 'published', 60)
on conflict (slug) do update
set title = excluded.title,
    summary = excluded.summary,
    body = excluded.body,
    icon = excluded.icon,
    media_id = excluded.media_id,
    status = excluded.status,
    sort_order = excluded.sort_order;

insert into public.testimonials (
  id,
  author,
  quote,
  media_id,
  status,
  sort_order
)
values
  ('00000000-0000-4000-8000-000000001501', 'Muhammed Ashik', 'Fly Time kept my UAE visa process calm and clear. I always knew the next step.', null, 'published', 10),
  ('00000000-0000-4000-8000-000000001502', 'Nekil Taji', 'Our Singapore break felt organized from airport pickup to the last hotel checkout.', '00000000-0000-4000-8000-000000000113', 'published', 20),
  ('00000000-0000-4000-8000-000000001503', 'Arjun KS', 'The Nepal route had the right pace, clean hotels, and support whenever we needed it.', null, 'published', 30),
  ('00000000-0000-4000-8000-000000001504', 'Amritha K.S', 'The mountain stay was smooth, quiet, and easy to follow from the first call.', '00000000-0000-4000-8000-000000000103', 'published', 40),
  ('00000000-0000-4000-8000-000000001505', 'Cedric Dsilva', 'Phuket was handled neatly: transfers, rooms, and activity options were all clear.', null, 'published', 50),
  ('00000000-0000-4000-8000-000000001506', 'Rahul M R', 'I picked Fly Time for a family holiday and the plan stayed simple the whole way.', '00000000-0000-4000-8000-000000000108', 'published', 60)
on conflict (id) do update
set author = excluded.author,
    quote = excluded.quote,
    media_id = excluded.media_id,
    status = excluded.status,
    sort_order = excluded.sort_order;

insert into public.translations (
  locale_code,
  namespace,
  translation_key,
  value,
  status
)
values
  ('en', 'common', 'language.english', 'English', 'published'),
  ('en', 'common', 'language.arabic', 'Arabic', 'published'),
  ('en', 'common', 'nav.flight', 'Flights', 'published'),
  ('en', 'common', 'nav.visaDesk', 'Visa Desk', 'published'),
  ('en', 'common', 'nav.gulfVisa', 'Gulf Visa', 'published'),
  ('en', 'common', 'nav.globalVisa', 'Global Visa', 'published'),
  ('en', 'common', 'nav.passportServices', 'Passport Services', 'published'),
  ('en', 'common', 'nav.documentAttestation', 'Document Attestation', 'published'),
  ('en', 'common', 'nav.holidays', 'Holidays', 'published'),
  ('en', 'common', 'nav.holidayPackages', 'Holiday Packages', 'published'),
  ('en', 'common', 'nav.hotel', 'Hotel', 'published'),
  ('en', 'common', 'nav.packages', 'Packages', 'published'),
  ('en', 'common', 'nav.wellness', 'Wellness', 'published'),
  ('en', 'common', 'nav.travelDesk', 'Travel Desk', 'published'),
  ('en', 'common', 'nav.hajjUmrah', 'Hajj & Umrah', 'published'),
  ('en', 'common', 'nav.visa', 'Visa', 'published'),
  ('en', 'common', 'nav.more', 'More', 'published'),
  ('en', 'common', 'nav.assistService', 'Assist Service', 'published'),
  ('en', 'common', 'nav.journal', 'Journal', 'published'),
  ('en', 'common', 'enquire', 'Enquire', 'published'),
  ('en', 'search', 'location', 'Location', 'published'),
  ('en', 'search', 'date', 'Date', 'published'),
  ('en', 'search', 'guests', 'Guests', 'published'),
  ('en', 'search', 'submit', 'Search', 'published'),
  ('en', 'home', 'hero.title', 'Journeys built around your time.', 'published'),
  ('en', 'home', 'hero.description', 'Flights, stays, visas and holiday routes in one calm booking experience for families, groups and frequent travelers.', 'published'),
  ('en', 'home', 'hero.quickAccess', 'Quick access', 'published'),
  ('en', 'home', 'hero.stat.destinations', 'Destination lanes', 'published'),
  ('en', 'home', 'hero.stat.assistance', 'Trip assistance', 'published'),
  ('en', 'home', 'hero.stat.booking', 'Booking journey', 'published'),
  ('ar', 'common', 'language.english', 'الإنجليزية', 'published'),
  ('ar', 'common', 'language.arabic', 'العربية', 'published'),
  ('ar', 'common', 'nav.flight', 'رحلات الطيران', 'published'),
  ('ar', 'common', 'nav.hotel', 'الفنادق', 'published'),
  ('ar', 'common', 'nav.packages', 'الباقات', 'published'),
  ('ar', 'common', 'nav.hajjUmrah', 'الحج والعمرة', 'published'),
  ('ar', 'common', 'nav.visa', 'التأشيرات', 'published'),
  ('ar', 'common', 'nav.more', 'المزيد', 'published'),
  ('ar', 'common', 'enquire', 'استفسار', 'published'),
  ('ar', 'search', 'location', 'الوجهة', 'published'),
  ('ar', 'search', 'date', 'التاريخ', 'published'),
  ('ar', 'search', 'guests', 'المسافرون', 'published'),
  ('ar', 'search', 'submit', 'بحث', 'published'),
  ('ar', 'home', 'hero.title', 'رحلات مصممة حول وقتك.', 'published'),
  ('ar', 'home', 'hero.description', 'رحلات الطيران والإقامات والتأشيرات وباقات العطلات في تجربة حجز واضحة للعائلات والمجموعات والمسافرين الدائمين.', 'published'),
  ('ar', 'home', 'hero.quickAccess', 'وصول سريع', 'published'),
  ('ar', 'home', 'hero.stat.destinations', 'مسارات الوجهات', 'published'),
  ('ar', 'home', 'hero.stat.assistance', 'مساعدة الرحلة', 'published'),
  ('ar', 'home', 'hero.stat.booking', 'رحلة حجز من 4 خطوات', 'published')
on conflict (locale_code, namespace, translation_key) do update
set value = excluded.value,
    status = excluded.status;

insert into public.translations (
  locale_code,
  namespace,
  translation_key,
  value,
  status
)
values
  ('en', 'common', 'nav.transfers', 'Transfers', 'published'),
  ('en', 'common', 'nav.carRental', 'Car Rental', 'published'),
  ('en', 'common', 'nav.insurance', 'Insurance', 'published'),
  ('en', 'common', 'nav.assistService', 'Assist Service', 'published'),
  ('en', 'common', 'nav.cruise', 'Cruise', 'published'),
  ('en', 'common', 'nav.visaDesk', 'Visa Desk', 'published'),
  ('en', 'common', 'nav.gulfVisa', 'Gulf Visa', 'published'),
  ('en', 'common', 'nav.globalVisa', 'Global Visa', 'published'),
  ('en', 'common', 'nav.passportServices', 'Passport Services', 'published'),
  ('en', 'common', 'nav.documentAttestation', 'Document Attestation', 'published'),
  ('en', 'common', 'nav.holidays', 'Holidays', 'published'),
  ('en', 'common', 'nav.holidayPackages', 'Holiday Packages', 'published'),
  ('en', 'common', 'nav.wellness', 'Wellness', 'published'),
  ('en', 'common', 'nav.travelDesk', 'Travel Desk', 'published'),
  ('en', 'common', 'nav.customizedPackages', 'Customised Packages', 'published'),
  ('en', 'common', 'nav.eSim', 'E-SIM', 'published'),
  ('en', 'common', 'nav.journal', 'Journal', 'published'),
  ('ar', 'common', 'language.english', U&'\0627\0644\0625\0646\062C\0644\064A\0632\064A\0629', 'published'),
  ('ar', 'common', 'language.arabic', U&'\0627\0644\0639\0631\0628\064A\0629', 'published'),
  ('ar', 'common', 'nav.flight', U&'\0631\062D\0644\0627\062A \0627\0644\0637\064A\0631\0627\0646', 'published'),
  ('ar', 'common', 'nav.hotel', U&'\0627\0644\0641\0646\0627\062F\0642', 'published'),
  ('ar', 'common', 'nav.packages', U&'\0627\0644\0628\0627\0642\0627\062A', 'published'),
  ('ar', 'common', 'nav.hajjUmrah', U&'\0627\0644\062D\062C \0648\0627\0644\0639\0645\0631\0629', 'published'),
  ('ar', 'common', 'nav.visa', U&'\0627\0644\062A\0623\0634\064A\0631\0627\062A', 'published'),
  ('ar', 'common', 'nav.more', U&'\0627\0644\0645\0632\064A\062F', 'published'),
  ('ar', 'common', 'nav.transfers', U&'\0627\0644\0646\0642\0644', 'published'),
  ('ar', 'common', 'nav.carRental', U&'\062A\0623\062C\064A\0631 \0627\0644\0633\064A\0627\0631\0627\062A', 'published'),
  ('ar', 'common', 'nav.insurance', U&'\0627\0644\062A\0623\0645\064A\0646', 'published'),
  ('ar', 'common', 'nav.assistService', U&'\062E\062F\0645\0629 \0627\0644\0645\0633\0627\0639\062F\0629', 'published'),
  ('ar', 'common', 'nav.cruise', U&'\0627\0644\0631\062D\0644\0627\062A \0627\0644\0628\062D\0631\064A\0629', 'published'),
  ('ar', 'common', 'nav.visaDesk', U&'\0645\0643\062A\0628 \0627\0644\062A\0623\0634\064A\0631\0627\062A', 'published'),
  ('ar', 'common', 'nav.gulfVisa', U&'\062A\0623\0634\064A\0631\0627\062A \0627\0644\062E\0644\064A\062C', 'published'),
  ('ar', 'common', 'nav.globalVisa', U&'\062A\0623\0634\064A\0631\0627\062A \0639\0627\0644\0645\064A\0629', 'published'),
  ('ar', 'common', 'nav.passportServices', U&'\062E\062F\0645\0627\062A \0627\0644\062C\0648\0627\0632\0627\062A', 'published'),
  ('ar', 'common', 'nav.documentAttestation', U&'\062A\0635\062F\064A\0642 \0627\0644\0648\062B\0627\0626\0642', 'published'),
  ('ar', 'common', 'nav.holidays', U&'\0627\0644\0639\0637\0644\0627\062A', 'published'),
  ('ar', 'common', 'nav.holidayPackages', U&'\0628\0627\0642\0627\062A \0627\0644\0639\0637\0644\0627\062A', 'published'),
  ('ar', 'common', 'nav.wellness', U&'\0627\0644\0639\0627\0641\064A\0629', 'published'),
  ('ar', 'common', 'nav.travelDesk', U&'\0645\0643\062A\0628 \0627\0644\0633\0641\0631', 'published'),
  ('ar', 'common', 'nav.customizedPackages', U&'\0628\0627\0642\0627\062A \0645\062E\0635\0635\0629', 'published'),
  ('ar', 'common', 'nav.eSim', U&'\0627\0644\0634\0631\064A\062D\0629 \0627\0644\0625\0644\0643\062A\0631\0648\0646\064A\0629', 'published'),
  ('ar', 'common', 'nav.journal', U&'\0627\0644\0645\062F\0648\0646\0629', 'published'),
  ('ar', 'common', 'enquire', U&'\0627\0633\062A\0641\0633\0627\0631', 'published'),
  ('ar', 'search', 'location', U&'\0627\0644\0648\062C\0647\0629', 'published'),
  ('ar', 'search', 'date', U&'\0627\0644\062A\0627\0631\064A\062E', 'published'),
  ('ar', 'search', 'guests', U&'\0627\0644\0645\0633\0627\0641\0631\0648\0646', 'published'),
  ('ar', 'search', 'submit', U&'\0628\062D\062B', 'published'),
  ('ar', 'home', 'hero.title', U&'\0631\062D\0644\0627\062A \0645\0635\0645\0645\0629 \062D\0648\0644 \0648\0642\062A\0643.', 'published'),
  ('ar', 'home', 'hero.description', U&'\0631\062D\0644\0627\062A \0627\0644\0637\064A\0631\0627\0646 \0648\0627\0644\0625\0642\0627\0645\0627\062A \0648\0627\0644\062A\0623\0634\064A\0631\0627\062A \0648\0628\0627\0642\0627\062A \0627\0644\0639\0637\0644\0627\062A \0641\064A \062A\062C\0631\0628\0629 \062D\062C\0632 \0648\0627\0636\062D\0629.', 'published'),
  ('ar', 'home', 'hero.quickAccess', U&'\0648\0635\0648\0644 \0633\0631\064A\0639', 'published'),
  ('ar', 'home', 'hero.stat.destinations', U&'\0645\0633\0627\0631\0627\062A \0627\0644\0648\062C\0647\0627\062A', 'published'),
  ('ar', 'home', 'hero.stat.assistance', U&'\0645\0633\0627\0639\062F\0629 \0627\0644\0631\062D\0644\0629', 'published'),
  ('ar', 'home', 'hero.stat.booking', U&'\0631\062D\0644\0629 \062D\062C\0632 \0645\0646 4 \062E\0637\0648\0627\062A', 'published')
on conflict (locale_code, namespace, translation_key) do update
set value = excluded.value,
    status = excluded.status;
