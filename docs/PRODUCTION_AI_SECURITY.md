# Production AI security

Curio has two AI execution paths:

- local development: `server/geminiProxy.js`
- Vercel production: `api/gemini/*`

The Express middleware in `server/geminiProxy.js` does **not** protect Vercel serverless handlers. Production security is enforced independently by `api/_aiSecurity.js`.

## Production request flow

All cost-bearing `/api/gemini/*` handlers call `requireAiAccess` before invoking Gemini. The guard:

1. requires a Supabase bearer token;
2. validates the token against Supabase Auth;
3. applies a persistent per-user, per-route limit of 10 requests per 60 seconds through `consume_ai_rate_limit`;
4. returns `401` for missing/invalid auth and `429` with `Retry-After` when the quota is exhausted;
5. fails closed with `503` if auth or rate-limit infrastructure is not configured.

The limiter policy is fixed inside the database function. Its public RPC accepts only the four supported production AI routes (`analyze`, `enhance`, `story-prompts`, and `suggest-fields`), so authenticated clients cannot weaken the quota or create unbounded route keys.

The client already attaches the current Supabase session token in `src/services/geminiService.ts`.

## Required deployment configuration

Vercel must expose the Supabase URL plus one supported public API key variable:

- `SUPABASE_URL` or `VITE_SUPABASE_URL`
- `SUPABASE_ANON_KEY`, `VITE_SUPABASE_ANON_KEY`, or the repository's canonical `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `GEMINI_API_KEY`

Apply `supabase/4_ai_rate_limit.sql` to the production Supabase project before deploying the guarded handlers. The SQL table is not directly accessible to `anon` or `authenticated`; clients only receive execute permission on the authenticated RPC, which derives `auth.uid()` from the caller token.

Structured production request logs include the authenticated `userId` once the guard has validated the session. Missing or invalid sessions remain anonymous.

## Request-contract parity

Production image analysis accepts `collectionContext` and `locale`, matching the client and local proxy. Collection name/description are included in the Gemini analysis prompt.

Production story prompts use the same title validation as the local Express route. The client treats story prompts as optional and falls back to an empty prompt list on API failure, so capture/manual entry remains available when AI is unavailable or rejected.
