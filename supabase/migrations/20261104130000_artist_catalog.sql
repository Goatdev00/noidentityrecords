-- ============================================================================
-- NO.IDENTITY RECORDS — artist catalog (/artistas)
--
-- `artists` grows from a dashboard-only grid into a self-service catalog of
-- everyone who has done something with the label:
--   · seeded from the label's SoundCloud (podcast/resident sessions, specials,
--     NOID releases and remixes) — unclaimed profiles (user_id null)
--   · any logged-in user can CREATE their own profile (starts 'pending' until
--     the label approves it) or REQUEST to link an existing unclaimed one
--     (artist_claims → reviewed by admin/super via review_artist_claim)
--   · owners edit their profile (photo, bio, city, links, SoundCloud tracks,
--     CV/portfolio PDFs); the guard trigger keeps ownership, status and slug
--     out of their reach
-- ============================================================================

-- ── columns ──────────────────────────────────────────────────────────────────
alter table public.artists
  add column if not exists slug       text,
  add column if not exists user_id    uuid references public.profiles (id) on delete set null,
  add column if not exists city       text,
  add column if not exists bio        text,
  -- [{ "url": "https://soundcloud.com/…", "title": "…" }]
  add column if not exists tracks     jsonb not null default '[]'::jsonb,
  -- [{ "label": "Hoja de vida", "url": "https://…/artists/{uid}/….pdf" }]
  add column if not exists documents  jsonb not null default '[]'::jsonb,
  add column if not exists status     text not null default 'approved',
  add column if not exists updated_at timestamptz not null default now();

alter table public.artists drop constraint if exists artists_status_check;
alter table public.artists
  add constraint artists_status_check check (status in ('pending', 'approved', 'hidden'));

-- `active` is superseded by `status` (approved = visible, hidden = taken down)
drop policy if exists artists_select on public.artists;
drop policy if exists artists_write on public.artists;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'artists' and column_name = 'active'
  ) then
    execute $q$update public.artists
               set status = case when active then 'approved' else 'hidden' end$q$;
  end if;
end $$;
alter table public.artists drop column if exists active;

-- ── slugs (/artistas/:slug) ──────────────────────────────────────────────────
create or replace function public.artist_slug_base(p_name text)
returns text
language sql immutable
as $$
  select coalesce(
    nullif(
      left(
        trim(both '-' from regexp_replace(
          translate(
            replace(replace(lower(coalesce(p_name, '')), 'æ', 'ae'), 'œ', 'oe'),
            'áàäâãåéèëêēíìïîóòöôõøúùüûñç',
            'aaaaaaeeeeeiiiioooooouuuunc'
          ),
          '[^a-z0-9]+', '-', 'g'
        )),
        60
      ),
      ''
    ),
    'artista'
  );
$$;

-- SECURITY DEFINER: must see every row (pending/hidden too) to avoid clashes
create or replace function public.artist_unique_slug(p_name text, p_self uuid default null)
returns text
language plpgsql stable security definer
set search_path = public
as $$
declare
  base text := public.artist_slug_base(p_name);
  cand text := base;
  n    int  := 1;
begin
  while exists (select 1 from artists where slug = cand and id is distinct from p_self) loop
    n := n + 1;
    cand := base || '-' || n;
  end loop;
  return cand;
end;
$$;

do $$
declare r record;
begin
  for r in select id, name from public.artists where slug is null loop
    update public.artists set slug = public.artist_unique_slug(r.name, r.id) where id = r.id;
  end loop;
end $$;

alter table public.artists alter column slug set not null;
create unique index if not exists artists_slug_key on public.artists (slug);
-- one artist profile per account
create unique index if not exists artists_user_id_key on public.artists (user_id);
create index if not exists idx_artists_status_name on public.artists (status, name);

-- ── guard: validation for everyone, field locks for non-admins ──────────────
-- NOT security definer on purpose: current_user tells API callers (anon /
-- authenticated) apart from privileged contexts (migrations, service role,
-- review_artist_claim which runs as the owner).
create or replace function public.artists_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  privileged boolean := public.is_admin() or current_user not in ('anon', 'authenticated');
  e jsonb;
begin
  new.name     := btrim(coalesce(new.name, ''));
  new.subtitle := nullif(btrim(new.subtitle), '');
  new.city     := nullif(btrim(new.city), '');
  new.bio      := nullif(btrim(new.bio), '');

  if char_length(new.name) not between 1 and 80 then
    raise exception 'artist name must be 1-80 characters' using errcode = '22023';
  end if;
  if char_length(coalesce(new.subtitle, '')) > 80
     or char_length(coalesce(new.city, '')) > 60
     or char_length(coalesce(new.bio, '')) > 4000 then
    raise exception 'artist text field too long' using errcode = '22023';
  end if;
  if new.image_url is not null and new.image_url !~ '^https://' then
    raise exception 'image_url must be https' using errcode = '22023';
  end if;

  -- links / documents render as hrefs: http(s) only (blocks javascript: etc.)
  if jsonb_typeof(new.links) <> 'array' or jsonb_array_length(new.links) > 12 then
    raise exception 'links must be an array of at most 12' using errcode = '22023';
  end if;
  for e in select * from jsonb_array_elements(new.links) loop
    if jsonb_typeof(e) <> 'object'
       or coalesce(e ->> 'url', '') !~ '^https?://[^\s]+$'
       or char_length(coalesce(e ->> 'label', '')) not between 1 and 40 then
      raise exception 'invalid link' using errcode = '22023';
    end if;
  end loop;

  if jsonb_typeof(new.documents) <> 'array' or jsonb_array_length(new.documents) > 6 then
    raise exception 'documents must be an array of at most 6' using errcode = '22023';
  end if;
  for e in select * from jsonb_array_elements(new.documents) loop
    if jsonb_typeof(e) <> 'object'
       or coalesce(e ->> 'url', '') !~ '^https://[^\s]+$'
       or char_length(coalesce(e ->> 'label', '')) not between 1 and 40 then
      raise exception 'invalid document' using errcode = '22023';
    end if;
  end loop;

  -- tracks are embedded through the SoundCloud widget: soundcloud URLs only
  if jsonb_typeof(new.tracks) <> 'array' or jsonb_array_length(new.tracks) > 8 then
    raise exception 'tracks must be an array of at most 8' using errcode = '22023';
  end if;
  for e in select * from jsonb_array_elements(new.tracks) loop
    if jsonb_typeof(e) <> 'object'
       or coalesce(e ->> 'url', '') !~ '^https://(www\.|m\.|on\.)?soundcloud\.com/[^\s]+$'
       or char_length(coalesce(e ->> 'title', '')) > 160 then
      raise exception 'invalid track' using errcode = '22023';
    end if;
  end loop;

  if tg_op = 'INSERT' then
    if not privileged then
      -- self-service: always yours, always pending review, slug from the name
      new.user_id  := auth.uid();
      new.status   := 'pending';
      new.position := 0;
      new.slug     := null;
    end if;
    if new.slug is null or btrim(new.slug) = '' then
      new.slug := public.artist_unique_slug(new.name);
    end if;
  else
    if not privileged then
      new.user_id    := old.user_id;
      new.status     := old.status;
      new.slug       := old.slug;
      new.position   := old.position;
      new.created_at := old.created_at;
    end if;
    new.updated_at := now();
  end if;

  if new.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'invalid slug' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_artists_guard on public.artists;
create trigger trg_artists_guard
  before insert or update on public.artists
  for each row execute function public.artists_guard();

-- ── RLS: artists ─────────────────────────────────────────────────────────────
-- public sees approved; owners see their own (pending/hidden too); admin all
create policy artists_select on public.artists
  for select using (
    status = 'approved' or user_id = auth.uid() or public.is_admin()
  );

-- the guard forces user_id = auth.uid() for non-admins before this check
drop policy if exists artists_insert on public.artists;
create policy artists_insert on public.artists
  for insert to authenticated
  with check (public.is_admin() or user_id = auth.uid());

drop policy if exists artists_update on public.artists;
create policy artists_update on public.artists
  for update to authenticated
  using (public.is_admin() or user_id = auth.uid())
  with check (public.is_admin() or user_id = auth.uid());

-- deleting a catalog entry is the label's call, never the owner's
drop policy if exists artists_delete on public.artists;
create policy artists_delete on public.artists
  for delete to authenticated
  using (public.is_admin());

-- ── artist_claims: "this profile is me" requests ─────────────────────────────
create table if not exists public.artist_claims (
  id          uuid primary key default gen_random_uuid(),
  artist_id   uuid not null references public.artists (id) on delete cascade,
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  message     text check (message is null or char_length(message) <= 1000),
  status      text not null default 'pending'
              check (status in ('pending', 'approved', 'rejected')),
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.artist_claims enable row level security;

-- one open request per account at a time (anti-spam)
create unique index if not exists artist_claims_one_pending
  on public.artist_claims (user_id) where status = 'pending';
create index if not exists idx_artist_claims_artist on public.artist_claims (artist_id);

drop policy if exists artist_claims_select on public.artist_claims;
create policy artist_claims_select on public.artist_claims
  for select using (user_id = auth.uid() or public.is_admin());

-- only for an approved, unclaimed profile, and only if you own none yet
drop policy if exists artist_claims_insert on public.artist_claims;
create policy artist_claims_insert on public.artist_claims
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and reviewed_at is null
    and exists (
      select 1 from public.artists a
      where a.id = artist_claims.artist_id
        and a.user_id is null
        and a.status = 'approved'
    )
    and not exists (select 1 from public.artists a where a.user_id = auth.uid())
  );

-- withdraw your own open request; admin can clean up anything
drop policy if exists artist_claims_delete on public.artist_claims;
create policy artist_claims_delete on public.artist_claims
  for delete to authenticated
  using ((user_id = auth.uid() and status = 'pending') or public.is_admin());

-- no UPDATE path for clients: reviews go through review_artist_claim()
revoke update on table public.artist_claims from anon, authenticated;

-- Approve = hand the profile to the requester (atomically, and only if it is
-- still unclaimed and they own nothing else); reject = close the request.
create or replace function public.review_artist_claim(p_claim_id uuid, p_approve boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  c artist_claims%rowtype;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into c from artist_claims where id = p_claim_id for update;
  if not found then
    raise exception 'claim not found' using errcode = 'P0002';
  end if;
  if c.status <> 'pending' then
    raise exception 'claim already reviewed' using errcode = '22023';
  end if;

  if p_approve then
    if exists (select 1 from artists where user_id = c.user_id) then
      raise exception 'user already owns an artist profile' using errcode = '23505';
    end if;
    update artists set user_id = c.user_id where id = c.artist_id and user_id is null;
    if not found then
      raise exception 'artist already claimed' using errcode = '23505';
    end if;
    update artist_claims set status = 'approved', reviewed_at = now() where id = c.id;
    -- the profile has an owner now: close competing requests
    update artist_claims set status = 'rejected', reviewed_at = now()
    where artist_id = c.artist_id and status = 'pending' and id <> c.id;
  else
    update artist_claims set status = 'rejected', reviewed_at = now() where id = c.id;
  end if;
end;
$$;

revoke execute on function public.review_artist_claim(uuid, boolean) from public, anon;
grant execute on function public.review_artist_claim(uuid, boolean) to authenticated;

-- Pending requests with the requester's email (lives in auth.users) so the
-- label can verify who is asking. Admin/super only.
create or replace function public.artist_claims_admin()
returns table (
  id           uuid,
  artist_id    uuid,
  artist_name  text,
  artist_slug  text,
  artist_image text,
  user_id      uuid,
  display_name text,
  email        text,
  message      text,
  created_at   timestamptz
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select c.id, c.artist_id, a.name, a.slug, a.image_url,
           c.user_id, p.display_name, u.email::text, c.message, c.created_at
    from artist_claims c
    join artists a on a.id = c.artist_id
    left join profiles p on p.id = c.user_id
    left join auth.users u on u.id = c.user_id
    where c.status = 'pending'
    order by c.created_at;
end;
$$;

revoke execute on function public.artist_claims_admin() from public, anon;
grant execute on function public.artist_claims_admin() to authenticated;

-- ── storage: artists bucket (photos + CV/portfolio PDFs) ─────────────────────
-- Public read by URL; each user writes only under artists/{their uid}/.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'artists', 'artists', true, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists noid_artists_read on storage.objects;
create policy noid_artists_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'artists'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

drop policy if exists noid_artists_insert on storage.objects;
create policy noid_artists_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'artists'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists noid_artists_update on storage.objects;
create policy noid_artists_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'artists'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'artists'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists noid_artists_delete on storage.objects;
create policy noid_artists_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'artists'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- ── seed: artists from the label's SoundCloud (soundcloud.com/noidcol) ──────
-- Names from podcast/resident sessions, specials, NOID releases and remixes
-- (premieres of other labels' releases are excluded). Photos: the artist's
-- own SoundCloud avatar when their profile could be verified, otherwise the
-- artwork of their No.ID session (or the cover of their single-artist EP).
-- Idempotent: an existing slug is never overwritten.
insert into public.artists (slug, name, subtitle, image_url, links, tracks)
values
  ('333', '333', 'Artista del sello', null, '[]'::jsonb, '[{"title":"333 - Dhesa (Original Mix) [NOIDVA1]","url":"https://soundcloud.com/noidcol/01-noidva1-333-wav-dhesa"}]'::jsonb),
  ('440-khz', '440 Khz', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-zdjxze1o4oL4CkGC-23rl7Q-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: 440 Khz","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-440-khz"}]'::jsonb),
  ('9-8-r-p-m', '9 8 r p m', 'Artista del sello', 'https://i1.sndcdn.com/avatars-0y1eZcLhUkxeGkaF-fMX8Pg-t500x500.jpg', '[{"label":"SoundCloud","url":"https://soundcloud.com/98-0111010"}]'::jsonb, '[{"title":"9 8 r p m - Revuelto de Emociones (Asmodeo Remix)","url":"https://soundcloud.com/noidcol/9-8-r-p-m-revuelto-de-emociones-asmodeo-remix-technobogota"}]'::jsonb),
  ('a373', 'A373', 'Artista del sello', 'https://i1.sndcdn.com/avatars-yyvozSMLzDcUWSRz-c5owyg-t500x500.jpg', '[{"label":"SoundCloud","url":"https://soundcloud.com/a373"}]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: A373","url":"https://soundcloud.com/noidcol/a373-noid-podcast"},{"title":"A373 - Junglar Noid (Original Mix) [NOIDVA1]","url":"https://soundcloud.com/noidcol/a373-junglar-noid"}]'::jsonb),
  ('aaradia', 'Aaradia', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-clq1N3KKC2kDkuQR-ramYUg-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Aaradia","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-aaradia"}]'::jsonb),
  ('acro', 'ACRO', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-Uw4URSVXpKWGxM9n-Yv94og-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: ACRO","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-acro"}]'::jsonb),
  ('acussia', 'Acussia', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-6hnY3r1lcKujy6rY-4WbijA-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Acussia","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-acussia"}]'::jsonb),
  ('aeteris', 'ÆTERIS', 'Artista del sello', null, '[]'::jsonb, '[]'::jsonb),
  ('alberto-casas', 'Alberto Casas', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-lyafChI6ssIdFzTw-hPiAuw-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Alberto Casas","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-alberto-casas"}]'::jsonb),
  ('alehe4rt', 'ALEHE4RT', 'Podcast Sessions', 'https://i1.sndcdn.com/avatars-0SlPLR57zA4e8Tlg-UGizCg-t500x500.jpg', '[{"label":"SoundCloud","url":"https://soundcloud.com/alehe4rt"}]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: ALEHE4RT","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-alehe4rt"}]'::jsonb),
  ('aleja-mora', 'Aleja Mora', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-7wb68Umq9AGc86MU-hnliMg-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Aleja Mora","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-aleja-mora"}]'::jsonb),
  ('aleja-mtz', 'Aleja MTZ', 'Podcast Sessions', 'https://i1.sndcdn.com/avatars-ER3LoKlSr4DALkyd-33WyFQ-t500x500.jpg', '[{"label":"SoundCloud","url":"https://soundcloud.com/alejamartinezz"}]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Aleja MTZ","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-alejamtz"}]'::jsonb),
  ('alex-cordova', 'Alex Cordova', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-6w4BXiydOVzoAwzd-azmzHw-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Alex Cordova","url":"https://soundcloud.com/noidcol/no-id-podcast-sessions-alex"},{"title":"No.ID PODCAST SESSIONS: Alex Cordova","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-alex-cordova"}]'::jsonb),
  ('alex-jockey', 'Alex Jockey', 'Artista del sello', 'https://i1.sndcdn.com/avatars-rWKrYYgfDRK3hl0K-fL5ZrA-t500x500.jpg', '[{"label":"SoundCloud","url":"https://soundcloud.com/alexjockey"}]'::jsonb, '[{"title":"Alex Jockey, EL MAMU - Escarpado [NOID10]","url":"https://soundcloud.com/noidcol/alex-jockey-el-mamu-escarpado"}]'::jsonb),
  ('alighieri', 'ALIGHIERI', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-gJxLvwRzfcLOqTgT-y3Uq4g-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: ALIGHIERI","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-alighieri"}]'::jsonb),
  ('alx-f', 'ALX.F', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-bIW2xkzheGx5mjko-Uzocyw-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: ALX.F","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-alxf"}]'::jsonb),
  ('amar-durga', 'AMAR DURGA', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-m0QQVRJDcPjYyxBD-aex3rw-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: AMAR DURGA","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-amar-durga"}]'::jsonb),
  ('andrad', 'Andrad', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-ETcG4yvMbOl8DREp-I2KIcg-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Andrad","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-andrad"}]'::jsonb),
  ('artyem', 'Artyem', 'Artista del sello', 'https://i1.sndcdn.com/avatars-sOmCnAkBNp60XGgw-3J6YSw-t500x500.jpg', '[{"label":"SoundCloud","url":"https://soundcloud.com/artyem-000_666"}]'::jsonb, '[{"title":"Tav Shvi - No.ID (Artyem Remix) [NOID02]","url":"https://soundcloud.com/noidcol/tav-shvi-no-id-artyem-remix"},{"title":"Artyem - Just The Same (Original Mix)[NOIDVA1]","url":"https://soundcloud.com/noidcol/artyem-just-the-same"}]'::jsonb),
  ('asmodeo', 'Asmodeo', 'Artista del sello', 'https://i1.sndcdn.com/avatars-fZc3wECRiusuNwDd-jcMhHg-t500x500.jpg', '[{"label":"SoundCloud","url":"https://soundcloud.com/asmodeo_oficial"}]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Asmodeo","url":"https://soundcloud.com/noidcol/podcast-sessions-asmodeo"},{"title":"9 8 r p m - Revuelto de Emociones (Asmodeo Remix)","url":"https://soundcloud.com/noidcol/9-8-r-p-m-revuelto-de-emociones-asmodeo-remix-technobogota"},{"title":"Tav Shvi - No.ID (Asmodeo Remix) [NOID02]","url":"https://soundcloud.com/noidcol/tav-shvi-no-id-asmodeo-remix"}]'::jsonb),
  ('asp', 'ASP', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-zz3cNU1tcPmfedzV-G6ylLw-t500x500.jpg', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: ASP","url":"https://soundcloud.com/noidcol/no-id-podcast-sessions-asp"}]'::jsonb),
  ('atman', 'Atman', 'No.ID Specials', 'https://i1.sndcdn.com/artworks-lUZ74FclbXXIQbqV-tzORfA-t500x500.png', '[]'::jsonb, '[{"title":"Atman B2B Nico Nova | No.ID Specials","url":"https://soundcloud.com/noidcol/atman-b2b-nico-nova-noid-specials"},{"title":"No.ID PODCAST SESSIONS: Atman","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-atman"}]'::jsonb),
  ('big-leo', 'Big Leo', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-8lZRCVCgRwrGwjzK-Nq0lng-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Big Leo","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-big-leo"}]'::jsonb),
  ('blackjack', 'Blackjack', 'Artista del sello', null, '[]'::jsonb, '[{"title":"Blackjack - Event Horizon [NOIDVA2]","url":"https://soundcloud.com/noidcol/blackjack-event-horizon-1"}]'::jsonb),
  ('breakld', 'BreakLD', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-JNqH4z2lnEMJHmgI-3AQblQ-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: BreakLD","url":"https://soundcloud.com/noidcol/noid-resident-sessions-breakld"}]'::jsonb),
  ('buster', 'Buster', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-UJycX1r0CzmzN2Dm-X9Rf9A-t500x500.jpg', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Buster","url":"https://soundcloud.com/noidcol/no-id-podcast-sessions-buster"}]'::jsonb),
  ('caotical-disordah', 'Caotical Disordah', 'Artista del sello', 'https://i1.sndcdn.com/artworks-T7griIQBheQz4nm1-BUoUcA-t500x500.png', '[]'::jsonb, '[{"title":"Caotical Disordah - Dejarlo Sangrar [NOID08]","url":"https://soundcloud.com/noidcol/caotical-disordah-dejarlo-sangrar"},{"title":"Caotical Disordah - EX01 [NOID08]","url":"https://soundcloud.com/noidcol/caotical-disordah-ex01"}]'::jsonb),
  ('cathie-v', 'Cathie V', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-TLFzcjMgkVdjmyIr-VDY6Hw-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Cathie V","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-cathie-v"}]'::jsonb),
  ('christian-nati', 'Christian Nati', 'Artista del sello', 'https://i1.sndcdn.com/artworks-uyGnl2Vexv2y0m3k-N9OBNA-t500x500.jpg', '[]'::jsonb, '[{"title":"Christian Nati - Frisson (Ever-L Remix) [NOID12]","url":"https://soundcloud.com/noidcol/christian-nati-frison-ever-l-remix-master-16bit-441khz-5"},{"title":"Christian Nati - Sin Realidad [NOID12]","url":"https://soundcloud.com/noidcol/christian-nati-sin-realidad-master-16bit-441khz-4"},{"title":"Christian Nati - Mecanismo de Defensa [NOID12]","url":"https://soundcloud.com/noidcol/christian-nati-mecanismo-de-defensa-master-16bit-441khz-2"},{"title":"Christian Nati - Frisson [NOID12]","url":"https://soundcloud.com/noidcol/christian-nati-frisson-master-16bit-441khz-1"}]'::jsonb),
  ('cybernea', 'Cybernea', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-BCFRsbmwCNWrUyyH-zCe7cA-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Cybernea","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-cybernea"}]'::jsonb),
  ('daboya', 'Daboya', 'Artista del sello', null, '[]'::jsonb, '[{"title":"Daboya - Zenn (Original Mix) [NOIDVA1]","url":"https://soundcloud.com/noidcol/daboya-zenn"}]'::jsonb),
  ('dani-albert', 'Dani Albert', 'Artista del sello', 'https://i1.sndcdn.com/avatars-hzdARjaYTmUynDbo-cs6Uqg-t500x500.jpg', '[{"label":"SoundCloud","url":"https://soundcloud.com/danialbert"}]'::jsonb, '[{"title":"Dani Albert - Desbalance Químico [NOIDVA2]","url":"https://soundcloud.com/noidcol/dani-albert-desbalance-quimico-2"}]'::jsonb),
  ('dave-l', 'Dave L', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-zJNhRTHClhgE97BY-tAEE1g-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Dave L","url":"https://soundcloud.com/noidcol/no-id-podcast-sessions-dave-l"}]'::jsonb),
  ('de-los-cielos', 'De Los Cielos', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-jsYqxvTvPijE0uOJ-uhqDyw-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: De Los Cielos","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-de-los-cielos"}]'::jsonb),
  ('despierte', 'Despierte', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-kdEyrfsxWCgIqLmd-dZEayw-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Despierte","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-despierte"}]'::jsonb),
  ('dharma', 'Dharma', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-xHzHwmzPiQs94rYN-JRQl6A-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Dharma","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-dharma"}]'::jsonb),
  ('diluet', 'Diluet', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-kcoqsOYnqc5qZ5Lw-Awe2IQ-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Diluet","url":"https://soundcloud.com/noidcol/no-id-podcast-sessions-diluet"}]'::jsonb),
  ('dionisus', 'Dionisus', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-gt8UfeAKzrxhxz9d-AQHHIA-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Dionisus","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-dionisus"}]'::jsonb),
  ('don-lola', 'DON LOLA', 'CEO · No.ID', 'https://i1.sndcdn.com/artworks-7a3UBCNjAXP8wj6l-hvCy3w-t500x500.jpg', '[]'::jsonb, '[{"title":"DON LOLA | No.ID Specials","url":"https://soundcloud.com/noidcol/don-lola-no-id-specials"}]'::jsonb),
  ('dunkelheit', 'Dunkelheit', 'Artista del sello', null, '[]'::jsonb, '[{"title":"Sinistermind, Dunkelheit, EL MAMU - triofantastico (Original Mix)","url":"https://soundcloud.com/noidcol/triofantastico"}]'::jsonb),
  ('el-mamu', 'EL MAMU', 'Residente · Cofundador', 'https://i1.sndcdn.com/avatars-0yCfekddTg3P6idi-Ppsknw-t500x500.jpg', '[{"label":"SoundCloud","url":"https://soundcloud.com/elmamu"}]'::jsonb, '[{"title":"No.ID RESIDENT SESSIONS: EL MAMU (LIVE)","url":"https://soundcloud.com/noidcol/noid-resident-sessions-el-mamu-live"},{"title":"Alex Jockey, EL MAMU - Escarpado [NOID10]","url":"https://soundcloud.com/noidcol/alex-jockey-el-mamu-escarpado"},{"title":"EL MAMU - Alien Code [NOIDVA2] *FREE DOWNLOAD*","url":"https://soundcloud.com/noidcol/el-mamu-alien-code-noidva2-free-download"},{"title":"Sinistermind, Dunkelheit, EL MAMU - triofantastico (Original Mix)","url":"https://soundcloud.com/noidcol/triofantastico"}]'::jsonb),
  ('eptanaxis', 'EPTANAXIS', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-pxN9949zPjWHPrmN-JIB90g-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: EPTANAXIS","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-eptanaxis"}]'::jsonb),
  ('ernie', 'Ernie', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-gWKrLSZCyuDnNGev-oRxovQ-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Ernie","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-ernie"}]'::jsonb),
  ('ever-l', 'Ever-L', 'Artista del sello', null, '[]'::jsonb, '[{"title":"Christian Nati - Frisson (Ever-L Remix) [NOID12]","url":"https://soundcloud.com/noidcol/christian-nati-frison-ever-l-remix-master-16bit-441khz-5"}]'::jsonb),
  ('felinah', 'Felinah', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-QnBJkRpiQ4QfiK75-ku9jUw-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Felinah","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-felinah"}]'::jsonb),
  ('felxhus', 'Felxhus', 'Artista del sello', 'https://i1.sndcdn.com/avatars-7e5HdWDxJVQXhqRJ-0VoXBw-t500x500.jpg', '[{"label":"SoundCloud","url":"https://soundcloud.com/felxhus"}]'::jsonb, '[{"title":"Felxhus - just leave it be [NOIDVA2]","url":"https://soundcloud.com/noidcol/felxhus-just-leave-it-be-3"}]'::jsonb),
  ('frvctl', 'Frvctl', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-PK95M6CF0ZzHkwvY-UWKRPw-t500x500.jpg', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Frvctl","url":"https://soundcloud.com/noidcol/no-id-podcast-sessions-frvctl"}]'::jsonb),
  ('i-am', 'I-AM', 'Residente No.ID', 'https://i1.sndcdn.com/artworks-uWyBVSYcqlnIzqDG-pwKMTA-t500x500.jpg', '[]'::jsonb, '[{"title":"I-AM | No.ID Specials","url":"https://soundcloud.com/noidcol/i-am-no-id-specials"},{"title":"I-AM | No.ID Specials","url":"https://soundcloud.com/noidcol/i-am-noid-specials"},{"title":"No.ID RESIDENT SESSIONS: I-AM","url":"https://soundcloud.com/noidcol/noid-resident-sessions-i-am"},{"title":"I-AM - Alma (魂) [NOIDVA2]","url":"https://soundcloud.com/noidcol/i-am-alma-hun-4"}]'::jsonb),
  ('immunity', 'Immunity', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-y20TCTMdLU8Q4IhQ-JwDyZQ-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Immunity","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-immunity"}]'::jsonb),
  ('ind-fx', 'IND.FX', 'Artista del sello', 'https://i1.sndcdn.com/avatars-yCRayXyTxRuXiZyF-BHE0aw-t500x500.jpg', '[{"label":"SoundCloud","url":"https://soundcloud.com/indfx"}]'::jsonb, '[{"title":"IND.FX - Aire (Original Mix) [NOIDVA1]","url":"https://soundcloud.com/noidcol/indfx-aire"},{"title":"Jeff Mills - The Bells (IND.FX BOOTLEG) [FREE DOWNLOAD]","url":"https://soundcloud.com/noidcol/jeff-mills-the-bells-indfx-bootleg-free-download"}]'::jsonb),
  ('individuo-sustituto', 'Individuo Sustituto', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-68XHNJyuI8PQZdQz-FCkyTQ-t500x500.jpg', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Individuo Sustituto","url":"https://soundcloud.com/noidcol/no-id-podcast-sessions-individuo-sustituto"}]'::jsonb),
  ('inhumar', 'INHUMAR', 'Podcast Sessions', 'https://i1.sndcdn.com/avatars-1T8PiSyqH8IYvVjB-yiZQPg-t500x500.jpg', '[{"label":"SoundCloud","url":"https://soundcloud.com/inhumardj"}]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: INHUMAR","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-inhumar"}]'::jsonb),
  ('jcee', 'Jcee', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-nysNz788Uo8mcltB-MENtyQ-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Jcee","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-jcee"}]'::jsonb),
  ('jerjesss', 'JERJESSS', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-GrD8JPFUQtLZ4klA-gIriqg-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: JERJESSS","url":"https://soundcloud.com/noidcol/no-id-podcast-sessions"}]'::jsonb),
  ('jeronimo', 'JERONIMØ', 'Artista del sello', null, '[]'::jsonb, '[{"title":"JERONIMØ - Fragments of Forgotten Light [NOIDVA2]","url":"https://soundcloud.com/noidcol/jeronimo-fragments-of-forgotten-light-5"}]'::jsonb),
  ('joshua', 'JØSHUA', 'Artista del sello', 'https://i1.sndcdn.com/artworks-0EPelbok1ASCL4JL-aeEgxg-t500x500.jpg', '[]'::jsonb, '[{"title":"JØSHUA - Percy [NOID11]","url":"https://soundcloud.com/noidcol/joshua-percy-mstr-3"}]'::jsonb),
  ('keev', 'Keev', 'Residente No.ID', 'https://i1.sndcdn.com/artworks-D8faZN6bxp5sh459-fyscuQ-t500x500.png', '[]'::jsonb, '[{"title":"No.ID RESIDENT SESSIONS: Keev","url":"https://soundcloud.com/noidcol/noid-resident-sessions-keev"}]'::jsonb),
  ('kid-kronoz', 'Kid Kronoz', 'Artista del sello', 'https://i1.sndcdn.com/avatars-6e309zte6ukklhEp-95KtHw-t500x500.jpg', '[{"label":"SoundCloud","url":"https://soundcloud.com/kidkronoz"}]'::jsonb, '[{"title":"Kid Kronoz - Magia (Original Mix)[NOIDVA1]","url":"https://soundcloud.com/noidcol/09-noidva1-magia-kid-kronoz"}]'::jsonb),
  ('kidoh', 'KIDOH', 'Podcast Sessions', 'https://i1.sndcdn.com/avatars-000006047548-ubatug-t500x500.jpg', '[{"label":"SoundCloud","url":"https://soundcloud.com/kidoh"}]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: KIDOH","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-kidoh"}]'::jsonb),
  ('kinx', 'KINX', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-vXrqB66XLDx6YhMM-YSyayw-t500x500.jpg', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: KINX (Sphinx B2B KICK)","url":"https://soundcloud.com/noidcol/no-id-podcast-sessions-kinx"}]'::jsonb),
  ('kromatik', 'Kromatik', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-akFTHEIufuw7m86Y-2FGYAg-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Kromatik","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-kromatik"}]'::jsonb),
  ('l0l4-hartz', 'L0L4 Hartz', 'Residente No.ID', 'https://i1.sndcdn.com/artworks-FBuJB75cNHbZrfWf-VSUqyQ-t500x500.png', '[]'::jsonb, '[{"title":"L0L4 Hartz | No.ID Specials","url":"https://soundcloud.com/noidcol/l0l4-hartz-noid-specials"},{"title":"No.ID RESIDENT SESSIONS: L0L4 Hartz","url":"https://soundcloud.com/noidcol/noid-resident-sessions-l0l4-hartz"}]'::jsonb),
  ('lanat', 'Lanat', 'Podcast Sessions', 'https://i1.sndcdn.com/avatars-jAc5ij4eyqFaXOWO-OqatVQ-t500x500.jpg', '[{"label":"SoundCloud","url":"https://soundcloud.com/lanatmusic"}]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Lanat","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-lanat"}]'::jsonb),
  ('lea-node', 'Lea Node', 'Artista del sello', 'https://i1.sndcdn.com/artworks-xfv6PIarDJmOMnhv-MAzNXg-t500x500.jpg', '[]'::jsonb, '[{"title":"Lea Node - Fade In Astral [NOID09]","url":"https://soundcloud.com/noidcol/lea-node-fade-in-astral-noid09"}]'::jsonb),
  ('lomgio', 'Lomgio', 'Artista del sello', 'https://i1.sndcdn.com/avatars-000871950724-65pv00-t500x500.jpg', '[{"label":"SoundCloud","url":"https://soundcloud.com/lomgio"}]'::jsonb, '[{"title":"Lomgio - Más Allá de la Piel [NOID13S1]","url":"https://soundcloud.com/noidcol/lomgio-mas-alla-de-la-piel"}]'::jsonb),
  ('luke', 'LUKE', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-VWm4zy1q0hQEmPyL-7dsC6A-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: LUKE","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-luke"}]'::jsonb),
  ('maria-fedorova', 'Maria Fedorova', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-IKXW8p3B4l7Sj0Lm-vB0FDQ-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Maria Fedorova","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-maria-fedorova"}]'::jsonb),
  ('maria-l', 'María L', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-fykcF2LePbARUgAZ-WgkwTw-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: María L","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-maria-l"}]'::jsonb),
  ('matt-cano', 'Matt Cano', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-hzr6QdYgakLlJo6y-UDapMA-t500x500.jpg', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Matt Cano","url":"https://soundcloud.com/noidcol/matt_cano"}]'::jsonb),
  ('mike-oceanx', 'Mike OceanX', 'No.ID Specials', 'https://i1.sndcdn.com/artworks-3fytyCayzna9zfHJ-oqbGCw-t500x500.png', '[]'::jsonb, '[{"title":"Mike OceanX | No.ID Specials","url":"https://soundcloud.com/noidcol/mike-oceanx-noid-specials"}]'::jsonb),
  ('monto', 'MØNTO', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-oonzoy91NKUfyzdg-dNCEpw-t500x500.jpg', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: MØNTO","url":"https://soundcloud.com/noidcol/no-id-podcast-sessions-monto"}]'::jsonb),
  ('mortx', 'Mørtx', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-IftTb1B5nWShjQ0c-UozcbQ-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Mørtx","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-mortx"}]'::jsonb),
  ('muzansore', 'Muzansore', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-gAHnJiEV3nbPVq8y-zPJB1g-t500x500.jpg', '[{"label":"SoundCloud","url":"https://soundcloud.com/muzansore"}]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Muzansore","url":"https://soundcloud.com/noidcol/no-id-podcast-sessions-1"}]'::jsonb),
  ('neath', 'Neath', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-yqBQJHwars0zMrFX-qUgHnA-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Neath","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-inhumar-neath-ii"}]'::jsonb),
  ('nicky', 'Nicky', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-fKk8DZCqIVEEH0qz-iWbDHw-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Nicky presents Club Hore","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-nicky"}]'::jsonb),
  ('nico-lehoiat', 'Nico Lehoiat', 'Artista del sello', 'https://i1.sndcdn.com/avatars-dQbelvnCw2z07hQP-yVU1qQ-t500x500.jpg', '[{"label":"SoundCloud","url":"https://soundcloud.com/nico_lehoiat"}]'::jsonb, '[{"title":"Nico Lehoiat - That Was! (Original Mix) [NOIDVA1]","url":"https://soundcloud.com/noidcol/nico-lehoiat-that-was"}]'::jsonb),
  ('nico-nova', 'Nico Nova', 'Artista del sello', 'https://i1.sndcdn.com/avatars-uzPGPwxLVOq2sOwV-5DfEpw-t500x500.jpg', '[{"label":"SoundCloud","url":"https://soundcloud.com/niconova"}]'::jsonb, '[{"title":"Atman B2B Nico Nova | No.ID Specials","url":"https://soundcloud.com/noidcol/atman-b2b-nico-nova-noid-specials"},{"title":"Nico Nova - Takeover (Original Mix) [NOIDVA1]","url":"https://soundcloud.com/noidcol/nico-nova-takeover"}]'::jsonb),
  ('nort', 'NORT', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-Lb2GbF15Z5f5pMBG-Wiy7aA-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: NORT","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-nort"}]'::jsonb),
  ('oba-ilu', 'OBA ILÚ', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-tVIyOHYtnYRtuhjb-WohzVA-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: OBA ILÚ","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-oba-ilu"}]'::jsonb),
  ('oke-fm', 'OKE.FM', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-MQgmX3McJSE17ZjS-ijODfg-t500x500.jpg', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: OKE.FM","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-oke-fm"}]'::jsonb),
  ('oneiromancer', 'Oneiromancer', 'Artista del sello', null, '[]'::jsonb, '[{"title":"Oneiromancer - Y2K38 [NOIDVA2]","url":"https://soundcloud.com/noidcol/oneiromancer-y2k38-6"}]'::jsonb),
  ('outrun', 'OUTRUN', 'Podcast Sessions', 'https://i1.sndcdn.com/avatars-2mwEhbrACtI8V4ey-Q1iv7A-t500x500.jpg', '[{"label":"SoundCloud","url":"https://soundcloud.com/outrun_aural"}]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: OUTRUN","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-outrun"}]'::jsonb),
  ('p-lob', 'P''lob', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-ikt9Sk2F9xgEDHnF-2JB0ew-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: P´lob","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-plob"}]'::jsonb),
  ('piache', 'PIACHE', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-W7dEyMHqkih5S6fL-IXL6YQ-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: PIACHE","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-piache"}]'::jsonb),
  ('post-gig', 'Post-gig', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-xpI2JZ4hB3Kks78d-dNVCCg-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Post-gig","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-postgig"}]'::jsonb),
  ('qv', 'QV', 'Artista del sello', null, '[]'::jsonb, '[{"title":"Ray Barretto - Que Viva la Música (QV TECHNO EDIT) [FREE DOWNLOAD]","url":"https://soundcloud.com/noidcol/qv-que-viva-la-musica-techno-edit-free-download"},{"title":"QV - Culebra (Original Mix) [NOIDVA1]","url":"https://soundcloud.com/noidcol/qv-culebra"}]'::jsonb),
  ('red-black', 'Red Black', 'Artista del sello', 'https://i1.sndcdn.com/avatars-JbfNElX73aGfpjMh-fUTfkA-t500x500.jpg', '[{"label":"SoundCloud","url":"https://soundcloud.com/red_black_music"}]'::jsonb, '[{"title":"Red Black - Cardenal Rojo (Original Mix) [NOIDVA1]","url":"https://soundcloud.com/noidcol/red-black-cardenal"}]'::jsonb),
  ('rodmor', 'Rodmor', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-idyOK43SsMgcdUPG-RjBG3A-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Rodmor","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-rodmor"}]'::jsonb),
  ('rozzo', 'ROZZØ', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-aEF0ywQ2mMq4ponY-TqII0A-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: ROZZØ","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-rozzo"}]'::jsonb),
  ('rtsn', 'RTSN', 'Artista del sello', null, '[]'::jsonb, '[{"title":"RTSN - Interplanetary Connection [NOIDVA2]","url":"https://soundcloud.com/noidcol/rtsn-interplanetary-connection-8"}]'::jsonb),
  ('sacro', 'Sacro', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-8u3Wgy013BSPFe9m-30pzUw-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Sacro","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-sacro"}]'::jsonb),
  ('samuel-bass', 'Samuel Bass', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-yV7dnEptd1rAS8E3-p6ALYg-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Samuel Bass","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-samuel-bass"}]'::jsonb),
  ('santiamen', 'SANTIAMÉN', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-lV2Kqt7IlFxqaV59-kmbsxA-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: SANTIAMÉN","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-santiamen"}]'::jsonb),
  ('sara-delirio', 'Sara Delirio', 'Artista del sello', 'https://i1.sndcdn.com/avatars-6lJG67ipABx60dXb-d2Sm5Q-t500x500.jpg', '[{"label":"SoundCloud","url":"https://soundcloud.com/saradelirio"}]'::jsonb, '[{"title":"Sara Delirio - Miedo Colectivo","url":"https://soundcloud.com/noidcol/sara-delirio-miedo-colectivo"},{"title":"Sara Delirio - Pedagogía del amor","url":"https://soundcloud.com/noidcol/sara-delirio-pedagogia-del-amor"},{"title":"Sara Delirio - A mi niña interior","url":"https://soundcloud.com/noidcol/sara-delirio-a-mi-nina-interior"}]'::jsonb),
  ('silva', 'Silva', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-5J2Axmra7VtH7Qys-mlYmHQ-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Silva","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-silva"}]'::jsonb),
  ('sinistermind', 'Sinistermind', 'Artista del sello', null, '[]'::jsonb, '[{"title":"Sinistermind, Dunkelheit, EL MAMU - triofantastico (Original Mix)","url":"https://soundcloud.com/noidcol/triofantastico"}]'::jsonb),
  ('slufgi', 'Slufgi', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-uHyIpcJO7r1xfqx5-fQmoTA-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Slufgi","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-slufgi"}]'::jsonb),
  ('sssooul', 'Sssooul', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-PFararEy0oaoefBZ-67weMg-t500x500.jpg', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Sssooul","url":"https://soundcloud.com/noidcol/no-id-podcast-sessions-sssooul"}]'::jsonb),
  ('stain-x', 'Stain X', 'Artista del sello', null, '[]'::jsonb, '[{"title":"Tav Shvi - No.ID (Stain X Remix) [NOID02]","url":"https://soundcloud.com/noidcol/tav-shvi-no-id-stain-x-remix"}]'::jsonb),
  ('t-a-m', 'T.A.M', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-Yq7L3q8KlrgqLULd-x3Tuzw-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: T.A.M","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-tam"}]'::jsonb),
  ('tarab', 'Tarab', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-vOLgsWqyYgLHkxy4-UuAZMg-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Tarab","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-tarab"}]'::jsonb),
  ('tav-shvi', 'Tav Shvi', 'Artista del sello', 'https://i1.sndcdn.com/artworks-FhOgCTcMI4vnei0h-ENe31w-t500x500.png', '[{"label":"SoundCloud","url":"https://soundcloud.com/tavshvi"}]'::jsonb, '[{"title":"Tav Shvi - Final del Camino [NOIDa1]","url":"https://soundcloud.com/noidcol/tav-shvi-final-del-camino"},{"title":"Tav Shvi - Prismacolor [NOIDa1]","url":"https://soundcloud.com/noidcol/tav-shvi-prismacolor"},{"title":"Tav Shvi - Latido de Gratitud [NOIDa1]","url":"https://soundcloud.com/noidcol/tav-shvi-latido-de-gratitud"},{"title":"Tav Shvi - Paralelo Necesario [NOIDa1]","url":"https://soundcloud.com/noidcol/tav-shvi-paralelo-necesario"}]'::jsonb),
  ('teo', 'Teo', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-yR44lQGnPGv1zv5Z-lQ8GfQ-t500x500.jpg', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Teo","url":"https://soundcloud.com/noidcol/teo"}]'::jsonb),
  ('tepe', 'Tepé', 'Podcast Sessions', 'https://i1.sndcdn.com/avatars-000005151840-f4rw9r-t500x500.jpg', '[{"label":"SoundCloud","url":"https://soundcloud.com/tepe"}]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: Tepé","url":"https://soundcloud.com/noidcol/no-id-podcast-sessions-tepe"}]'::jsonb),
  ('the-menade', 'The Menade', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-aEPfNudd17Il96Ya-yyya9Q-t500x500.jpg', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: The Menade","url":"https://soundcloud.com/noidcol/no-id-podcast-sessions-the"}]'::jsonb),
  ('val', 'VAL', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-7W3JmIXyu1fQpNyt-SEh9Yw-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: VAL","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-val"}]'::jsonb),
  ('warded', 'WARDED', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-wgp6hyiX2F1ETv3M-hOShmA-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: WARDED","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-warded"}]'::jsonb),
  ('yamit', 'YAMIT', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-6Md2yyjQb9XhgUEI-sQpKQA-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: YAMIT","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-yamit"}]'::jsonb),
  ('zepol', 'ZĒPØL', 'Podcast Sessions', 'https://i1.sndcdn.com/artworks-7FVxgHP7SG0eN6Sn-ykGcZQ-t500x500.png', '[]'::jsonb, '[{"title":"No.ID PODCAST SESSIONS: ZĒPØL","url":"https://soundcloud.com/noidcol/noid-podcast-sessions-zepol"}]'::jsonb),
  ('zewa', 'ZEWA', 'Artista del sello', 'https://i1.sndcdn.com/avatars-A8h79PPsvCDHghBj-QdV5oQ-t500x500.jpg', '[{"label":"SoundCloud","url":"https://soundcloud.com/zewamusic"}]'::jsonb, '[{"title":"ZEWA - Kontrol (Original Mix) [NOID03]","url":"https://soundcloud.com/noidcol/zewa-kontrol"},{"title":"ZEWA - Dancing Together (Original Mix) [NOID03]","url":"https://soundcloud.com/noidcol/zewa-dancing-together"},{"title":"ZEWA - Underflow (Original Mix) [NOIDVA1]","url":"https://soundcloud.com/noidcol/zewa-underflow"}]'::jsonb)
on conflict (slug) do nothing;

notify pgrst, 'reload schema';
