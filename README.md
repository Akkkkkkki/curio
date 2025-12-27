<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1Yuc0O2t_PeURvxwx5ooQNqxIIcYfegJ1

## Run Locally

**Prerequisites:**  Node.js


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
VITE_API_BASE_URL=http://localhost:8787
VITE_VOICE_GUIDE_ENABLED=false

# Timestamp-based conflict resolution (requires columns in supabase/1_schema.sql)
VITE_SUPABASE_SYNC_TIMESTAMPS=true
```

The Gemini proxy expects:

```
GEMINI_API_KEY=...
```

## Supabase Setup

Supabase has been initialized with the scripts in:

- `supabase/0_reset.sql` (destructive reset)
- `supabase/1_schema.sql`
- `supabase/2_storage.sql`
- `supabase/3_profiles.sql`

If you previously created tables with UUID `id` columns for collections/items, drop or migrate them before running `supabase/1_schema.sql` so IDs can be stored as text.

## Notes

- AI requests are routed through `server/geminiProxy.js` to avoid exposing API keys in the client bundle.
- Supabase is required; IndexedDB is used as a local cache/back-up.
- Users must sign in before accessing collections.
