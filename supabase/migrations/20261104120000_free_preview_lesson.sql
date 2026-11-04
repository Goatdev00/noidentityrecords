-- ============================================================================
-- NO.ID RECORDS — free preview lesson
--
-- The FIRST lesson of every published course is free for everyone (anon
-- included): it works as the course's invitation / trailer. Teachers name it
-- whatever they want, so "first" is positional: lowest module position, then
-- lowest lesson position, with created_at/id as deterministic tie-breakers.
-- Every other lesson_content row stays locked behind an enrollment.
-- ============================================================================

-- Id of the free lesson of a course. SECURITY DEFINER so it can resolve the
-- order across modules/lessons regardless of the caller's RLS; it only ever
-- reveals a lesson id, never content, and nothing for unpublished courses.
create or replace function public.preview_lesson_id(p_course_id uuid)
returns uuid
language sql stable security definer
set search_path = public
as $$
  select l.id
  from courses c
  join modules m on m.course_id = c.id
  join lessons l on l.module_id = m.id
  where c.id = p_course_id
    and c.published
  order by m.position, m.created_at, m.id, l.position, l.created_at, l.id
  limit 1;
$$;

grant execute on function public.preview_lesson_id(uuid) to anon, authenticated;

-- lesson_content select: previous rules (admin / owning teacher / enrolled)
-- plus the course's free preview lesson.
drop policy if exists lesson_content_select on public.lesson_content;
create policy lesson_content_select on public.lesson_content
  for select using (
    public.is_admin()
    or exists (
      select 1
      from public.lessons l
      join public.modules m on m.id = l.module_id
      join public.courses c on c.id = m.course_id
      where l.id = lesson_content.lesson_id
        and (
          c.teacher_id = auth.uid()
          or exists (
            select 1 from public.enrollments e
            where e.course_id = c.id and e.user_id = auth.uid()
          )
          or public.preview_lesson_id(c.id) = l.id
        )
    )
  );

notify pgrst, 'reload schema';
