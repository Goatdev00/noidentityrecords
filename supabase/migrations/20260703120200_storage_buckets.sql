-- ============================================================================
-- NO.ID RECORDS — storage buckets + object policies (fase 2)
--
-- Buckets:
--   course-covers  public read  · teachers upload into their own uid/ folder
--   merch-images   public read  · admin only
--   certificates   PRIVATE      · written by Edge Functions (service role),
--                                 delivered to users via signed URLs only
--   avatars        public read  · each user uploads into their own uid/ folder
--
-- Path convention for user uploads: the FIRST folder segment must equal the
-- uploader's auth.uid(). That single rule is what stops a teacher from
-- overwriting another teacher's cover or a user from replacing someone
-- else's avatar.
-- ============================================================================

insert into storage.buckets (id, name, public)
values
  ('course-covers', 'course-covers', true),
  ('merch-images',  'merch-images',  true),
  ('certificates',  'certificates',  false),
  ('avatars',       'avatars',       true)
on conflict (id) do update set public = excluded.public;

-- ----------------------------------------------------------------------------
-- read: the three public buckets are also listable through the API (the
-- public flag already serves files at /object/public/…, this policy keeps
-- REST listing consistent). certificates is deliberately absent: no client
-- read path exists — only service-role signed URLs.
-- ----------------------------------------------------------------------------
drop policy if exists noid_public_read on storage.objects;
create policy noid_public_read on storage.objects
  for select using (
    bucket_id in ('course-covers', 'merch-images', 'avatars')
  );

-- ----------------------------------------------------------------------------
-- avatars: any authenticated user manages files ONLY under avatars/{their uid}/
-- ----------------------------------------------------------------------------
drop policy if exists noid_avatars_insert on storage.objects;
create policy noid_avatars_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists noid_avatars_update on storage.objects;
create policy noid_avatars_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists noid_avatars_delete on storage.objects;
create policy noid_avatars_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ----------------------------------------------------------------------------
-- course-covers: only teachers/admins, and only under their own uid/ folder.
-- (The course row stores the resulting public URL in cover_url.)
-- ----------------------------------------------------------------------------
drop policy if exists noid_covers_insert on storage.objects;
create policy noid_covers_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'course-covers'
    and public.is_teacher_or_admin()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists noid_covers_update on storage.objects;
create policy noid_covers_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'course-covers'
    and public.is_teacher_or_admin()
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'course-covers'
    and public.is_teacher_or_admin()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists noid_covers_delete on storage.objects;
create policy noid_covers_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'course-covers'
    and public.is_teacher_or_admin()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ----------------------------------------------------------------------------
-- merch-images: admin only (managed from the dashboard for now)
-- ----------------------------------------------------------------------------
drop policy if exists noid_merch_write on storage.objects;
create policy noid_merch_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'merch-images' and public.is_admin());

drop policy if exists noid_merch_update on storage.objects;
create policy noid_merch_update on storage.objects
  for update to authenticated
  using (bucket_id = 'merch-images' and public.is_admin())
  with check (bucket_id = 'merch-images' and public.is_admin());

drop policy if exists noid_merch_delete on storage.objects;
create policy noid_merch_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'merch-images' and public.is_admin());

-- certificates: no policies on purpose — service role only.
