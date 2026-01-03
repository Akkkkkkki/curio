<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1Yuc0O2t_PeURvxwx5ooQNqxIIcYfegJ1

## MVP Product Behavior (5-minute time-to-value)

Curio’s MVP is designed so a new user can get meaningful value within **5 minutes**:

- **Delight before auth:** Users can explore the **Public Sample Gallery** _before signing in_.
- **One clear first action:** The UI should present a primary CTA to **Add your first item** (and a secondary CTA to **Explore sample**).
- **Capture reliability:** The add-item flow must show visible stages (Upload → Analyzing → Review → Save), and provide a manual fallback if AI fails/slow.
- **Clear outcomes:** Users must see explicit **Saved** and **Synced / Will sync** feedback.
- **Read-only clarity:** Public sample collections/items are read-only for non-admin users and must be visibly labeled as such.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set environment variables in `.env.local` (see below)
3. Start the Gemini proxy (separate terminal):
   `npm run server`
4. Run the app:
   `npm run dev`

## Environment Variables

Create a `.env.local` at the project root:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=...

# AI gateway
VITE_AI_ENABLED=true
VITE_API_BASE_URL=http://localhost:8787/api
VITE_VOICE_GUIDE_ENABLED=false

# Timestamp-based conflict resolution (requires columns in supabase/1_schema.sql)
VITE_SUPABASE_SYNC_TIMESTAMPS=true
```

The Gemini proxy expects:

```
GEMINI_API_KEY=...
```

### Production API base

When deploying behind a reverse proxy (e.g., Vercel rewrites), set:

```
VITE_API_BASE_URL=/api
```

## Supabase Setup

Supabase has been initialized with the scripts in:

- `supabase/0_reset.sql` (destructive reset)
- `supabase/1_schema.sql`
- `supabase/2_storage.sql`
- `supabase/3_profiles.sql`

If you previously created tables with UUID `id` columns for collections/items, drop or migrate them before running `supabase/1_schema.sql` so IDs can be stored as text.

### Public Sample Collection

Curated sample collections are stored in the same `collections`/`items` tables and marked with `is_public = true`. All users can read them, but only admin users can edit or delete them.

To promote an admin account:

```
update public.profiles set is_admin = true where id = 'YOUR_USER_UUID';
```

Notes:

- Public samples should use local image assets (e.g., `public/assets/...`) rather than private storage paths.
- The admin account can seed the public sample by signing in on a clean database and saving the sample collection.

### Seed Data Structure (Sample Content)

Seed data is the default sample content every new user sees. In this project it is defined in
`services/seedCollections.ts` and used by `App.tsx` to populate the sample collection when the database
is empty and the current user is an admin.

Why this structure:

- Keeps sample content in a single, predictable file (easier to maintain than inline data in `App.tsx`).
- Keeps sample images local so they load without Supabase storage policies or public buckets.

#### Rules for Sample Assets

- Store sample images in `public/assets/`.
- Use stable, descriptive filenames (e.g., `sample-vinyl.jpg`, `sample-camera.jpg`).
- Prefer `.jpg` for consistent compression and load performance.
- Reference paths as `assets/<filename>` in seed data (`photoUrl` fields).

To add new sample items:

1. Add the image file to `public/assets/`.
2. Add or update the item entry in `services/seedCollections.ts` with `photoUrl: 'assets/<filename>'`.

## Notes

- AI requests are routed through `server/geminiProxy.js` to avoid exposing API keys in the client bundle.
- Supabase is required; IndexedDB is used as a local cache/back-up.
- Anyone can browse the public sample gallery before signing in; creating or saving your own collections still requires auth.
- Theme selection (Gallery, Vault, Atelier) is stored in IndexedDB, surfaced via the header theme picker, and applied across modals and cards.
- Save/sync/import outcomes surface via a shared toast so users always see a clear result.
- Active filters display as chips with one-tap clear, and public/sample collections show a persistent read-only badge for clarity.
