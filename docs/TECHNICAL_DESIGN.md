# Curio - Technical Design Document

## 1. System Architecture

- **Storage**: Supabase (PostgreSQL + Auth + Storage) as source of truth, IndexedDB as cache.
- **AI Inference**: Gemini-3-flash-preview via a server-side proxy (`server/geminiProxy.js`) to keep API keys off the client.

## 1.1 MVP UX Requirements (Time-to-Value)

To ensure users gain value within the first **5 minutes**, the system must support the following product behaviors:

- **Pre-login sample access:** The client must be able to read **Public Sample Collections** without requiring authentication. All other user content remains auth-gated.
- **Read-only semantics:** Public/sample collections and items are **read-only** for non-admin users; UI should consistently disable edit actions and show a persistent read-only indicator.
- **Capture resilience:** AI-powered analysis must not be a hard dependency for saving an item. The UX must allow a manual completion path while preserving user input.
- **Explicit save/sync feedback:** The UI should surface deterministic states such as “Saved”, “Synced”, and “Will sync / Retrying” so users can trust outcomes.

## 2. Identity & Sync Logic

Curio requires explicit login before access. Supabase auth is the only supported auth mode.

### Manual Local Import

If a user has existing IndexedDB data from older builds, they can trigger a manual import from the profile menu. Collections and items are upserted into Supabase, and assets are uploaded to Storage.

### Public Sample Collections

Curated sample collections live in the same tables and are flagged with `is_public = true`. All authenticated users can read them, but only admin users (profiles with `is_admin = true`) can edit or delete them. The client treats public collections as read-only for non-admins.

## 3. Asset Pipeline

- **Local Caching**: `getAsset` in `services/db.ts` always checks IndexedDB first.
- **Cloud Fallback**: If an asset is missing locally (e.g., on a new device), it is pulled from Supabase Storage and cached back into IndexedDB.
- **Normalization**: Private collections store images as Blobs (IndexedDB + Supabase Storage). Public sample collections use direct public URLs (e.g., `public/assets/...`) so every user can view them.

## 4. UI Synchronization Feedback

- **Status Indicator**: Signed in / signed out / cloud required states shown in the header.
- **Sync Debounce**: Metadata changes are debounced by 1500ms before hitting the network to prevent rate-limiting during rapid cataloging.
- **Cache Strategy**: Cloud data hydrates IndexedDB unless a local import is pending.

## 5. Security

- **RLS Policies**: Users can access their own rows. Public collections (`is_public = true`) are readable by all authenticated users, and admins can mutate them.
- **Storage Buckets**: Assets are stored in user-specific folders (`bucket/user_uuid/asset_id`) to ensure strict isolation.

## 6. Supabase Schema Notes

Timestamp-based conflict resolution (`VITE_SUPABASE_SYNC_TIMESTAMPS=true`) requires `created_at`/`updated_at` columns and an update trigger (included in `supabase/1_schema.sql`):

```
create extension if not exists moddatetime schema extensions;

alter table public.collections
  add column if not exists updated_at timestamptz default now();

alter table public.items
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at_collections on public.collections;
create trigger set_updated_at_collections
before update on public.collections
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_items on public.items;
create trigger set_updated_at_items
before update on public.items
for each row execute function public.set_updated_at();
```

Supabase scripts live in:

- `supabase/1_schema.sql`
- `supabase/2_storage.sql`
- `supabase/3_profiles.sql`

Key columns added for the public sample flow:

- `collections.is_public` (boolean)
- `profiles.is_admin` (boolean)

## 7. UI Utilities

- **Theming:** `theme.tsx` exposes a `ThemeProvider` / `useTheme` hook that persists the selected theme (Gallery, Vault, Atelier) in IndexedDB and is consumed by modals (`AddItemModal`, `AuthModal`, `CreateCollectionModal`, `FilterModal`) for consistent surfaces.
- **Feedback:** A lightweight `StatusToast` component in `App.tsx` surfaces save/sync/import success and error states so users see clear outcomes even during transient network issues.
