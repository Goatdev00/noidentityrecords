-- ============================================================================
-- NO.IDENTITY RECORDS — site restructure: label sections, events, artists
--
-- · media_embeds.section splits the Record Label page into BANDCAMP /
--   NO.ID SPECIALS / PODCAST (dashboard-manageable, backfilled from titles)
-- · events feeds the home banner ("próximo evento") and the /eventos page
-- · artists feeds the Nosotros → Artistas grid
-- ============================================================================

-- ── label sections ───────────────────────────────────────────────────────────
alter table public.media_embeds
  add column if not exists section text
  check (section in ('bandcamp', 'specials', 'podcast'));

update public.media_embeds set section =
  case
    when platform = 'bandcamp' then 'bandcamp'
    when title ilike 'podcast%' then 'podcast'
    else 'specials'
  end
where section is null;

-- ── events ───────────────────────────────────────────────────────────────────
create table if not exists public.events (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  subtitle   text,
  venue      text,
  event_date date not null,
  ticket_url text,
  image_url  text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;

drop policy if exists events_select on public.events;
create policy events_select on public.events
  for select using (active or public.is_admin());

drop policy if exists events_write on public.events;
create policy events_write on public.events
  for all using (public.is_admin()) with check (public.is_admin());

create index if not exists idx_events_date on public.events (event_date);

-- seed the next event (idempotent: only when the table is empty)
insert into public.events (title, event_date, ticket_url, active)
select 'LARS HUISMANN', '2026-08-07',
       'https://coccoa.xyz/lars-huismann-7-agosto/7429', true
where not exists (select 1 from public.events);

-- ── artists (Nosotros → Artistas) ────────────────────────────────────────────
create table if not exists public.artists (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  subtitle   text,
  image_url  text,
  links      jsonb not null default '[]'::jsonb,
  position   integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.artists enable row level security;

drop policy if exists artists_select on public.artists;
create policy artists_select on public.artists
  for select using (active or public.is_admin());

drop policy if exists artists_write on public.artists;
create policy artists_write on public.artists
  for all using (public.is_admin()) with check (public.is_admin());

-- ── brand default on campaigns ───────────────────────────────────────────────
alter table public.mailing_campaigns
  alter column from_name set default 'No.Identity Records';

notify pgrst, 'reload schema';
