-- ============================================================================
-- NO.ID RECORDS — mailing system (super-admin only)
--
-- A private mass-email tool for the label's own account. Everything here is
-- gated to profiles flagged is_super (only noid.colombia@gmail.com). The
-- actual sending happens in the send-campaign Edge Function (service role +
-- RESEND_API_KEY) — never from the client.
-- ============================================================================

-- ── super capability ────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists is_super boolean not null default false;

-- SECURITY DEFINER so RLS policies can call it without recursing into profiles
create or replace function public.is_super()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and is_super);
$$;

-- grant the flag to the label account
update public.profiles
set is_super = true
where id = (select id from auth.users where email = 'noid.colombia@gmail.com');

-- ── contacts (the persisted, de-duplicated address book) ─────────────────────
create table if not exists public.mailing_contacts (
  id         uuid primary key default gen_random_uuid(),
  -- lower-cased app-side; UNIQUE guarantees an address is never stored twice
  email      text not null unique,
  name       text,
  created_at timestamptz not null default now()
);

create table if not exists public.mailing_groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.mailing_group_members (
  group_id   uuid not null references public.mailing_groups (id) on delete cascade,
  contact_id uuid not null references public.mailing_contacts (id) on delete cascade,
  primary key (group_id, contact_id)
);

-- ── campaigns (a composed email + its target + send status) ──────────────────
create table if not exists public.mailing_campaigns (
  id               uuid primary key default gen_random_uuid(),
  subject          text not null,
  from_name        text not null default 'No.ID Records',
  from_email       text not null default 'info@noidentityrecords.com',
  reply_to         text,
  image_url        text,
  heading          text,
  tagline          text,
  body             text,           -- the message (blank-line separated paragraphs)
  cta_label        text,
  cta_url          text,
  target           text not null default 'all'
                   check (target in ('all', 'group', 'individual')),
  group_id         uuid references public.mailing_groups (id) on delete set null,
  individual_email text,
  status           text not null default 'draft'
                   check (status in ('draft', 'queued', 'sending', 'sent', 'failed')),
  recipients_count integer not null default 0,
  error            text,
  sent_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists trg_mailing_campaigns_updated_at on public.mailing_campaigns;
create trigger trg_mailing_campaigns_updated_at
  before update on public.mailing_campaigns
  for each row execute function public.set_updated_at();

create index if not exists idx_group_members_group   on public.mailing_group_members (group_id);
create index if not exists idx_group_members_contact on public.mailing_group_members (contact_id);
create index if not exists idx_campaigns_created      on public.mailing_campaigns (created_at desc);

-- ── RLS: only the super account touches anything mailing ─────────────────────
alter table public.mailing_contacts      enable row level security;
alter table public.mailing_groups        enable row level security;
alter table public.mailing_group_members enable row level security;
alter table public.mailing_campaigns     enable row level security;

drop policy if exists mailing_contacts_super on public.mailing_contacts;
create policy mailing_contacts_super on public.mailing_contacts
  for all using (public.is_super()) with check (public.is_super());

drop policy if exists mailing_groups_super on public.mailing_groups;
create policy mailing_groups_super on public.mailing_groups
  for all using (public.is_super()) with check (public.is_super());

drop policy if exists mailing_group_members_super on public.mailing_group_members;
create policy mailing_group_members_super on public.mailing_group_members
  for all using (public.is_super()) with check (public.is_super());

drop policy if exists mailing_campaigns_super on public.mailing_campaigns;
create policy mailing_campaigns_super on public.mailing_campaigns
  for all using (public.is_super()) with check (public.is_super());

-- ── storage: campaign images (public read, super uploads under mailing/) ─────
insert into storage.buckets (id, name, public)
values ('mailing', 'mailing', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists noid_mailing_read on storage.objects;
create policy noid_mailing_read on storage.objects
  for select using (bucket_id = 'mailing');

drop policy if exists noid_mailing_write on storage.objects;
create policy noid_mailing_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'mailing' and public.is_super());

drop policy if exists noid_mailing_update on storage.objects;
create policy noid_mailing_update on storage.objects
  for update to authenticated
  using (bucket_id = 'mailing' and public.is_super())
  with check (bucket_id = 'mailing' and public.is_super());

drop policy if exists noid_mailing_delete on storage.objects;
create policy noid_mailing_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'mailing' and public.is_super());

notify pgrst, 'reload schema';
