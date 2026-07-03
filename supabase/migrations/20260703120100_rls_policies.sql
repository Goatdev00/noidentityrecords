-- ============================================================================
-- NO.ID RECORDS — Row Level Security (fase 2)
--
-- THE security model. The frontend only ever holds the anon key, so every
-- guarantee lives here. Tables written exclusively by Edge Functions
-- (payments, enrollments, orders, order_items, certificates) simply have NO
-- write policies: the service role bypasses RLS, everyone else is denied.
--
-- Run after 20260703120000_initial_schema.sql.
-- ============================================================================

alter table public.profiles         enable row level security;
alter table public.courses          enable row level security;
alter table public.modules          enable row level security;
alter table public.lessons          enable row level security;
alter table public.lesson_content   enable row level security;
alter table public.payments         enable row level security;
alter table public.enrollments      enable row level security;
alter table public.lesson_progress  enable row level security;
alter table public.certificates     enable row level security;
alter table public.products         enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;
alter table public.media_embeds     enable row level security;

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------

-- Who can be seen: yourself always; teachers are public figures (the course
-- landing shows "maestro" name/avatar to everyone, so teacher profiles are
-- readable by anyone, logged in or not); admins see all. Student profiles
-- are never exposed to other users.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid()
    or role = 'teacher'
    or public.is_admin()
  );

-- You can only edit YOUR profile row…
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- …and even then, only these columns. `role` is deliberately NOT grantable:
-- privilege escalation via UPDATE profiles SET role='admin' is impossible
-- because the column privilege doesn't exist. Roles change only from the
-- Supabase dashboard (postgres/service role).
revoke insert, update, delete on table public.profiles from anon, authenticated;
grant  update (display_name, avatar_url) on table public.profiles to authenticated;
-- (INSERT stays revoked: rows are created by the on_auth_user_created trigger.)

-- ----------------------------------------------------------------------------
-- courses
-- ----------------------------------------------------------------------------

-- Catalog is public ONLY for published courses; drafts are visible to their
-- owner and admins. This is what keeps unpublished work private.
drop policy if exists courses_select on public.courses;
create policy courses_select on public.courses
  for select using (
    published
    or teacher_id = auth.uid()
    or public.is_admin()
  );

-- Only teachers/admins create courses, and a teacher can only create courses
-- owned by themselves (no planting courses on someone else's account).
drop policy if exists courses_insert on public.courses;
create policy courses_insert on public.courses
  for insert with check (
    (public.is_teacher_or_admin() and teacher_id = auth.uid())
    or public.is_admin()
  );

-- Owner or admin edits; WITH CHECK stops a teacher from reassigning the
-- course to another teacher_id they don't own.
drop policy if exists courses_update on public.courses;
create policy courses_update on public.courses
  for update
  using  (teacher_id = auth.uid() or public.is_admin())
  with check (teacher_id = auth.uid() or public.is_admin());

drop policy if exists courses_delete on public.courses;
create policy courses_delete on public.courses
  for delete using (teacher_id = auth.uid() or public.is_admin());

-- ----------------------------------------------------------------------------
-- modules / lessons — public temario of visible courses; writes follow the
-- parent course's ownership
-- ----------------------------------------------------------------------------

-- Visible whenever the parent course is visible (published, own, or admin).
drop policy if exists modules_select on public.modules;
create policy modules_select on public.modules
  for select using (
    exists (
      select 1 from public.courses c
      where c.id = modules.course_id
        and (c.published or c.teacher_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists modules_write on public.modules;
create policy modules_write on public.modules
  for all
  using (
    exists (
      select 1 from public.courses c
      where c.id = modules.course_id
        and (c.teacher_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.courses c
      where c.id = modules.course_id
        and (c.teacher_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists lessons_select on public.lessons;
create policy lessons_select on public.lessons
  for select using (
    exists (
      select 1
      from public.modules m
      join public.courses c on c.id = m.course_id
      where m.id = lessons.module_id
        and (c.published or c.teacher_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists lessons_write on public.lessons;
create policy lessons_write on public.lessons
  for all
  using (
    exists (
      select 1
      from public.modules m
      join public.courses c on c.id = m.course_id
      where m.id = lessons.module_id
        and (c.teacher_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1
      from public.modules m
      join public.courses c on c.id = m.course_id
      where m.id = lessons.module_id
        and (c.teacher_id = auth.uid() or public.is_admin())
    )
  );

-- ----------------------------------------------------------------------------
-- lesson_content — THE crown jewel. Video links must be unreadable without an
-- enrollment, even hitting the REST API directly with the anon key.
-- ----------------------------------------------------------------------------

-- Readable only if (a) you own an enrollment in the lesson's course, or
-- (b) you are the course's teacher, or (c) you are admin. Anonymous users and
-- non-enrolled students get zero rows — the temario stays public via
-- `lessons`, the URLs stay locked here.
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
        )
    )
  );

-- Only the owning teacher (or admin) writes lesson content.
drop policy if exists lesson_content_write on public.lesson_content;
create policy lesson_content_write on public.lesson_content
  for all
  using (
    public.is_admin()
    or exists (
      select 1
      from public.lessons l
      join public.modules m on m.id = l.module_id
      join public.courses c on c.id = m.course_id
      where l.id = lesson_content.lesson_id and c.teacher_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.lessons l
      join public.modules m on m.id = l.module_id
      join public.courses c on c.id = m.course_id
      where l.id = lesson_content.lesson_id and c.teacher_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- payments — written only by Edge Functions (service role bypasses RLS)
-- ----------------------------------------------------------------------------

-- You can check the status of YOUR payment (/pago/:orderId polls this);
-- admins see everything. No insert/update/delete policies exist on purpose:
-- amounts are computed server-side and status only changes via the Bold
-- webhook. Belt-and-braces: write privileges are revoked outright.
drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
  for select using (user_id = auth.uid() or public.is_admin());

revoke insert, update, delete on table public.payments from anon, authenticated;

-- ----------------------------------------------------------------------------
-- enrollments — INSERT únicamente vía Edge Function de pagos (service role)
-- ----------------------------------------------------------------------------

-- You see your enrollments; the course's teacher sees who enrolled in THEIR
-- course (panel stats); admin sees all. Nobody client-side can create one:
-- that would be granting yourself a paid course.
drop policy if exists enrollments_select on public.enrollments;
create policy enrollments_select on public.enrollments
  for select using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.courses c
      where c.id = enrollments.course_id and c.teacher_id = auth.uid()
    )
  );

revoke insert, update, delete on table public.enrollments from anon, authenticated;

-- ----------------------------------------------------------------------------
-- lesson_progress — the ONE table students write, and only inside courses
-- they are enrolled in
-- ----------------------------------------------------------------------------

drop policy if exists progress_select on public.lesson_progress;
create policy progress_select on public.lesson_progress
  for select using (user_id = auth.uid() or public.is_admin());

-- Marking a lesson complete requires: it's YOUR row AND you're enrolled in
-- the course that lesson belongs to. Stops progress spam on courses you
-- never bought (which would matter once certificates check 100%).
drop policy if exists progress_insert on public.lesson_progress;
create policy progress_insert on public.lesson_progress
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.lessons l
      join public.modules m on m.id = l.module_id
      join public.enrollments e on e.course_id = m.course_id
      where l.id = lesson_progress.lesson_id and e.user_id = auth.uid()
    )
  );

drop policy if exists progress_update on public.lesson_progress;
create policy progress_update on public.lesson_progress
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Un-marking a lesson (toggle) is allowed on your own rows.
drop policy if exists progress_delete on public.lesson_progress;
create policy progress_delete on public.lesson_progress
  for delete using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- certificates — issued only by the generate-certificate Edge Function
-- ----------------------------------------------------------------------------

-- You read your own certificates (profile page download); admin all.
-- PUBLIC verification does NOT open the table: /verificar/:code calls the
-- verify_certificate() RPC below, which exposes only the four public fields
-- of the single matching row.
drop policy if exists certificates_select on public.certificates;
create policy certificates_select on public.certificates
  for select using (user_id = auth.uid() or public.is_admin());

revoke insert, update, delete on table public.certificates from anon, authenticated;

-- Public, rate-limitable verification endpoint. SECURITY DEFINER: reads
-- across certificates/profiles/courses without opening those tables to anon.
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
    p.display_name,
    c.title,
    t.display_name,
    ct.issued_at
  from certificates ct
  join profiles p on p.id = ct.user_id
  join courses  c on c.id = ct.course_id
  join profiles t on t.id = c.teacher_id
  where ct.code = p_code;
$$;

grant execute on function public.verify_certificate(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- products / product_variants — public catalog, admin-managed (dashboard for
-- now; an admin CRUD UI may come later)
-- ----------------------------------------------------------------------------

drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select using (active or public.is_admin());

drop policy if exists products_write on public.products;
create policy products_write on public.products
  for all using (public.is_admin()) with check (public.is_admin());

-- Variants (sizes/stock) are visible when their product is; only admin writes.
-- Stock DECREMENTS happen in the payment webhook (service role).
drop policy if exists variants_select on public.product_variants;
create policy variants_select on public.product_variants
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.products p
      where p.id = product_variants.product_id and p.active
    )
  );

drop policy if exists variants_write on public.product_variants;
create policy variants_write on public.product_variants
  for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- orders / order_items — created and updated only by Edge Functions
-- ----------------------------------------------------------------------------

-- Your order history in /perfil; admin sees all. Creation goes through
-- create-payment (validates stock + computes totals server-side), updates
-- through the Bold webhook. No client writes, privileges revoked.
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select using (user_id = auth.uid() or public.is_admin());

revoke insert, update, delete on table public.orders from anon, authenticated;

drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );

revoke insert, update, delete on table public.order_items from anon, authenticated;

-- ----------------------------------------------------------------------------
-- media_embeds — feeds /musica without code changes
-- ----------------------------------------------------------------------------

-- Active embeds are public (anonymous visitors browse /musica); admin sees
-- and manages everything from the dashboard.
drop policy if exists media_embeds_select on public.media_embeds;
create policy media_embeds_select on public.media_embeds
  for select using (active or public.is_admin());

drop policy if exists media_embeds_write on public.media_embeds;
create policy media_embeds_write on public.media_embeds
  for all using (public.is_admin()) with check (public.is_admin());
