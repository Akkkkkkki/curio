-- =============================================================================
-- Curio Supabase Storage (curio-assets bucket)
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('curio-assets', 'curio-assets', false)
on conflict do nothing;

-- NOTE: Supabase manages RLS for storage.objects. Do not attempt to alter it here.

drop policy if exists "curio-assets: select own" on storage.objects;
create policy "curio-assets: select own"
on storage.objects for select
using (
  bucket_id = 'curio-assets'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "curio-assets: insert own" on storage.objects;
create policy "curio-assets: insert own"
on storage.objects for insert
with check (
  bucket_id = 'curio-assets'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "curio-assets: update own" on storage.objects;
create policy "curio-assets: update own"
on storage.objects for update
using (
  bucket_id = 'curio-assets'
  and auth.uid()::text = split_part(name, '/', 1)
)
with check (
  bucket_id = 'curio-assets'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "curio-assets: delete own" on storage.objects;
create policy "curio-assets: delete own"
on storage.objects for delete
using (
  bucket_id = 'curio-assets'
  and auth.uid()::text = split_part(name, '/', 1)
);
