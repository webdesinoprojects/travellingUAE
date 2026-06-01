-- AD-5B: media_assets.status column for archive / restore
--
-- Adds a real `status publish_status` column to media_assets so the admin
-- library can archive uploads without deleting provider files, restore them,
-- and so public reads only see published media. Existing rows are flipped to
-- `published` because current home/trip/footer/destination media is already
-- live demo content that the public DAL is wired to display.

alter table public.media_assets
  add column if not exists status public.publish_status;

update public.media_assets
  set status = 'published'::public.publish_status
  where status is null;

alter table public.media_assets
  alter column status set default 'published'::public.publish_status;

alter table public.media_assets
  alter column status set not null;

create index if not exists media_assets_status_updated_at_idx
  on public.media_assets(status, updated_at desc, id desc);

create index if not exists media_assets_folder_status_idx
  on public.media_assets(folder, status);

-- Replace the existing "media public read" policy that exposed every row.
-- Public/anonymous reads now only see status='published'; admin/editor reads
-- continue through the existing "media editor manage" policy and the
-- service-role client used by protected admin routes.
drop policy if exists "media public read" on public.media_assets;
drop policy if exists "media public read published" on public.media_assets;

create policy "media public read published"
  on public.media_assets for select
  using (status = 'published'::public.publish_status);
