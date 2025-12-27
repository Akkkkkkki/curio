-- =============================================================================
-- Curio Supabase Schema (Collections + Items)
-- =============================================================================
-- This script aligns the database with the current app data model.
-- If you previously created UUID IDs for collections/items, either drop/recreate
-- the tables or run the migration block below.
-- =============================================================================

-- Optional migration: convert UUID IDs to TEXT if legacy schema exists.
do $$
begin
  if to_regclass('public.collections') is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'collections'
        and column_name = 'id'
        and data_type = 'uuid'
    ) then
      if to_regclass('public.items') is not null then
        alter table public.items drop constraint if exists items_collection_id_fkey;
        if to_regclass('public.item_links') is not null then
          alter table public.item_links drop constraint if exists item_links_item_id_fkey;
        end if;
        alter table public.items drop constraint if exists items_pkey;
      end if;
      alter table public.collections drop constraint if exists collections_pkey;

      alter table public.collections
        alter column id type text using id::text;

      if to_regclass('public.items') is not null then
        alter table public.items
          alter column id type text using id::text,
          alter column collection_id type text using collection_id::text;
        alter table public.items add primary key (id);
        alter table public.items
          add constraint items_collection_id_fkey
          foreign key (collection_id)
          references public.collections(id)
          on delete cascade;
      end if;

      if to_regclass('public.item_links') is not null then
        alter table public.item_links
          alter column item_id type text using item_id::text;
        alter table public.item_links
          add constraint item_links_item_id_fkey
          foreign key (item_id)
          references public.items(id)
          on delete cascade;
      end if;

      alter table public.collections add primary key (id);
    end if;
  end if;
end $$;

-- =============================================================================
-- TABLES
-- =============================================================================

create table if not exists public.collections (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  template_id text not null,
  name text not null,
  icon text not null default '',
  settings jsonb not null default '{"displayFields": [], "badgeFields": []}'::jsonb,
  seed_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.items (
  id text primary key,
  collection_id text references public.collections(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  notes text,
  rating int not null default 0 check (rating >= 0 and rating <= 5),
  data jsonb not null default '{}'::jsonb,
  photo_path text,
  seed_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backfill missing columns on existing tables
alter table public.collections add column if not exists seed_key text;
alter table public.collections add column if not exists created_at timestamptz default now();
alter table public.collections add column if not exists updated_at timestamptz default now();
alter table public.collections alter column settings set default '{"displayFields": [], "badgeFields": []}'::jsonb;

alter table public.items add column if not exists seed_key text;
alter table public.items add column if not exists created_at timestamptz default now();
alter table public.items add column if not exists updated_at timestamptz default now();
alter table public.items alter column data set default '{}'::jsonb;

create index if not exists collections_user_id_idx on public.collections(user_id, created_at desc);
create index if not exists items_collection_id_idx on public.items(collection_id, created_at desc);
create index if not exists items_user_id_idx on public.items(user_id, created_at desc);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists collections_updated_at on public.collections;
create trigger collections_updated_at
before update on public.collections
for each row execute function public.set_updated_at();

drop trigger if exists items_updated_at on public.items;
create trigger items_updated_at
before update on public.items
for each row execute function public.set_updated_at();

create or replace function public.set_item_user_id_from_collection()
returns trigger as $$
declare owner uuid;
begin
  select c.user_id into owner
  from public.collections c
  where c.id = new.collection_id;

  if owner is null then
    raise exception 'Invalid collection_id';
  end if;

  new.user_id := owner;
  return new;
end;
$$ language plpgsql;

drop trigger if exists items_set_user_id on public.items;
create trigger items_set_user_id
before insert or update of collection_id on public.items
for each row execute function public.set_item_user_id_from_collection();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

alter table public.collections enable row level security;
alter table public.items enable row level security;

drop policy if exists "collections: select own" on public.collections;
create policy "collections: select own"
on public.collections for select
using (auth.uid() = user_id);

drop policy if exists "collections: insert own" on public.collections;
create policy "collections: insert own"
on public.collections for insert
with check (auth.uid() = user_id);

drop policy if exists "collections: update own" on public.collections;
create policy "collections: update own"
on public.collections for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "collections: delete own" on public.collections;
create policy "collections: delete own"
on public.collections for delete
using (auth.uid() = user_id);

drop policy if exists "items: select own" on public.items;
create policy "items: select own"
on public.items for select
using (auth.uid() = user_id);

drop policy if exists "items: insert own" on public.items;
create policy "items: insert own"
on public.items for insert
with check (
  exists (
    select 1 from public.collections c
    where c.id = collection_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "items: update own" on public.items;
create policy "items: update own"
on public.items for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "items: delete own" on public.items;
create policy "items: delete own"
on public.items for delete
using (auth.uid() = user_id);
