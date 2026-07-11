-- ============================================================================
-- NO.ID RECORDS — the super account gets admin powers everywhere
--
-- is_admin() now also returns true for is_super profiles, so every existing
-- RLS policy that grants admin (see all courses incl. drafts, edit, publish/
-- unpublish, delete, lesson content, storage covers, media_embeds, products…)
-- automatically applies to the label's super account. One definition, zero
-- policy rewrites.
-- ============================================================================

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and (role = 'admin' or is_super)
  );
$$;

notify pgrst, 'reload schema';
