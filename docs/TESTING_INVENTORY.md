# Testing Inventory - Curio

**Generated:** 2026-01-03
**Project:** Curio - Personal Collection Management App with AI-Powered Image Analysis

---

## 1. Directory Structure

```
curio/
├── api/                          # Serverless API routes (Vercel deployment)
│   ├── gemini/
│   │   └── analyze.js           # Serverless function for Gemini AI analysis
│   └── health.js                # Health check endpoint
│
├── components/                   # React components
│   ├── ui/
│   │   └── Button.tsx           # Reusable button component
│   ├── AddItemModal.tsx         # Multi-step item creation with AI analysis
│   ├── AuthModal.tsx            # Email/password authentication UI
│   ├── CollectionCard.tsx       # Collection display card
│   ├── CreateCollectionModal.tsx # Collection creation UI
│   ├── ExhibitionView.tsx       # Fullscreen slideshow mode
│   ├── ExportModal.tsx          # Data export functionality
│   ├── FilterModal.tsx          # Item filtering UI
│   ├── ItemCard.tsx             # Item display card
│   ├── ItemImage.tsx            # Image display with fallback handling
│   ├── Layout.tsx               # Header with sync status, auth menu, theme/language toggles
│   ├── MuseumGuide.tsx          # Real-time audio conversation with Gemini (disabled)
│   ├── StatusToast.tsx          # Status notification display
│   └── ThemePicker.tsx          # Theme selection UI
│
├── dist/                         # Production build output
│   ├── assets/
│   ├── icon-192.svg
│   ├── icon-512.svg
│   ├── index.html
│   ├── manifest.webmanifest
│   └── sw.js
│
├── hooks/                        # React custom hooks
│   ├── useAuthState.ts          # Supabase auth state management
│   └── useCollections.ts        # Collection fetch, merge, and seed population
│
├── public/                       # Static assets
│   ├── assets/
│   │   └── sample-vinyl.jpg
│   ├── icon-192.svg
│   ├── icon-512.svg
│   ├── manifest.webmanifest     # PWA manifest
│   └── sw.js                    # Service worker for PWA
│
├── server/                       # Development server
│   └── geminiProxy.js           # Express server proxying Gemini API (dev mode)
│
├── services/                     # Business logic and external integrations
│   ├── db.ts                    # IndexedDB operations and Supabase sync
│   ├── geminiService.ts         # Gemini AI integration facade
│   ├── imageProcessor.ts        # Image resizing and optimization
│   ├── seedCollections.ts       # Public sample data seeding
│   └── supabase.ts              # Supabase client and authentication
│
├── supabase/                     # Database schema and migrations
│   ├── 0_reset.sql              # Destructive reset script
│   ├── 1_schema.sql             # Tables, RLS policies, update triggers
│   ├── 2_storage.sql            # Storage buckets and policies
│   └── 3_profiles.sql           # Profiles table and RLS
│
├── App.tsx                       # Main app container with routing and state
├── constants.ts                  # Collection templates and field types
├── i18n.ts                       # English/Chinese translations
├── index.html                    # HTML entry point
├── index.tsx                     # React app entry point
├── theme.tsx                     # Theme definitions and CSS class mappings
├── types.ts                      # TypeScript type definitions
├── vite-env.d.ts                # Vite environment type declarations
├── vite.config.ts               # Vite build configuration
├── tsconfig.json                # TypeScript compiler configuration
├── package.json                 # Dependencies and scripts
├── vercel.json                  # Vercel deployment configuration
├── .prettierrc                  # Prettier code formatting rules
├── .prettierignore              # Prettier ignore patterns
├── CLAUDE.md                    # Claude Code assistant instructions
├── MVP_CHECKLIST.md             # MVP feature checklist
├── PRODUCT_DESIGN.md            # Product design documentation
├── README.md                    # Project README
└── TECHNICAL_DESIGN.md          # Technical architecture documentation
```

---

## 2. Module Inventory and Primary Functions

### Core Application Files

#### `App.tsx` (Main Application)

- **Purpose:** Root component with routing, global state, and screen orchestration
- **Key Responsibilities:**
  - React Router setup with HashRouter for SPA routing
  - Theme context provider (gallery/vault/atelier themes)
  - Auth state management via `useAuthState` hook
  - Collection state management via `useCollections` hook
  - Modal state management (add item, create collection, auth, museum guide)
  - Debounced cloud sync (1500ms timeout)
  - Status toast notifications
- **Routes:**
  - `/` → HomeScreen (collections grid, search, "on this day" history)
  - `/collection/:id` → CollectionScreen (item grid, filters, exhibition mode)
  - `/collection/:id/item/:itemId` → ItemDetailScreen (full item view with editable fields)
- **Testing Considerations:**
  - Route navigation and state persistence
  - Modal interactions and state transitions
  - Debounced sync behavior
  - Theme switching
  - Authentication flows

#### `types.ts` (Type Definitions)

- **Core Types:**
  - `FieldType`: 'text' | 'long_text' | 'number' | 'date' | 'boolean' | 'rating' | 'select'
  - `AppTheme`: 'gallery' | 'vault' | 'atelier'
  - `FieldDefinition`: Field schema with id, label, type, options, required
  - `CollectionTemplate`: Template definition with fields, display settings, accent colors
  - `CollectionItem`: Individual item with photo, title, rating, dynamic data, timestamps
  - `UserCollection`: Collection with template reference, items, settings, ownership
  - `AIAnalysisResult`: AI-extracted metadata structure
- **Testing Considerations:**
  - Type validation for all data structures
  - Field type compatibility
  - Template field resolution

#### `constants.ts` (Static Data)

- **Content:**
  - `FIELD_TYPES`: UI labels for field types
  - `TEMPLATES`: 6 predefined collection templates:
    - General Archive (✨)
    - Chocolate Vault (🍫)
    - Vinyl Archives (🎵)
    - Scent Library (✨)
    - Sneaker Gallery (👟)
    - Spirit Collection (🥃)
- **Each Template Defines:**
  - Icon, name, description
  - Accent color (Tailwind class)
  - Field schemas
  - Display field priorities
  - Badge field priorities
- **Testing Considerations:**
  - Template field schema validation
  - Display/badge field existence in field definitions

#### `i18n.ts` (Internationalization)

- **Languages:** English (en), Chinese (zh)
- **Features:**
  - `LanguageProvider` context
  - `useTranslation` hook
  - 100+ translation keys
- **Testing Considerations:**
  - Translation key coverage
  - Language switching
  - Missing translation fallbacks

#### `theme.tsx` (Theme System)

- **Themes:**
  - Gallery (light mode)
  - Vault (dark mode)
  - Atelier (cream mode)
- **Exports:**
  - Theme class mappings for consistent styling
  - `cardSurfaceClasses`, `buttonClasses`, etc.
- **Testing Considerations:**
  - Theme application consistency
  - Class name generation

### Services Layer

#### `services/db.ts` (Data Persistence)

- **Functions:**
  - `initDB()`: Initialize IndexedDB (CurioDatabase v5)
  - `loadLocalCollections()`: Load from IndexedDB
  - `fetchCloudCollections()`: Fetch from Supabase with RLS
  - `mergeCollections()`: Cloud-first merge strategy with timestamp-based conflict resolution
  - `mergeItems()`: Item-level merge (cloud existence as source of truth)
  - `saveCollection()`: Save to IndexedDB + debounced Supabase sync
  - `saveAsset()`: Save original + display images to IndexedDB + Supabase Storage
  - `getAsset()`: Load from IndexedDB or fallback to Supabase Storage
  - `deleteAsset()`: Delete from both local and cloud
  - `deleteCloudItem()`: Delete item from Supabase
  - `importLocalCollectionsToCloud()`: Manual import of legacy local data
  - `cleanupOrphanedAssets()`: Remove assets without corresponding items
  - `normalizePhotoPaths()`: Extract and normalize Supabase Storage URLs
- **Stores:**
  - `collections`: Collection metadata and items
  - `assets`: Original images (blob)
  - `display`: Display images (blob)
  - `settings`: App settings and seed version
- **Testing Priorities:**
  - Merge logic correctness (cloud-first, timestamp resolution)
  - Conflict resolution scenarios
  - Data sync reliability
  - Asset upload/download
  - Orphaned asset cleanup
  - URL normalization edge cases

#### `services/supabase.ts` (Authentication & Cloud Client)

- **Functions:**
  - `isSupabaseConfigured()`: Validate environment variables
  - `ensureAuth()`: Check current session
  - `signUpWithEmail()`: Email/password signup
  - `signInWithEmail()`: Email/password signin
  - `signOutUser()`: Sign out
- **Client:** `supabase` (SupabaseClient | null)
- **Testing Priorities:**
  - Authentication flows (signup, signin, signout)
  - Session management
  - Configuration validation
  - Error handling for auth failures

#### `services/geminiService.ts` (AI Integration)

- **Functions:**
  - `refreshAiEnabled()`: Check Gemini health endpoint
  - `isAiEnabled()`: Get cached AI availability
  - `isVoiceGuideEnabled()`: Check voice guide feature flag
  - `analyzeImage()`: Send image + field schema to Gemini for metadata extraction
  - `connectMuseumGuide()`: Stub for disabled voice guide feature
- **AI Model:** gemini-3-flash-preview (vision)
- **Configuration:**
  - `VITE_AI_ENABLED`: AI feature toggle
  - `VITE_VOICE_GUIDE_ENABLED`: Voice guide feature flag (default: false)
  - `VITE_API_BASE_URL`: Proxy server URL
- **Testing Priorities:**
  - AI service availability checking
  - Image analysis request/response parsing
  - Timeout handling (30s)
  - Feature flag behavior
  - Error handling for AI failures

#### `services/imageProcessor.ts` (Image Processing)

- **Function:** `processImage(input, displayMax=2000)`
- **Output:**
  - `original`: High-quality JPEG @ 95% (preserved if input is already JPEG)
  - `display`: Downsampled JPEG @ 92% (max 2000px)
- **Features:**
  - Canvas-based resizing with high-quality smoothing
  - White background fill for transparency
  - Data URL and blob input support
- **Testing Priorities:**
  - Image format conversion (PNG → JPEG, etc.)
  - Quality preservation for original
  - Downsampling correctness
  - Canvas rendering accuracy
  - Blob generation

#### `services/seedCollections.ts` (Sample Data)

- **Constants:**
  - `CURRENT_SEED_VERSION`: 3
  - `SEED_IMAGE_PATH`: public/assets/sample-vinyl.jpg
  - `INITIAL_COLLECTIONS`: "The Vinyl Vault" with 5 vinyl records
- **Purpose:** Provide sample data for first-run and public gallery
- **Testing Priorities:**
  - Seed data structure validity
  - Version migration logic
  - Public collection visibility

### Hooks

#### `hooks/useAuthState.ts`

- **Purpose:** Manage Supabase authentication state
- **Returns:**
  - `user`: Current user or null
  - `isAdmin`: Admin status from profiles table
  - `authReady`: Auth initialization complete
- **Features:**
  - Supabase auth state listener
  - Admin status lookup from profiles table
  - Cleanup on unmount
- **Testing Priorities:**
  - Auth state transitions
  - Admin status detection
  - Subscription cleanup
  - Error handling

#### `hooks/useCollections.ts`

- **Purpose:** Load and sync collections with cloud-first strategy
- **Parameters:**
  - `user`, `isAdmin`, `isSupabaseReady`, `fallbackSampleCollections`, `t`, `showStatus`
- **Returns:**
  - `collections`: Merged collections
  - `isLoading`: Loading state
  - `loadError`: Error message
  - `hasLocalImport`: Flag for unsynced local data
  - `refreshCollections`: Manual refresh function
- **Features:**
  - Timeout-wrapped operations (4s local, 12s cloud)
  - Merge local and cloud collections
  - Auto-seed for admin users
  - Persistence request
- **Testing Priorities:**
  - Timeout handling
  - Merge logic correctness
  - Auto-seeding for admins
  - Error recovery
  - Loading states

### Components

#### UI Components (`components/ui/`)

- **Button.tsx:** Reusable button with theme support

#### Modal Components

- **AddItemModal.tsx:** Multi-step item creation
  - Photo upload
  - AI analysis (optional)
  - Metadata verification
  - Batch import support
- **AuthModal.tsx:** Email/password authentication forms
- **CreateCollectionModal.tsx:** Collection creation with template selection
- **ExportModal.tsx:** Data export UI
- **FilterModal.tsx:** Item filtering by fields

#### Display Components

- **CollectionCard.tsx:** Collection preview card
- **ItemCard.tsx:** Item preview card with photo, title, rating, badges
- **ItemImage.tsx:** Image display with loading states and error handling
- **ExhibitionView.tsx:** Fullscreen slideshow with keyboard navigation
- **Layout.tsx:** Header with sync status, auth menu, theme/language toggles
- **StatusToast.tsx:** Notification banner (success/error/warning)
- **ThemePicker.tsx:** Theme selection UI

#### Special Components

- **MuseumGuide.tsx:** Real-time audio conversation (disabled, voice guide feature)

### Server & API Routes

#### `server/geminiProxy.js` (Development Server)

- **Purpose:** Express server for local development
- **Port:** 8787
- **Routes:**
  - `GET /api/health`: Gemini configuration status
  - `POST /api/gemini/analyze`: Image analysis endpoint
- **Features:**
  - .env.local loading
  - CORS handling
  - 15MB request limit
  - Dynamic JSON schema generation based on field types
- **Testing Priorities:**
  - Request/response validation
  - Schema generation correctness
  - Error handling
  - CORS configuration

#### `api/gemini/analyze.js` (Serverless Function)

- **Purpose:** Vercel serverless function for production
- **Same Logic as:** server/geminiProxy.js analyze route
- **Testing Priorities:**
  - Serverless function execution
  - Same as geminiProxy testing

#### `api/health.js` (Serverless Function)

- **Purpose:** Health check endpoint for production
- **Testing Priorities:**
  - Response format validation

### Build & Configuration

#### `vite.config.ts`

- **Configuration:**
  - Dev server port: 3000
  - React plugin
  - Path alias: `@/` → root directory
- **Testing Considerations:**
  - Build output validation
  - Path alias resolution

#### `tsconfig.json`

- **Configuration:**
  - Target: ES2022
  - Module: ESNext
  - JSX: react-jsx
  - Path alias: `@/*`
  - Experimental decorators enabled
- **Testing Considerations:**
  - Type checking configuration

#### `vercel.json`

- **Configuration:**
  - API route rewrites to hosted Gemini proxy
  - SPA fallback to index.html
- **Testing Considerations:**
  - Deployment routing
  - API proxy behavior

### Database Schema (Supabase)

#### Tables

- **collections:** Collection metadata
  - Columns: id, user_id, template_id, name, icon, settings (jsonb), seed_key, is_public, created_at, updated_at
  - RLS: Per-user access + public read for `is_public=true`
- **items:** Collection items
  - Columns: id, collection_id, user_id, title, rating, notes, data (jsonb), photo_original_path, photo_display_path, seed_key, created_at, updated_at
  - RLS: Per-user access + public read for public collections
- **profiles:** User profiles
  - Columns: id (uuid), seed_version, is_admin, created_at
  - RLS: Users can read own profile

#### Storage

- **Bucket:** curio-assets
  - Structure: `{user_id}/collections/{collection_id}/{item_id}/original.jpg`
  - Structure: `{user_id}/collections/{collection_id}/{item_id}/display.jpg`
  - RLS: Per-user access

#### Triggers

- **set_updated_at():** Auto-update `updated_at` timestamp on row modification

### PWA (Progressive Web App)

#### `public/sw.js` (Service Worker)

- **Purpose:** Cache static assets for offline access
- **Registered:** Production only (disabled in dev to avoid HMR conflicts)
- **Testing Priorities:**
  - Asset caching
  - Offline functionality
  - Update handling

#### `public/manifest.webmanifest`

- **Configuration:**
  - Name: "Curio"
  - Theme colors: amber-500
  - Icons: 192px, 512px SVG
  - Installable on mobile and desktop
- **Testing Priorities:**
  - PWA installation
  - Icon display
  - Manifest validation

---

## 3. Dependencies

### Production Dependencies (`dependencies`)

| Package                 | Version  | Purpose                                 |
| ----------------------- | -------- | --------------------------------------- |
| `@google/genai`         | ^1.33.0  | Google Gemini AI SDK for image analysis |
| `@supabase/supabase-js` | ^2.48.1  | Supabase client for auth and database   |
| `express`               | ^4.19.2  | HTTP server for dev Gemini proxy        |
| `lucide-react`          | ^0.561.0 | Icon library                            |
| `react`                 | ^19.2.3  | UI framework                            |
| `react-dom`             | ^19.2.3  | React DOM renderer                      |
| `react-router-dom`      | ^7.10.1  | Client-side routing                     |

### Development Dependencies (`devDependencies`)

| Package                | Version  | Purpose                   |
| ---------------------- | -------- | ------------------------- |
| `@types/node`          | ^22.14.0 | Node.js type definitions  |
| `@vitejs/plugin-react` | ^5.0.0   | Vite React plugin         |
| `prettier`             | ^3.7.4   | Code formatting           |
| `typescript`           | ~5.8.2   | TypeScript compiler       |
| `vite`                 | ^6.2.0   | Build tool and dev server |

### External Services

- **Supabase:** PostgreSQL database, authentication, storage
- **Google Gemini:** AI image analysis and (disabled) audio guide
- **Vercel:** Deployment platform (inferred from vercel.json)

---

## 4. Test Infrastructure Analysis

### Current State: **NO TEST INFRASTRUCTURE**

#### Findings:

- ✗ No test files found (`**/*.test.*`, `**/*.spec.*`)
- ✗ No test framework configuration (jest.config._, vitest.config._)
- ✗ No `__tests__/` directories
- ✗ No test scripts in package.json
- ✗ No CI/CD test runner configuration
- ✗ No mocking libraries
- ✗ No test utilities or helpers

#### Package.json Scripts:

```json
{
  "dev": "vite", // Start dev server
  "server": "node server/geminiProxy.js", // Start Gemini proxy
  "build": "vite build", // Production build
  "preview": "vite preview", // Preview production build
  "format": "prettier --write .", // Format code
  "format:check": "prettier --check ." // Check formatting
}
```

**No test command exists.**

#### Documentation Notes:

From CLAUDE.md:

> ### No Testing Infrastructure
>
> There are currently no test files. When adding tests:
>
> - Unit test services (gemini, supabase, db, imageProcessor)
> - Integration test data sync workflows
> - E2E test user flows (add item, create collection, auth)

---

## 5. Critical Testing Gaps

Based on the codebase analysis, the following areas have **HIGH RISK** due to lack of test coverage:

### 5.1 Data Synchronization Logic (CRITICAL)

**Location:** `services/db.ts`

**Risk Areas:**

- `mergeCollections()`: Cloud-first merge with timestamp-based conflict resolution
- `mergeItems()`: Item-level merge (cloud existence as source of truth)
- `compareTimestamps()`: Timestamp comparison with NaN handling
- `saveCollection()`: Dual-write to IndexedDB + Supabase
- `saveAsset()`: Image upload to local + cloud
- Orphaned asset cleanup

**Why Critical:**

- User data loss if merge logic fails
- Data corruption if timestamps are mishandled
- Sync conflicts if cloud/local states diverge
- Asset bloat if cleanup fails

### 5.2 Image Processing (CRITICAL)

**Location:** `services/imageProcessor.ts`

**Risk Areas:**

- JPEG quality preservation for original
- Downsampling algorithm correctness
- Canvas rendering with transparency handling
- Blob generation from data URLs

**Why Critical:**

- User photos are irreplaceable
- Quality degradation is irreversible
- Memory leaks from canvas/blob mismanagement

### 5.3 AI Integration (HIGH)

**Location:** `services/geminiService.ts`

**Risk Areas:**

- Image analysis request/response parsing
- Timeout handling (30s)
- Error fallback for failed AI requests
- Feature flag toggling

**Why High:**

- AI failures should not block user workflows
- Timeouts can cause poor UX if not handled
- Feature flags affect production behavior

### 5.4 Authentication Flows (HIGH)

**Location:** `services/supabase.ts`, `hooks/useAuthState.ts`

**Risk Areas:**

- Signup/signin validation
- Session persistence
- Auth state transitions
- Admin status detection

**Why High:**

- Security implications
- User lockout scenarios
- Data access control depends on auth

### 5.5 Database Schema & RLS (HIGH)

**Location:** `supabase/*.sql`

**Risk Areas:**

- RLS policies for per-user access
- Public collection visibility rules
- Admin-only edit permissions
- Timestamp update triggers

**Why High:**

- Data leakage if RLS is misconfigured
- Unauthorized edits if permissions fail
- Conflict resolution depends on triggers

### 5.6 React Component State (MEDIUM)

**Location:** All `components/*.tsx`

**Risk Areas:**

- Modal state transitions
- Form validation
- Loading states
- Error boundaries

**Why Medium:**

- UI bugs are visible but less severe than data loss
- Can be caught in manual testing
- Impacts user experience but not data integrity

### 5.7 Routing & Navigation (MEDIUM)

**Location:** `App.tsx`

**Risk Areas:**

- Route parameter extraction
- State preservation on navigation
- HashRouter compatibility

**Why Medium:**

- Routing bugs are easily detected
- React Router is well-tested upstream

---

## 6. Recommended Testing Strategy

### Phase 1: Critical Infrastructure (Weeks 1-2)

**Priority: CRITICAL**

1. **Data Sync Testing**
   - Unit tests for merge logic
   - Integration tests for cloud sync
   - Conflict resolution scenarios
   - Asset cleanup validation

2. **Image Processing Testing**
   - Unit tests for processImage()
   - Quality preservation validation
   - Format conversion tests
   - Memory leak detection

3. **Authentication Testing**
   - Unit tests for auth functions
   - Integration tests for Supabase auth
   - Session management tests
   - RLS policy validation

### Phase 2: AI & External Services (Weeks 3-4)

**Priority: HIGH**

1. **AI Service Testing**
   - Mock Gemini API responses
   - Timeout handling tests
   - Error recovery tests
   - Feature flag tests

2. **Supabase Integration Testing**
   - Database query tests
   - Storage upload/download tests
   - RLS policy tests
   - Trigger validation

### Phase 3: Component & E2E Testing (Weeks 5-6)

**Priority: MEDIUM**

1. **Component Testing**
   - Modal interactions
   - Form validation
   - Loading states
   - Error handling

2. **E2E Testing**
   - User signup/signin flow
   - Create collection flow
   - Add item with AI analysis
   - Edit item flow
   - Delete item flow
   - Sync verification

### Recommended Tools

**Unit Testing:**

- Vitest (fast, Vite-native)
- @testing-library/react (component testing)
- MSW (Mock Service Worker for API mocking)

**Integration Testing:**

- Vitest + supertest (for server routes)
- Supabase test database

**E2E Testing:**

- Playwright (cross-browser, mobile support)
- Cypress (alternative)

**Code Coverage:**

- vitest coverage (c8/istanbul)
- Target: >80% for critical services, >60% overall

---

## 7. Technical Constraints & Considerations

### 7.1 Cloud-First Architecture

- **Challenge:** Tests need cloud connectivity or comprehensive mocking
- **Solution:** Use Supabase local development + test project

### 7.2 IndexedDB Testing

- **Challenge:** IndexedDB is browser-only API
- **Solution:** Use fake-indexeddb or browser-env in tests

### 7.3 AI Service Mocking

- **Challenge:** Gemini API is external and paid
- **Solution:** Mock with MSW, record/replay for integration tests

### 7.4 Image Processing

- **Challenge:** Canvas API is browser-only
- **Solution:** Use jsdom with canvas polyfill or headless browser

### 7.5 PWA & Service Worker

- **Challenge:** Service worker lifecycle is complex
- **Solution:** Use Workbox testing utilities

### 7.6 Multi-Language Support

- **Challenge:** Test all translations
- **Solution:** Parameterized tests for i18n coverage

---

## 8. Code Quality Observations

### Strengths:

- TypeScript provides strong type safety
- Clear separation of concerns (services, components, hooks)
- Comprehensive documentation in CLAUDE.md
- Prettier configuration for consistent formatting
- Path aliases for clean imports

### Areas for Improvement:

- No test coverage
- No linting configuration (ESLint)
- No commit hooks (husky/lint-staged)
- No CI/CD pipeline definition
- Limited error boundaries in React components
- No logging/monitoring infrastructure

---

## 9. Risk Assessment Summary

| Risk Category    | Level       | Impact if Unchecked              |
| ---------------- | ----------- | -------------------------------- |
| Data Sync Logic  | 🔴 CRITICAL | User data loss, corruption       |
| Image Processing | 🔴 CRITICAL | Irreversible photo degradation   |
| Authentication   | 🟡 HIGH     | Security breaches, lockouts      |
| AI Integration   | 🟡 HIGH     | Poor UX, workflow blockers       |
| Database Schema  | 🟡 HIGH     | Data leakage, unauthorized edits |
| Component State  | 🟢 MEDIUM   | UI bugs, poor UX                 |
| Routing          | 🟢 MEDIUM   | Navigation issues                |

---

## 10. Next Steps

### Immediate Actions:

1. Set up Vitest with basic configuration
2. Write smoke tests for critical services (db, imageProcessor, supabase)
3. Add test scripts to package.json
4. Configure Istanbul/c8 for coverage reporting

### Short-term (1-2 weeks):

1. Achieve >80% coverage for services/db.ts
2. Achieve >80% coverage for services/imageProcessor.ts
3. Add integration tests for Supabase sync
4. Mock AI service for component tests

### Medium-term (1 month):

1. Add E2E tests for critical user flows
2. Set up CI/CD with GitHub Actions
3. Add pre-commit hooks with husky
4. Configure ESLint for code quality

### Long-term (Ongoing):

1. Maintain >80% coverage for new code
2. Add visual regression testing for UI
3. Add performance testing for sync operations
4. Add accessibility testing (a11y)

---

## Appendix A: File Counts

| Category             | Count |
| -------------------- | ----- |
| TypeScript/TSX files | 22    |
| JavaScript files     | 3     |
| SQL files            | 4     |
| Configuration files  | 7     |
| Documentation files  | 5     |
| Total source files   | 41    |

## Appendix B: Lines of Code Estimate

| Category                | Estimated LOC  |
| ----------------------- | -------------- |
| TypeScript (services)   | ~1,500         |
| TypeScript (components) | ~2,500         |
| TypeScript (hooks)      | ~300           |
| JavaScript (server/api) | ~250           |
| SQL (schema)            | ~300           |
| Configuration           | ~100           |
| **Total**               | **~5,000 LOC** |

---

**End of Testing Inventory**
