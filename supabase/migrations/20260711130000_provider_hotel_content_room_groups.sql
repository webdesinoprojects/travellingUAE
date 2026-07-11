alter table public.provider_hotel_content
  add column if not exists room_groups jsonb;

comment on column public.provider_hotel_content.room_groups is
  'Sanitized RateHawk static room_groups payload for public room photos/details. Nullable when not synced or unavailable.';
