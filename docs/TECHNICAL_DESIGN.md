# Curio - Technical Design Document

> For product thesis and strategic decisions, see `docs/PRODUCT_STRATEGY.md`. For execution phases, see `docs/ROADMAP.md`. For UX design, see `docs/PRODUCT_DESIGN.md`.

## 1. System Architecture

- **Storage**: Supabase (PostgreSQL + Auth + Storage) as source of truth, IndexedDB as cache.
- **AI Inference**: Gemini-3-flash-preview via a server-side proxy (local dev: `server/geminiProxy.js`; deploy: same-origin `/api/*` via Vercel rewrites and/or `api/*` handlers) to keep API keys off the client.
- **Billing (planned)**: Stripe-hosted Checkout Sessions for web/PWA subscriptions, Stripe Customer Portal for self-service billing, and Stripe webhooks into Supabase for entitlement state.

### See also

- **AI gateway monitoring**: `docs/ops/AI_GATEWAY_MONITORING.md`

## 1.1 MVP UX Requirements (Time-to-Value)

To ensure users gain value within the first **5 minutes**, the system must support the following product behaviors:

- **Pre-login sample access:** The client must be able to read **Public Sample Collections** without requiring authentication. All other user content remains auth-gated.
- **Read-only semantics:** Public/sample collections and items are **read-only** for non-admin users; UI should consistently disable edit actions and show a persistent read-only indicator.
- **Capture resilience:** AI-powered analysis must not be a hard dependency for saving an item. The UX must allow a manual completion path while preserving user input.
- **Explicit save/sync feedback:** The UI should surface deterministic states such as “Saved”, “Synced”, and “Will sync / Retrying” so users can trust outcomes.

## 2. Identity & Sync Logic

Curio uses Supabase Auth for user-owned data. Users can browse the Public Sample Gallery without signing in; authentication is required before creating or saving their own collections and items.

Phase 1 public sharing adds a second requirement on top of that baseline: canonical public museum surfaces should be anonymous-readable, but only for content the owner has explicitly made public. The current collection-level `is_public` model is the foundation for that work, not the full finished design.

### Access gating (pre-login sample)

- The app supports a **sample-first** path: users can opt into browsing public/sample collections without being authenticated.
- If Supabase is configured, the client can fetch **public collections** even when `user` is null (cloud public read), and will fall back to local seeded sample collections if nothing is available.

### Manual Local Import

If a user has existing IndexedDB data from older builds, they can trigger a manual import from the profile menu. Collections and items are upserted into Supabase, and assets are uploaded to Storage.

### Public Sample Collections

Curated sample collections live in the same tables and are flagged with `is_public = true`. In the current implementation, everyone can read them (public read via RLS), while writes are limited to admins and the row's owner — the policy is `auth.uid() = user_id or (is_public and is_admin)` (`supabase/1_schema.sql`). The client treats public collections as read-only for non-admins. See `docs/ops/PUBLIC_SAMPLE_GALLERY.md` for the admin workflow and the owner-exception detail.

For Phase 1, that public-collection foundation should extend into anonymous-readable public museum routes for profile, collection, item, Wrapped, and widget surfaces. Those routes must expose only content derived from explicitly public collections.

## 2.1 Billing and Entitlements (Planned)

Curio's default billing path is web-first and low-maintenance:

- **Purchase flow**: create Stripe Checkout Sessions server-side with `mode: 'subscription'` for Pro and Patron plans, then redirect the user to Stripe-hosted Checkout.
- **Plan management**: send paid users to Stripe Customer Portal for cancellation, card updates, invoices, and plan changes.
- **Entitlement source of truth**: Stripe webhooks reconcile subscription lifecycle events into Supabase. The client must read server-owned entitlement state rather than trusting checkout redirects or local state.
- **Early validation shortcut**: Stripe Payment Links or Stripe Pricing Table are acceptable for fast market tests, but paid access should not be enforced until webhook reconciliation maps the purchase back to a Supabase user.
- **Avoid for v1**: raw PaymentIntents, custom card collection, or a custom Payment Element checkout. Those paths increase PCI, tax, discount, renewal, and support surface without a current product requirement.
- **Native-store caveat**: for PWA/browser usage, Stripe is the default. For Apple App Store or Google Play-distributed native shells, do not expose Stripe purchase links or prompts for digital subscriptions unless current store policy, regional programs, and review requirements allow it. Native packages may need app-store billing while web subscribers keep web-managed entitlements where policy permits.

### Local cache and retry invariants

IndexedDB exists to make Curio feel trustworthy on slow or unreliable networks. The durable rules are:

- local writes happen before cloud sync
- cloud sync failures do not discard local changes
- pending collection syncs are queued and retried later
- failed asset uploads are queued and retried later
- corruption recovery should be user-visible, not silent

Primary stores:

- `collections`: cached collections and items
- `assets`: original image blobs
- `display`: downsampled display blobs
- `settings`: preferences and retry queue metadata

Storage quota handling:

- `App.tsx` polls `navigator.storage.estimate()` and surfaces a near-limit warning toast (`statusStorageNearLimit`); a write that still fails with `QuotaExceededError` is caught and reported honestly via `statusStorageFull` rather than a generic retry prompt (see `isQuotaExceededError` in `services/db.ts`).

## 3. Asset Pipeline

- **Local Caching**: `getAsset` in `services/db.ts` always checks IndexedDB first.
- **Cloud Fallback**: If an asset is missing locally (e.g., on a new device), it is pulled from Supabase Storage and cached back into IndexedDB.
- **Normalization**: Private collections store images as Blobs (IndexedDB + Supabase Storage). Public sample collections use direct public URLs (e.g., `public/assets/...`) so every user can view them.

## 3.1 Image variants (original / display / enhanced / poster)

> **Note:** AI image enhancement and poster generation are deferred features (see `docs/PRODUCT_STRATEGY.md`). The schema and storage design below supports them when reintroduced, but they are not current execution priorities.

Curio stores multiple image “variants” per item so AI work is recoverable and the UI stays fast.

### Storage

- **Supabase Storage bucket**: `curio-assets` (private)
- **Object naming**: user-prefixed paths (e.g., `<user_id>/<item_id>_original.jpg`, `<user_id>/<item_id>_display.jpg`, `<user_id>/<item_id>_enhanced.jpg`)
- **Local cache**: assets are also cached as Blobs in IndexedDB for offline/latency

### Database model

We support both:

- `items.photo_original_path`, `items.photo_display_path`, `items.photo_enhanced_path` as “current pointers” (simple and backwards compatible), and
- `item_images` as the canonical history/metadata table for versions.

`item_images` captures:

- **role**: `original` | `display` | `enhanced` | `thumbnail` | `poster`
- **status**: `none` | `processing` | `ready` | `failed`
- **storage_path**: path in `curio-assets`
- **source_image_id**: optional link to the input image version
- **recipe**: JSON metadata for debugging + cost tracking (provider/model, prompt/template version, mode/strength, timestamps, error details, optional input hash)
- **is_current**: enforced unique per `(item_id, role)` so we can swap the “current” enhanced/poster while retaining history

### Lifecycle requirements (non-blocking + recoverable)

- Item creation always produces **original** + **display** (enhancement is optional).
- “Enhance image” creates a new `item_images` row (role `enhanced`, status transitions), uploads the output, and updates `items.photo_enhanced_path` plus `is_current` pointers.
- If enhancement fails, the item remains saved with original/display; `item_images.status = 'failed'` preserves the failure reason in `recipe`.

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
- Pending changes are kept in an IndexedDB-backed retry queue until a later sync succeeds.

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
- Image asset uploads (`saveAsset`) queue failed uploads in IndexedDB and retry automatically on reconnect/startup (see `services/db.ts`).

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

## 4.3 Large collection rendering

Curio uses incremental client-side rendering for large collection grids:

- Collections with up to 100 matching items render in one pass.
- Above 100 matching items, `CollectionScreen` initially mounts 50 cards and exposes 50 more per explicit **Load more** action.
- Changing collection, search, filters, or sort order resets the visible window to the first 50 matching items.
- Explicit loading keeps native browser scrolling and the responsive masonry/grid layout intact on mobile; it does not move focus or programmatically change the scroll position.
- A component regression test exercises a 500-item collection, verifies the initial DOM bound, and confirms every item remains reachable.

The complete collection remains in the local-first data model so offline access, client search, filters, sorting, bulk selection, and Exhibition continue to operate over the full dataset. This strategy primarily bounds React/card/image DOM work. If profiling shows that retaining the full collection in memory becomes the bottleneck, add data-layer paging or grid virtualization without changing this UI contract.

## 4.4 PWA and cache behavior

The service worker should stay minimal and predictable.

### Request strategy

| Request type                                           | Strategy                              | Rationale                                                  |
| ------------------------------------------------------ | ------------------------------------- | ---------------------------------------------------------- |
| HTML navigations (`/`, `/index.html`, route refresh)   | **Network-first** with cache fallback | Fresh HTML should point at the latest hashed assets.       |
| Static assets (`/assets/*.js`, `/assets/*.css`, fonts) | **Stale-while-revalidate**            | Fast loads with background refresh.                        |
| Shell assets (manifest + icons)                        | **Cache-first**                       | Rarely change and are safe to cache.                       |
| API/auth/Supabase requests                             | **Network-only**                      | Dynamic data should never be cached by the service worker. |

### Cache invalidation

- cache names should be versioned per release
- activation should delete older caches
- `/sw.js`, `/`, and `/index.html` should be served with `Cache-Control: no-store, no-cache, must-revalidate`

The goal is simple: a refresh should pick up the newest build without forcing users to clear browser data.

## 5. AI gateway configuration (runtime)

The client composes requests as `${VITE_API_BASE_URL}<path>` where `<path>` includes `/api/...` (e.g., `/api/health`, `/api/gemini/analyze`).

- **Local dev**: set `VITE_API_BASE_URL=http://localhost:8787` and run `npm run server`
- **Production**: leave `VITE_API_BASE_URL` unset to use same-origin `/api/*` (Vercel rewrites / handlers provide the gateway)

### Production hardening requirements (must-have)

In production, the AI gateway must be treated as a cost + abuse surface:

- **Auth required**: gateway requests must require `Authorization: Bearer <Supabase access token>` and validate the token server-side (reject missing/invalid tokens with 401).
- **Rate limiting**: enforce per-user (preferred) and/or per-IP limits and return clear 429 responses for client recovery messaging.
- **CORS allowlist**: if the gateway is exposed cross-origin, restrict origins via an allowlist (no wildcard in production) and handle preflight correctly.
- **Logging**: emit structured request logs (route, status, latency, request id, user id/hashed). Never log images.

These requirements are tracked in: [#129](https://github.com/Akkkkkkki/curio/issues/129).

## 5.1 AI feature flags (design-time requirements)

We want to be able to toggle AI capabilities on/off independently (especially image-to-image, which is newer and higher-cost).

- **Metadata extraction**: `VITE_AI_METADATA_ENABLED`
  - Controls “image → structured fields” auto-fill.
  - Should remain “deep-read” (core value), but must still degrade gracefully when unavailable.
- **Image-to-image editing** (deferred): `VITE_AI_IMAGE_EDIT_ENABLED`
  - Controls “image → enhanced image” and “image → poster/ad asset”.
  - This capability is deferred per `docs/PRODUCT_STRATEGY.md`. The flag exists for future use.
  - Must be easy to disable globally during rollout / incident response.
- **Back-compat**: `VITE_AI_ENABLED` (legacy)
  - If present, it may be treated as the default for metadata extraction in older builds.

### Reference: Gemini image editing

For Google’s Gemini-native image editing/generation models (Nano Banana), see: [Gemini image editing](https://ai.google.dev/gemini-api/docs/image-generation#gemini-image-editing).

## 6. Security

- **RLS Policies**: Users can access their own rows. Public collections (`is_public = true`) are currently readable by authenticated users, and admins can mutate them. Phase 1 public sharing requires extending the access model so anonymous public routes can read only explicitly public museum content.
- **Storage Buckets**: Assets are stored in user-specific folders (`bucket/user_uuid/asset_id`) to ensure strict isolation.

## 7. Supabase Schema Notes

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

## 8. UI Utilities

- **Theming:** `theme.tsx` exposes a `ThemeProvider` / `useTheme` hook that persists the selected theme (Gallery, Vault, Atelier) in IndexedDB and is consumed by modals (`AddItemModal`, `AuthModal`, `CreateCollectionModal`, `FilterModal`) for consistent surfaces.
- **Feedback:** A lightweight `StatusToast` component in `App.tsx` surfaces save/sync/import success and error states so users see clear outcomes even during transient network issues.

## 9. Production readiness gaps (shortlist)

These are known gaps that should be closed before a full production launch. They are tracked in GitHub Issues.

- **AI gateway hardening** (CORS restrictions, auth/signed requests, rate limiting).
- **Operational monitoring** for the AI gateway and sync error rates (metrics + alerting).
- **Documentation alignment** so testing status reflects actual E2E coverage.
