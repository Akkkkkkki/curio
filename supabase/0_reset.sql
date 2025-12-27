-- =============================================================================
-- Curio Supabase Reset (DESTRUCTIVE)
-- =============================================================================
-- Drops all Curio tables and functions. Use only when you are okay with
-- deleting all existing data.
-- =============================================================================

drop table if exists public.item_links cascade;
drop table if exists public.collection_fields cascade;
drop table if exists public.items cascade;
drop table if exists public.collections cascade;

drop function if exists public.set_item_user_id_from_collection cascade;
drop function if exists public.set_updated_at cascade;
