# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Curio is a personal collection management app with AI-powered image analysis and cloud synchronization. It uses a cloud-first architecture where Supabase is the source of truth and IndexedDB is a local cache.

## Documentation Rules (for AI helpers)

When changing code or product behavior, follow these documentation rules:

- **Do not create duplicate docs.** Prefer updating an existing doc or deleting stale docs rather than adding more files.
- **Keep docs aligned with reality.** If documentation contradicts the codebase, fix or remove it.
- **Prefer code-adjacent docs** for implementation details (e.g., testing details in `tests/README.md`).
- **Issues belong in GitHub.** Do not maintain long-term “TODO” lists in `docs/` when an issue already exists.
- **Issue drafts are temporary.** If you create `docs/issue-drafts/<YYYY-MM-DD>/...` for batch import, delete the drafts after issues exist on GitHub.
- **Canonical docs list** lives in `README.md` under “Documentation (how we keep it clean)”.

## Design System

Always read `DESIGN.md` before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match `DESIGN.md`.

## Product Constraints (MVP: Value in 5 Minutes)

When making UX/product changes, preserve these constraints:

- **Delight before auth:** Users must be able to explore the **Public Sample Gallery** pre-login. Prompt for auth when the user attempts to save their own content.
- **Single-path first run:** Present one primary CTA (**Add your first item**) and one secondary CTA (**Explore sample**). Avoid multiple competing actions on first launch.
- **Recoverable AI:** AI analysis must never be a hard blocker. If analysis fails/slow, users should be able to complete item creation manually without losing progress.
- **Read-only clarity:** Public/sample collections must be clearly labeled read-only for non-admins, and edit affordances must be disabled consistently.
- **Explicit outcomes:** Surface clear feedback for “Saved”, “Synced”, and “Will sync / retrying” states so users trust the system.

## Mandatory before finishing any change (format + tests + build + clean git state)

1. Run: `npm run format:write` (or `npm run format`)
2. Run: `npm run format:check` (must pass)
3. Run: `npm test` (must pass)
4. Run: `npm run build` (must pass)
5. Run: `npm run test:e2e` (must pass; first-time setup may require `npx playwright install chromium`)
6. Ensure: `git diff` and `git status --porcelain` are clean (no formatting leftovers / untracked artifacts)

If you cannot run commands, you MUST:

- keep existing code style consistent
- avoid reflowing long lines manually
- do not change whitespace-only unless necessary

## Commands

### Development

```bash
npm install          # Install dependencies
npm run dev          # Start dev server on http://localhost:3000
npm run server       # Start Gemini proxy server on http://localhost:8787 (run in separate terminal)
npm run build        # Build for production
npm run preview      # Preview production build
npm test             # Run unit/component tests (Vitest)
npm run test:e2e      # Run E2E tests (Playwright)
npm run format       # Format code with Prettier
npm run format:write # Format code with Prettier (alias)
npm run format:check # Check formatting without changes
```

**Important:** For AI features to work in development, you must run BOTH `npm run dev` AND `npm run server` in separate terminals.

### Environment Setup

Create `.env.local` with:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_publishable_key
VITE_SUPABASE_SYNC_TIMESTAMPS=true
VITE_API_BASE_URL=http://localhost:8787

# AI features (all enabled by default)
VITE_AI_ENABLED=true
VITE_AI_METADATA_ENABLED=true
VITE_AI_IMAGE_EDIT_ENABLED=true
VITE_VOICE_GUIDE_ENABLED=false
```

The Gemini proxy expects:

```
GEMINI_API_KEY=your_api_key_here

# Optional: Override default Gemini models
GEMINI_ANALYZE_MODEL=gemini-2.5-flash
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image
```

## Architecture

### Tech Stack

- **Frontend**: React 19 + TypeScript 5.8
- **Build Tool**: Vite 6 with `@/` path alias to root
- **Routing**: React Router v7 with HashRouter (SPA-compatible)
- **AI**: Google Gemini (vision analysis + audio guide)
- **Database**: Supabase (source of truth) + IndexedDB (cache)
- **Styling**: Tailwind CSS with custom themes
- **Icons**: Lucide React

### Data Flow

**Cloud-First Pattern:**

1. Users can browse the Public Sample Gallery before signing in; authentication is required before creating/saving their own collections
2. Reads come from Supabase; IndexedDB caches for offline/latency
3. Writes update IndexedDB and sync to Supabase (debounced 1500ms)
4. Local import is manual for legacy data

**Image Storage:**

- Original images: High-quality JPEG @ 95% quality (preserves original if already JPEG)
- Display images: Downsampled to max 2000px @ 92% quality
- Stored in IndexedDB `assets` (original) and `display` stores
- Cloud backup in Supabase Storage under `user_id/item_id_original.jpg` and `user_id/item_id_display.jpg`
- Public sample collections use direct URLs from `public/assets/` (no private storage)

### Key Files

**Root-level:**

- `App.tsx` - Main app container with routing, state management, and all screens
- `types.ts` - Core TypeScript types (CollectionItem, UserCollection, FieldDefinition, etc.)
- `constants.ts` - Collection templates with predefined field schemas
- `i18n.ts` - English/Chinese translations and LanguageProvider

**Services:**

- `services/db.ts` - IndexedDB operations, Supabase sync logic, and merge strategies
- `services/geminiService.ts` - Image analysis and audio guide AI integration
- `services/supabase.ts` - Authentication (email/password) and client configuration
- `services/imageProcessor.ts` - Image resizing and optimization (original + display)
- `src/services/seedCollections.ts` - Public sample data (Vinyl Vault with 4 items)

**Hooks:**

- `hooks/useCollections.ts` - Collection fetch, merge, and seed population
- `hooks/useAuthState.ts` - Supabase auth state management

**Server:**

- `server/geminiProxy.js` - Express server (port 8787) that proxies Gemini API requests, keeping API keys server-side

**Components:**

- `components/Layout.tsx` - Header with sync status, auth menu, theme/language toggles
- `components/AddItemModal.tsx` - Multi-step item creation with AI analysis
- `components/MuseumGuide.tsx` - Real-time audio conversation with Gemini
- `components/ExhibitionView.tsx` - Fullscreen slideshow mode
- `components/ui/Button.tsx` - Reusable button component
- `components/ui/Divider.tsx` - Theme-aware horizontal/vertical dividers
- `components/ui/Rating.tsx` - Theme-aware star rating component

### Routing Structure

```
/ → HomeScreen
  Collections grid, search, "on this day" history

/collection/:id → CollectionScreen
  Item grid/waterfall, filters, exhibition mode, museum guide

/collection/:id/item/:itemId → ItemDetailScreen
  Full item view with editable fields, rating, notes, export
```

### State Management

**ThemeContext** (App.tsx:23):

- Three themes: 'gallery' (light), 'vault' (dark), 'atelier' (cream)
- Persisted to IndexedDB settings store
- Applied via Tailwind conditionals throughout components

**LanguageProvider** (i18n.ts):

- Supports 'en' and 'zh' with `useTranslation()` hook
- 100+ translation keys for UI text

**Main App State** (AppContent component):

- `collections: UserCollection[]` - All collections and items
- Modal states for add item, create collection, museum guide
- `saveTimeoutRef` - Debounce timer for cloud sync

### Gemini AI Integration

**Image Analysis:**

- Model: `gemini-3-flash-preview` (vision)
- Converts uploaded photo to base64
- Sends dynamic JSON schema based on collection template fields via `server/geminiProxy.js`
- Returns structured metadata (title, notes, field values)

**Museum Guide (Audio):**

- Model: `gemini-2.5-flash-native-audio-preview-09-2025` (TBC)
- Uses `ai.live.connect()` for bidirectional real-time audio
- Voice: 'Kore', Audio I/O: 16kHz input / 24kHz output
- System instruction provides collection context for expertise
- Feature-flagged by `VITE_VOICE_GUIDE_ENABLED` (disabled by default)

### Supabase Integration

**Auth Model:**

- Email/password sign-in required before access
- Supabase configuration is mandatory
- Legacy local data can be imported manually

**Status Indicators** (Layout.tsx):

- "Signed In" (emerald)
- "Signed Out" (amber)
- "Cloud Required" (gray)

**Database Schema:**

- `collections` table: id (text), user_id, template_id, name, icon, settings (jsonb), seed_key, is_public, created_at, updated_at
- `items` table: id (text), collection_id, user_id, title, rating, notes, data (jsonb), photo_original_path, photo_display_path, seed_key, created_at, updated_at
- `profiles` table: id (uuid), seed_version, is_admin, created_at
- RLS enforces per-user access, plus public read on `is_public` collections/items and admin-only edits
- Update trigger (`set_updated_at()`) auto-maintains `updated_at` timestamps for conflict resolution

**Supabase Scripts:**

- `supabase/0_reset.sql` (destructive reset)
- `supabase/1_schema.sql` (tables, RLS policies, update triggers)
- `supabase/2_storage.sql` (storage buckets and policies)
- `supabase/3_profiles.sql` (profiles table and RLS)

### Collection Templates

Six predefined templates in `constants.ts`:

- General Archive, Chocolate Vault, Vinyl Archives, Scent Library, Sneaker Gallery, Spirit Collection
- Each defines: icon (emoji), accentColor (Tailwind), field schemas, display/badge field priorities
- Templates guide Gemini's structured extraction schema

### Important Patterns

**Adding Items:**

1. User uploads photo in AddItemModal
2. Photo processed by imageProcessor.ts (resize/optimize)
3. Gemini analyzes with collection-specific schema
4. User verifies AI-extracted metadata
5. Saved to IndexedDB → debounced Supabase sync

**Batch Import:**

- Multi-photo selection
- Each processed with Gemini in sequence
- Batch verify screen before final save

**Data Persistence:**

- IndexedDB is a cache; Supabase is the source of truth
- Changes sync to Supabase after 1500ms debounce
- Images normalized and uploaded to Supabase Storage bucket for private collections
- Public sample collections use direct public URLs for images (no private storage dependency)

**Merge Strategy (services/db.ts):**

- `mergeCollections()` and `mergeItems()` implement smart conflict resolution
- Cloud state is source of truth for existence (prevents deleted items from resurrecting)
- Local-only items (unsynced) are preserved in merged result
- Timestamp-based conflict resolution: `compareTimestamps(local, cloud) > 0 ? local : cloud`
- When `VITE_SUPABASE_SYNC_TIMESTAMPS=true`, newer `updated_at` wins
- Cloud deletions (items missing from cloud) are respected and removed locally

### Styling System

**Theme Architecture** (`theme.tsx`):

Curio uses a comprehensive theme system with three themes:

- **Gallery** (light): Clean, editorial, high-contrast (white + charcoal accents)
- **Vault** (dark): Cinematic, luxurious (dark + brass/gold accents)
- **Atelier** (warm): Intimate, tactile (cream + warm brown accents)

**Typography Classes** (`typographyClasses`):

```tsx
import { typographyClasses, labelColorClasses } from '@/theme';

// Titles: Serif, bold, tight tracking
<h1 className={typographyClasses.titleHero}>Large Title</h1>
<h2 className={typographyClasses.titleLarge}>Section Title</h2>
<h3 className={typographyClasses.title}>Item Title</h3>

// Labels: Mono, uppercase, wide tracking
<span className={typographyClasses.label}>CATEGORY</span>
<span className={typographyClasses.labelMuted}>MUTED LABEL</span>
<span className={typographyClasses.labelSmall}>SMALL</span>

// Body: Sans, relaxed leading
<p className={typographyClasses.body}>Description text</p>
<p className={typographyClasses.quote}>Italic serif quote</p>
```

**Theme-Aware Surface Classes:**

```tsx
import { cardSurfaceClasses, matSurfaceClasses, dividerClasses } from '@/theme';

// Cards with theme-appropriate shadows
<div className={cardSurfaceClasses[theme]}>Card content</div>

// Subtle depth backgrounds
<div className={matSurfaceClasses[theme]}>Mat surface</div>

// Dividers
<hr className={`border-t ${dividerClasses[theme]}`} />
```

**Enhanced Theme Color Palettes** (`themeColors`):

Each theme defines: mat, frameAccent, surface, surfaceMuted, text, textMuted, border, accent, accentHover

**Design Tokens:**

- Fonts: DM Serif Display (titles), JetBrains Mono (labels), Inter (body)
- Accents: Gallery=amber-600, Vault=#D4A574 (brass), Atelier=#8B7355 (warm brown)
- Shadows: Custom per-theme (gallery/vault/atelier) defined in Tailwind config
- Rounded corners: xl, 2xl, 3rem, 4rem

### Path Aliases

Use `@/` for imports:

```typescript
import { analyzeImage } from '@/services/geminiService';
import { Button } from '@/components/ui/Button';
```

Configured in vite.config.ts and tsconfig.json.

### PWA & Service Worker

**Service Worker** (`public/sw.js`):

- Registered in production only (disabled in dev to avoid HMR conflicts)
- Caches static assets for offline access
- Installed via `index.tsx` when `import.meta.env.PROD === true`

**PWA Manifest** (`public/manifest.webmanifest`):

- App name: "Curio"
- Theme colors: amber-500
- Icons in `public/` (icon-192.svg, icon-512.svg, etc.)
- Installable on mobile and desktop

### Deployment

**Vercel Configuration** (`vercel.json`):

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://gemini-proxy-xyz.a.run.app/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

- API routes rewrite to hosted Gemini proxy (Cloud Run or similar)
- All other routes fall back to `index.html` for SPA routing
- Production builds in `dist/` folder

**Production Environment Variables:**

- Leave `VITE_API_BASE_URL` unset so the client uses same-origin `/api/*` rewrites (or set it to the AI gateway origin if hosted elsewhere)
- Ensure Supabase URL and keys are configured
- Gemini API key must be set on the proxy server (not in client env)

## Common Development Workflows

### Adding a New Collection Template

1. Add template definition to `constants.ts` in the `TEMPLATES` array
2. Define `icon` (emoji), `accentColor` (Tailwind class), and `fields` (FieldDefinition[])
3. Specify `displayFields` and `badgeFields` for card UI
4. The Gemini proxy automatically handles new field types via `mapFieldTypeToSchemaType()`
5. If it's a public sample, update `src/services/seedCollections.ts` and increment `CURRENT_SEED_VERSION`

### Modifying Sync Logic

1. Edit `services/db.ts` functions: `mergeCollections()`, `mergeItems()`, `saveCollection()`, `saveItem()`
2. Consider timestamp logic when `VITE_SUPABASE_SYNC_TIMESTAMPS=true`
3. Test merge strategy with offline/online scenarios
4. Check IndexedDB in browser DevTools → Application → IndexedDB → curio-database
5. Check Supabase Dashboard → Table Editor → collections/items for cloud state

### Adding a UI Component

1. Create component in `/components` or `/components/ui`
2. Use `useTheme()` and `useTranslation()` hooks for theming/i18n
3. Import theme class maps from `theme.tsx` (e.g., `cardSurfaceClasses`)
4. Emit callbacks to parent (state lives in App.tsx)
5. Add modal state to App.tsx if needed (e.g., `isNewModalOpen`)

### Debugging Sync Issues

1. **Check IndexedDB:** DevTools → Application → IndexedDB → curio-database → collections/items/assets/display
2. **Check Supabase:** Dashboard → Table Editor → collections/items tables
3. **Check Network:** DevTools → Network → filter `/api/gemini/analyze` and Supabase requests
4. **Check Console:** Look for sync errors, merge conflicts, or authentication issues
5. **Compare Timestamps:** Verify `updated_at` fields in local vs cloud to understand conflict resolution

### Testing

Testing docs:

- `docs/TESTING.md` (how to run)
- `tests/README.md` (structure, patterns, utilities)
