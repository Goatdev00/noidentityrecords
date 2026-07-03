-- ============================================================================
-- NO.ID RECORDS — fixes from the adversarial security review (fase 2)
--
-- 1. lesson_progress UPDATE could relocate a progress row into a course the
--    student never bought (PATCH lesson_id → fabricated completion). The
--    app's toggle is insert (mark) / delete (unmark), so UPDATE simply goes
--    away, privileges included. Frontend (fase 7): never .update() this table.
-- 2. The blanket storage SELECT policy let ANON *list* bucket contents, and
--    object paths are '{uid}/…' — an enumeration of every user's auth UID.
--    Public buckets already serve known URLs at /object/public/* without any
--    SELECT policy, so listing shrinks to: your own folder, or admin.
-- 3/4. Index hygiene: drop three duplicates of PK/unique prefixes, add the
--    FK indexes real flows hit (cascade deletes, webhook lookups).
-- ============================================================================

-- (1) lesson_progress: completion is insert/delete only
drop policy if exists progress_update on public.lesson_progress;
revoke update on table public.lesson_progress from anon, authenticated;

-- (2) storage: no anonymous listing; owners list their own folder, admin all
drop policy if exists noid_public_read on storage.objects;

drop policy if exists noid_own_files_read on storage.objects;
create policy noid_own_files_read on storage.objects
  for select to authenticated
  using (
    bucket_id in ('course-covers', 'merch-images', 'avatars')
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

-- (3) redundant duplicates of PK/unique leading columns
drop index if exists public.idx_enrollments_user;
drop index if exists public.idx_progress_user;
drop index if exists public.idx_certificates_user;

-- (4) FK indexes for real access paths (lesson cascade deletes, bold-webhook
--     payment lookups, certificate queries, stock joins)
create index if not exists idx_progress_lesson      on public.lesson_progress (lesson_id);
create index if not exists idx_orders_payment       on public.orders (payment_id);
create index if not exists idx_certificates_course  on public.certificates (course_id);
create index if not exists idx_order_items_variant  on public.order_items (variant_id);
create index if not exists idx_enrollments_payment  on public.enrollments (payment_id);
