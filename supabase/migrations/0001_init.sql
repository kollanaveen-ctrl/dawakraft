-- Dawakraft database setup. Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Every row belongs to the signed-in user (owner_id). Row-level security makes sure
-- each distributor can only ever see and change their own catalog and photos.

-- Company profile: one row per user.
create table if not exists public.companies (
  owner_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  name        text not null default '' check (char_length(name) <= 120),
  tagline     text not null default '' check (char_length(tagline) <= 160),
  phone       text not null default '' check (char_length(phone) <= 40),
  email       text not null default '' check (char_length(email) <= 160),
  address     text not null default '' check (char_length(address) <= 300),
  licence     text not null default '' check (char_length(licence) <= 200),
  brand_color text not null default '#0B7A63' check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  logo_path   text,
  updated_at  timestamptz not null default now()
);

-- Products in the catalog.
create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 200),
  composition  text not null default '' check (char_length(composition) <= 500),
  form         text not null default '' check (char_length(form) <= 60),
  pack_size    text not null default '' check (char_length(pack_size) <= 120),
  mrp          numeric(10, 2) check (mrp is null or mrp > 0),
  schedule     text not null default '' check (schedule in ('', 'None', 'H', 'H1', 'X', 'G')),
  manufacturer text not null default '' check (char_length(manufacturer) <= 200),
  marketed_by  text not null default '' check (char_length(marketed_by) <= 200),
  storage      text not null default '' check (char_length(storage) <= 200),
  category     text not null default 'Other' check (char_length(category) <= 60),
  scheme       text not null default '' check (char_length(scheme) <= 120),
  highlight    text not null default '' check (char_length(highlight) <= 60),
  template     text not null default 'clean' check (template in ('clean', 'band', 'spotlight')),
  image_path   text,
  example      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists products_owner_created_idx on public.products (owner_id, created_at desc);

alter table public.companies enable row level security;
alter table public.products enable row level security;

drop policy if exists "own company" on public.companies;
create policy "own company" on public.companies
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "own products" on public.products;
create policy "own products" on public.products
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- A log of AI calls, used to limit how often each user can call Claude (this keeps the bill in check).
-- Users can add and count their own entries but never edit or delete them.
create table if not exists public.ai_usage (
  id         bigint generated always as identity primary key,
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('read', 'sort')),
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_owner_kind_time_idx on public.ai_usage (owner_id, kind, created_at desc);
alter table public.ai_usage enable row level security;

drop policy if exists "own usage read" on public.ai_usage;
create policy "own usage read" on public.ai_usage
  for select to authenticated using (owner_id = (select auth.uid()));

drop policy if exists "own usage add" on public.ai_usage;
create policy "own usage add" on public.ai_usage
  for insert to authenticated with check (owner_id = (select auth.uid()));

-- Private photo storage. Files live under <user id>/..., and only that user can reach them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 5242880, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "own media read" on storage.objects;
create policy "own media read" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "own media write" on storage.objects;
create policy "own media write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "own media update" on storage.objects;
create policy "own media update" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "own media delete" on storage.objects;
create policy "own media delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
