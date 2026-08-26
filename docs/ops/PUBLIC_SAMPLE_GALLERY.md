# Public Sample Gallery — Admin Guide

How to add or update the pre-login **Public Sample Gallery** (the seed
collections a visitor explores before signing in). This is admin-only internal
tooling; normal users see the gallery read-only.

If you only need the one-line version: the gallery is **code-defined** in
`src/services/seedCollections.ts`. Edit it, bump `CURRENT_SEED_VERSION`, ship the
code, then load the app **once while signed in as an admin** — that publishes the
change to Supabase automatically.

## How it works

- **Source of truth is code.** `INITIAL_COLLECTIONS` in
  `src/services/seedCollections.ts` defines every sample collection and item
  (currently "The Vinyl Vault"). Supabase holds a mirror of this, not the
  original.
- **Images are public files.** Sample photos live in `public/assets/` and are
  referenced with the `sampleAsset()` helper, so they resolve to plain public
  URLs (`<BASE_URL>assets/<file>`). The gallery never depends on private Supabase
  Storage — that is what lets a signed-out visitor see it.
- **Admins publish by loading the app.** On every load by an admin, the app
  reconciles the cloud copy against the code-defined seed
  (`buildSeedRepairs` → `saveCollection`, in `src/hooks/useCollections.ts` and the
  matching path in `src/App.tsx`). It upserts the seed rows as `is_public: true`.
  This is self-healing: drift (a row toggled private, a missing item, a stripped
  photo path) is repaired the next time an admin opens the app. A healthy cloud
  copy makes the pass a no-op.
- **Non-admins never write it.** RLS gives everyone public read on `is_public`
  collections/items but restricts edits to admins, so a visitor or ordinary user
  can browse the gallery but cannot change it.

### Seed versioning

`CURRENT_SEED_VERSION` (in `seedCollections.ts`) gates whether existing installs
re-pull your content:

- Each device records the last-applied version in IndexedDB (`seed_version`).
- Structural drift is always repaired. But a device that already has a **healthy**
  cloud copy only re-pushes your edited content when its recorded version is lower
  than `CURRENT_SEED_VERSION`.
- **So: bump `CURRENT_SEED_VERSION` whenever you change seed _content_** (titles,
  notes, ratings, field data, canonical photos). If you skip the bump, admin
  devices that already recorded the current version treat their healthy cloud copy
  as fine and your edit never propagates.
- A fresh/cleared device reports version `0`, which forces nothing on its own —
  only a device that recorded an _older_ version forces a content re-push.

### Admin-curated photos are preserved

If an admin swaps a sample item's photo in-app (the **Update Photo** control on a
public item), that custom photo is kept across seed-version upgrades
(`isCustomSeedPhoto` in `seedCollections.ts`). A forced content upgrade updates
everything else from the new seed but leaves an explicitly curated photo alone.

## Granting admin access

Admin status is the `is_admin` flag on the `public.profiles` row for a user
(`supabase/3_profiles.sql`). The app reads it in `src/hooks/useAuthState.ts`.

There is **no in-app UI to grant admin** — by design. The `profiles` RLS update
policy explicitly forbids a user from changing their own `is_admin`. Set it
directly in Supabase (SQL editor or Table editor) for the target account:

```sql
update public.profiles set is_admin = true where id = '<auth-user-uuid>';
```

Look up `<auth-user-uuid>` in the Supabase **Authentication → Users** list. Do
this against the same project the environment points at (dev vs prod). Grant it to
as few accounts as possible.

## Add or update a sample collection (step by step)

1. **Edit the seed.** In `src/services/seedCollections.ts`, update
   `INITIAL_COLLECTIONS` — add/edit items, adjust titles, `data` fields, ratings,
   and human-written `notes`. Keep each item's stable `id` and `seedKey`; they are
   how reconciliation matches a code item to its cloud row. A new collection needs
   its own `id`/`seedKey` and a `templateId` from `constants.ts`.
2. **Add images (if any).** Drop the JPEG(s) into `public/assets/` and reference
   them with `sampleAsset('your-file.jpg')`. For the Vinyl Vault artwork, the
   still-lifes are generated, not hand-shot — re-render them with
   `node scripts/generate-sample-vinyl.mjs` (guarded by
   `tests/unit/publicAssets.regression.test.ts`).
3. **Bump the version.** Increment `CURRENT_SEED_VERSION` by one whenever step 1 or
   2 changed content. (You can skip the bump only for a pure code refactor that
   leaves the rendered seed identical.)
4. **Verify locally.** `npm run dev`, sign in with an admin account against your
   dev Supabase project, and load the home screen. Confirm the gallery renders,
   the change is present, and the read-only labelling still holds for a
   non-admin/signed-out view. Run `npm test` (the public-assets regression test
   covers the sample images) and `npm run build`.
5. **Ship the code.** Merge and deploy as usual (Vercel).
6. **Publish to production.** After the deploy, open the production app **once
   while signed in as a prod admin**. That load runs the reconciliation and upserts
   the new seed into the production database as public rows. Reload as a
   signed-out visitor to confirm the gallery reflects the update.

## Local development vs production

The mechanism is identical in both; only the Supabase project and admin account
differ.

| Step                | Local development                                | Production                                        |
| ------------------- | ------------------------------------------------ | ------------------------------------------------- |
| Target database     | Your dev Supabase project (`.env`)               | The production Supabase project                   |
| Admin account       | An account with `is_admin = true` in the dev DB  | An account with `is_admin = true` in the prod DB  |
| Trigger the publish | Load `npm run dev` signed in as the dev admin    | Load the deployed app signed in as the prod admin |
| Verify              | Signed-out browse + `npm test` / `npm run build` | Signed-out browse of the live gallery             |

## Troubleshooting

- **My edit didn't show up in the cloud.** You likely forgot to bump
  `CURRENT_SEED_VERSION`; a device with a healthy cloud copy and the current
  version won't re-push content. Bump it, redeploy, and reload as an admin.
- **The gallery went blank / rows disappeared.** An admin load self-heals
  structural drift — sign in as an admin and reload. If it persists, confirm the
  rows are still `is_public = true` and the account's `is_admin` flag is set.
- **A sample image 404s.** Confirm the file exists in `public/assets/` and the
  `sampleAsset('…')` filename matches exactly (the build serves it from
  `<BASE_URL>assets/`).

## Related

- Code: `src/services/seedCollections.ts`, `src/hooks/useCollections.ts`,
  `src/App.tsx`, `src/hooks/useAuthState.ts`
- Schema/RLS: `supabase/1_schema.sql` (public read + admin edit),
  `supabase/3_profiles.sql` (`is_admin`)
- Adding a new template that a sample uses: see "Adding a New Collection Template"
  in `CLAUDE.md`
