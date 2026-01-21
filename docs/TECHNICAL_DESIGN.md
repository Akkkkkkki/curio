# Curio - Technical Design Document

## 1. System Architecture

- **Storage**: Supabase (PostgreSQL + Auth + Storage) as source of truth, IndexedDB as cache.
- **AI Inference**: Gemini-3-flash-preview via a server-side proxy (local dev: `server/geminiProxy.js`; deploy: same-origin `/api/*` via Vercel rewrites and/or `api/*` handlers) to keep API keys off the client.

## 1.1 MVP UX Requirements (Time-to-Value)

To ensure users gain value within the first **5 minutes**, the system must support the following product behaviors:

- **Pre-login sample access:** The client must be able to read **Public Sample Collections** without requiring authentication. All other user content remains auth-gated.
- **Read-only semantics:** Public/sample collections and items are **read-only** for non-admin users; UI should consistently disable edit actions and show a persistent read-only indicator.
- **Capture resilience:** AI-powered analysis must not be a hard dependency for saving an item. The UX must allow a manual completion path while preserving user input.
- **Explicit save/sync feedback:** The UI should surface deterministic states such as “Saved”, “Synced”, and “Will sync / Retrying” so users can trust outcomes.

## 2. Identity & Sync Logic

Curio uses Supabase Auth for user-owned data. Users can browse the Public Sample Gallery without signing in; authentication is required before creating/saving their own collections and items.

### Access gating (pre-login sample)

- The app supports a **sample-first** path: users can opt into browsing public/sample collections without being authenticated.
- If Supabase is configured, the client can fetch **public collections** even when `user` is null (cloud public read), and will fall back to local seeded sample collections if nothing is available.

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

### Explicit outcomes (“Saved / Synced / Will sync”)

- Writes update local state immediately and surface **Saved** feedback.
- Sync state is surfaced as:
  - `synced` → toast **Synced**
  - `offline` → toast **Will sync / retrying**
  - `error` → toast **Sync failed** (with retry action when online)
- Pending changes can be retried via a queued sync mechanism (see `docs/INDEXEDDB_RELIABILITY.md` for the deeper operational details).

### Sync status definitions & transitions (state diagrams)

Curio’s “status” UX has two layers:

- **Account / cloud availability (header)**: “Cloud Required” vs “Signed Out” vs “Signed In” (Supabase configuration + auth session).
- **Save / sync outcomes (toast)**: “Saved”, “Synced”, “Will sync / retrying”, “Sync failed …” (local persistence + cloud sync attempt results).

#### What “Saved / Synced / Will sync / Sync failed” mean

- **Saved**: local state updated and persisted to IndexedDB (success path is immediate).
- **Synced**: the most recent cloud upsert for that change succeeded.
- **Will sync / retrying**: the change is safely local, and will be retried later (offline or queued retry not yet successful).
- **Sync failed**: the cloud upsert failed while online; a Retry action is offered.

#### Internal sync states (as defined in code)

`services/db.ts` defines:

- `idle` | `syncing` | `synced` | `error` | `offline`

Note: `offline` is currently **defined** but not emitted by the current `saveCollection()` implementation; offline UX is primarily derived from `navigator.onLine` when handling sync failures.

#### Diagram A: Local-first, cloud-best-effort flow

```text
User action
  ↓
React state updated
  ↓
IndexedDB write (saveCollection)  ───────────────►  Toast: "Saved"
  ↓
if Supabase configured:
  ├─ cloud upsert success  ─────────────────────►  SyncStatus: synced  ──►  Toast: "Synced"*
  └─ cloud upsert failure  ─────────────────────►  SyncStatus: error   ──►  Toast: "Will sync / retrying" (offline)
                                                       │                    Toast: "Sync failed …" + Retry (online)
                                                       └─ queue collection id in pending_sync_ids (IndexedDB)
* "Synced/failed" follow-up toasts are gated by the initiating action (see note below).
```

#### Diagram B: SyncStatus state machine (emitted by `saveCollection`)

```text
idle
  │ saveCollection() starts cloud attempt
  ▼
syncing
  ├─ success ──► synced
  └─ failure ──► error (and id queued for retry)

error
  └─ next saveCollection() attempt (or manual retry) ──► syncing
```

#### Notes / quirks (today)

- Follow-up “Synced / Will sync / Sync failed” toasts are shown only when the initiating action sets a “pending sync toast” flag (e.g., add-item / create-collection). Debounced edits may sync without showing a toast.
- Image asset uploads (`saveAsset`) are separate from metadata sync and do not currently participate in the pending-queue / retry UX.

## 4.1 Home “On This Day” selection logic

Home surfaces a single historical item using cascading fallbacks:

1. Same month/day in a prior year
2. Same day in the prior month (days 1–28 only)
3. Same day in the prior week

If no match exists, the card is hidden.

## 4.2 Home search semantics

- Search matches against:
  - Collection name
  - Item titles within a collection
- If the collection name doesn’t match but an item title does, the UI shows an **item-match badge** on the collection card.

## 8. AI gateway configuration (runtime)

The client composes requests as `${VITE_API_BASE_URL}<path>` where `<path>` includes `/api/...` (e.g., `/api/health`, `/api/gemini/analyze`).

- **Local dev**: set `VITE_API_BASE_URL=http://localhost:8787` and run `npm run server`
- **Production**: leave `VITE_API_BASE_URL` unset to use same-origin `/api/*` (Vercel rewrites / handlers provide the gateway)

## 8.1 AI feature flags (design-time requirements)

We want to be able to toggle AI capabilities on/off independently (especially image-to-image, which is newer and higher-cost).

- **Metadata extraction**: `VITE_AI_METADATA_ENABLED`
  - Controls “image → structured fields” auto-fill.
  - Should remain “deep-read” (core value), but must still degrade gracefully when unavailable.
- **Image-to-image editing**: `VITE_AI_IMAGE_EDIT_ENABLED`
  - Controls “image → enhanced image” and “image → poster/ad asset”.
  - Must be easy to disable globally during rollout / incident response.
- **Back-compat**: `VITE_AI_ENABLED` (legacy)
  - If present, it may be treated as the default for metadata extraction in older builds.

### Reference: Gemini image editing

For Google’s Gemini-native image editing/generation models (Nano Banana), see: [Gemini image editing](https://ai.google.dev/gemini-api/docs/image-generation#gemini-image-editing).

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
- `items.photo_enhanced_path` (current enhanced image pointer)
- `item_images` table for image versions + metadata (role, status, recipe, timestamp)

## 7. UI Utilities

- **Theming:** `theme.tsx` exposes a `ThemeProvider` / `useTheme` hook that persists the selected theme (Gallery, Vault, Atelier) in IndexedDB and is consumed by modals (`AddItemModal`, `AuthModal`, `CreateCollectionModal`, `FilterModal`) for consistent surfaces.
- **Feedback:** A lightweight `StatusToast` component in `App.tsx` surfaces save/sync/import success and error states so users see clear outcomes even during transient network issues.
