-- ============================================================================
-- NO.ID RECORDS — lesson_progress.user_id defaults to auth.uid() (fase 7)
--
-- The learner marks a lesson complete by inserting just { lesson_id }. Without
-- a default, user_id came in NULL and the progress_insert WITH CHECK
-- (user_id = auth.uid()) rejected it (403). Defaulting the column to the
-- caller's uid is the standard Supabase pattern and keeps the client payload
-- to the single column it actually knows.
-- ============================================================================

alter table public.lesson_progress
  alter column user_id set default auth.uid();
