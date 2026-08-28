# Production rollback runbook

This runbook covers rollback of Curio's two highest-risk operational change types: AI gateway changes and Supabase database/schema changes. Use it during an incident or when a deployment fails validation. Prefer the smallest rollback that restores a known-good state; do not combine rollback with unrelated cleanup.

## Ownership and required access

**Incident owner:** the Curio maintainer handling the release/incident.

Required access depends on the failure:

- **GitHub:** repository write access to revert or redeploy a known-good commit.
- **Vercel:** project access to inspect runtime logs, environment variables, and promote/redeploy deployments.
- **Supabase:** project access to inspect schema/data and run reviewed SQL migrations.
- **AI provider:** access to the configured provider account only when a provider key/model/configuration must be changed.

Never paste production secrets, private stories, photos, access tokens, or full user records into incident tickets or generic logs.

## Before changing production

For AI gateway or schema changes, record these in the PR or release note before deployment:

1. The current production commit/deployment.
2. The migration or configuration change being applied.
3. The exact rollback action, including whether it is code-only or requires SQL/configuration work.
4. Any compatibility window. Prefer additive/expand-contract database changes when old and new clients may overlap.
5. A small verification checklist for the affected user path.

If the rollback cannot be made safely without data loss, call that out before deployment and use a forward-fix or restore plan instead of pretending the change is reversible.

## AI gateway rollback

Use this when metadata analysis, field suggestions, story prompts, image editing, health checks, or gateway routing regress after a deploy.

### 1. Confirm the regression

- Check Vercel runtime logs for structured `api_request` events and compare error rate/latency with the previous deployment. See `docs/ops/AI_GATEWAY_MONITORING.md`.
- Check `/api/health` and the affected AI route.
- Confirm whether the problem is code, provider/model configuration, credentials, or an upstream provider incident.

Do not rotate credentials or switch models merely because a request failed once.

### 2. Choose the narrowest rollback

**Code regression:** redeploy/promote the last known-good Vercel deployment or revert the offending Git commit and deploy that revert.

**Environment/config regression:** restore the previous Vercel environment variable value, then redeploy. Environment changes do not alter an already-built deployment consistently enough to rely on without a redeploy.

**Provider/model regression:** restore the last known-good provider/model configuration behind Curio's provider adapter, and keep the public route contract unchanged. Today that contract is:

- `/api/ai/analyze-item`, `/api/ai/story-prompts`, `/api/ai/suggest-fields` — what the current client calls (`src/services/aiService.ts`).
- `/api/gemini/enhance` — image editing, still on its original path.
- `/api/gemini/analyze`, `/api/gemini/story-prompts`, `/api/gemini/suggest-fields` — the pre-CUR-166 paths. `api/ai/*.js` are thin re-exports of these handlers, so both spellings hit the same code. Already-deployed clients may still call the `/api/gemini/*` form, so a rollback must keep them serving rather than removing the aliases.

`server/geminiProxy.js` mounts the same set locally. Do not patch product callers to a provider-specific route as an emergency shortcut.

**Optional AI capability failure:** if the affected feature already has a supported unavailable/manual path, prefer disabling only that capability over taking down unrelated AI routes.

### 3. Verify after rollback

At minimum:

- `GET /api/health` reports the expected capability state.
- One representative metadata-analysis request succeeds.
- The Add Item manual fallback remains usable if AI is unavailable.
- Vercel logs show request error rate returning to normal and no new 5xx spike.
- If image editing was involved, verify it separately; it is an optional capability and should not gate metadata capture.

Record the deployment/commit that was restored and the observed recovery time in the incident/PR.

## Supabase schema rollback

Database rollback is not the same as reverting application code. A Git revert does **not** undo a production migration.

Curio's checked-in SQL under `supabase/` describes the expected schema, but production rollback SQL must be reviewed for the specific migration and current data state.

### 1. Classify the migration

**Additive change** — new nullable column/table/index/policy that old code ignores. Usually safest to leave in place while reverting application code, then remove later in a separate reviewed migration if still desired.

**Rename/contract change** — renamed/dropped column, changed constraint, trigger, function, or RLS policy. Restore compatibility first. Prefer re-adding the old shape or compatibility layer before removing the new shape.

**Destructive/data-transforming change** — dropped data, irreversible rewrite, or transformation that cannot reconstruct the prior values. Do not run an improvised inverse migration. Stop writes to the affected path if necessary and use the verified backup/restore or forward-repair procedure.

### 2. Stop incompatible application writes

If current application code can continue writing data in a shape that the rollback cannot understand, first redeploy a compatible application version or temporarily disable the affected write path. Curio is local-first, so preserve the client's IndexedDB-first flow where possible rather than bypassing it with direct database edits.

### 3. Apply reviewed rollback SQL

- Write a dedicated inverse/compatibility migration for the exact production change.
- Test it against a Supabase branch or disposable database seeded with representative data before production.
- Verify constraints, indexes, triggers/functions, grants, and RLS policies after the change; a column/table rollback is incomplete if its security policy no longer matches.
- Do not use `supabase/0_reset.sql` against production. It is a reset/bootstrap artifact, not an incident rollback command.
- Do not replace production state by blindly re-running `supabase/1_schema.sql`; reconcile the live migration deliberately.

For a simple reversible rename, the inverse may be as small as:

```sql
alter table public.items rename column new_name to old_name;
```

Only use that form when no deployed client still depends on `new_name` and no data/trigger/policy dependency makes the inverse unsafe.

### 4. Verify data and permissions

After the database change:

- Read a representative collection and item as its owner.
- Create/update one test item through the normal Curio application path and confirm local-first sync completes.
- Confirm another user cannot read or mutate that private data.
- Confirm public/sample access still matches the intended policy.
- Check for new `sync_status_error` events. These are emitted client-side by
  `src/services/db.ts` as `console.info` JSON and are not ingested anywhere, so
  Vercel runtime logs will not show them. Verify from a browser instead: open
  production with the devtools console filtered to `sync_status_error`, complete
  the test write above, and confirm no error event fires and the in-app status
  banner does not enter its sync-error state. Treat a report from a single
  browser as a spot check, not fleet-wide evidence.
- Compare row counts and any migration-specific invariants captured before the change.

## Feature flags and staged compatibility

When a schema or gateway change is risky enough to need a flag, the flag should select between two already-compatible paths. A rollback should normally flip the flag and redeploy first, then clean up schema/code later. Do not use a flag to hide an incompatible database contract that active clients can still write to.

## Incident checklist

- [ ] Identify the first bad deployment/configuration/migration.
- [ ] Capture the last known-good production commit/deployment.
- [ ] Decide whether rollback is code, environment, provider configuration, database, or a combination.
- [ ] Protect data first; stop incompatible writes before destructive database work.
- [ ] Apply the smallest reviewed rollback.
- [ ] Verify the affected user journey plus auth/RLS boundaries where database changes were involved.
- [ ] Check AI gateway and sync monitoring for recovery.
- [ ] Record what was rolled back and open a follow-up for the root cause instead of fixing it opportunistically during rollback.
