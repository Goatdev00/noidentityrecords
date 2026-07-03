-- ============================================================================
-- NO.ID RECORDS — freeze certified identity (fase 8 review fix)
--
-- The PDF freezes the student/teacher/course names at issue time, but
-- verify_certificate joined LIVE profile rows — so clearing a display_name
-- (or a teacher rename) made the public verification diverge from the PDF.
-- Store the names on the certificate and verify against those, falling back
-- to the live join for any legacy row.
-- ============================================================================

alter table public.certificates
  add column if not exists student_name text,
  add column if not exists teacher_name text,
  add column if not exists course_title text;

create or replace function public.verify_certificate(p_code text)
returns table (
  student_name text,
  course_title text,
  teacher_name text,
  issued_at    timestamptz
)
language sql stable security definer
set search_path = public
as $$
  select
    coalesce(ct.student_name, p.display_name),
    coalesce(ct.course_title, c.title),
    coalesce(ct.teacher_name, t.display_name),
    ct.issued_at
  from certificates ct
  join profiles p on p.id = ct.user_id
  join courses  c on c.id = ct.course_id
  join profiles t on t.id = c.teacher_id
  where ct.code = p_code;
$$;

grant execute on function public.verify_certificate(text) to anon, authenticated;

notify pgrst, 'reload schema';
