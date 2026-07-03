-- ============================================================================
-- NO.ID RECORDS — initial schema (fase 2)
-- Tables, helper functions, triggers and indexes. RLS lives in the next
-- migration (20260703120100_rls_policies.sql) so this file is pure DDL.
--
-- Run order matters: this file first.
-- ============================================================================

-- gen_random_uuid() ships with pgcrypto (enabled by default on Supabase)
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- helpers
-- ----------------------------------------------------------------------------

-- Keeps updated_at honest on every UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- profiles — 1:1 with auth.users, created automatically by trigger
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  role         text not null default 'student'
               check (role in ('student', 'teacher', 'admin')),
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Role checks used by RLS policies. SECURITY DEFINER so they read profiles
-- without re-entering profiles' own RLS (avoids infinite recursion), with a
-- pinned search_path so no one can shadow the table.
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_teacher_or_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role in ('teacher', 'admin')
  );
$$;

-- Auto-create the profile row on signup (role defaults to 'student';
-- teacher/admin are ONLY ever assigned by hand in the Supabase dashboard).
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- ACADEMIA
-- ----------------------------------------------------------------------------
create table if not exists public.courses (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references public.profiles (id),
  slug        text not null unique,
  title       text not null,
  subtitle    text,
  description text,
  -- COP has no decimals; Bold's minimum charge is 1.000 COP
  price_cop   integer not null check (price_cop >= 1000),
  cover_url   text,
  published   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_courses_updated_at on public.courses;
create trigger trg_courses_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

create table if not exists public.modules (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid not null references public.courses (id) on delete cascade,
  title      text not null,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id          uuid primary key default gen_random_uuid(),
  module_id   uuid not null references public.modules (id) on delete cascade,
  title       text not null,
  subtitle    text,
  description text,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Video links live APART from lessons on purpose: lessons metadata is public
-- (course landing shows the full temario) while lesson_content is only
-- readable with an enrollment. Never merge these tables.
create table if not exists public.lesson_content (
  lesson_id  uuid primary key references public.lessons (id) on delete cascade,
  video_url  text,
  -- [{ "label": "...", "url": "..." }]
  links      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_lesson_content_updated_at on public.lesson_content;
create trigger trg_lesson_content_updated_at
  before update on public.lesson_content
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- payments — shared by academia and merch. Rows are written ONLY by Edge
-- Functions with the service role; `reference` is Bold's order_id.
-- ----------------------------------------------------------------------------
create table if not exists public.payments (
  id         uuid primary key default gen_random_uuid(),
  provider   text not null default 'bold',
  reference  text not null unique,
  status     text not null default 'pending'
             check (status in ('pending', 'approved', 'rejected', 'voided', 'failed')),
  amount_cop integer not null check (amount_cop >= 0),
  user_id    uuid not null references public.profiles (id),
  kind       text not null check (kind in ('course', 'merch')),
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_payments_updated_at on public.payments;
create trigger trg_payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

create table if not exists public.enrollments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  course_id  uuid not null references public.courses (id),
  payment_id uuid references public.payments (id),
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create table if not exists public.lesson_progress (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  lesson_id    uuid not null references public.lessons (id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table if not exists public.certificates (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id),
  code      text not null unique,
  pdf_path  text not null,
  issued_at timestamptz not null default now(),
  unique (user_id, course_id)
);

-- ----------------------------------------------------------------------------
-- MERCH
-- ----------------------------------------------------------------------------
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  price_cop   integer not null check (price_cop >= 1000),
  images      text[] not null default '{}',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create table if not exists public.product_variants (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  size       text not null,
  stock      integer not null default 0 check (stock >= 0),
  unique (product_id, size)
);

create table if not exists public.orders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id),
  status     text not null default 'pending'
             check (status in ('pending', 'paid', 'shipped', 'cancelled')),
  total_cop  integer not null check (total_cop >= 0),
  -- { name, document, address, city, phone }
  shipping   jsonb not null default '{}'::jsonb,
  payment_id uuid references public.payments (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create table if not exists public.order_items (
  order_id       uuid not null references public.orders (id) on delete cascade,
  variant_id     uuid not null references public.product_variants (id),
  qty            integer not null check (qty > 0),
  unit_price_cop integer not null check (unit_price_cop >= 0),
  primary key (order_id, variant_id)
);

-- ----------------------------------------------------------------------------
-- MÚSICA
-- ----------------------------------------------------------------------------
create table if not exists public.media_embeds (
  id         uuid primary key default gen_random_uuid(),
  platform   text not null check (platform in ('bandcamp', 'soundcloud')),
  title      text not null,
  meta       text,
  embed_url  text not null,
  -- iframe height in px (Bandcamp's large player grows with the tracklist)
  height     integer not null default 654,
  position   integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- indexes for the access paths the app actually uses
-- ----------------------------------------------------------------------------
create index if not exists idx_courses_teacher        on public.courses (teacher_id);
create index if not exists idx_courses_published      on public.courses (published) where published;
create index if not exists idx_modules_course         on public.modules (course_id, position);
create index if not exists idx_lessons_module         on public.lessons (module_id, position);
create index if not exists idx_enrollments_user       on public.enrollments (user_id);
create index if not exists idx_enrollments_course     on public.enrollments (course_id);
create index if not exists idx_progress_user          on public.lesson_progress (user_id);
create index if not exists idx_certificates_user      on public.certificates (user_id);
create index if not exists idx_payments_user          on public.payments (user_id);
create index if not exists idx_variants_product       on public.product_variants (product_id);
create index if not exists idx_orders_user            on public.orders (user_id);
create index if not exists idx_media_embeds_active    on public.media_embeds (active, platform, position);
