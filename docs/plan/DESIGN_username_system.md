# Username System For Public Profiles — Design Document

> **Status:** Design (Ready for Implementation Review)
> **Linear:** [CUR-1](https://linear.app/qiuyue/issue/CUR-1)
> **Phase:** Phase 1 — Shareability And Identity · P1
> **Last Updated:** 2026-05-31

This spec defines the username system required before Curio can ship canonical public museum profile URLs. It resolves the open questions in CUR-1 and turns the current `profiles` table into an implementation-ready public identity model.

For product context, see `docs/PRODUCT_DESIGN.md` §3.3 "Public Museum Profile" and §3.4 "Publishing And Privacy". For system context, see `docs/TECHNICAL_DESIGN.md` §2 "Identity & Sync Logic" and the existing profile schema in `supabase/1_schema.sql` / `supabase/3_profiles.sql`.

---

## 1. Problem

Curio currently uses Supabase email/password authentication with no public identity beyond `auth.users.id`. Phase 1 public profiles need stable, human-readable URLs like `/u/qiuyue` and a public curator identity that can appear on profile, collection, item, card, and widget surfaces.

The username system must satisfy three constraints:

- usernames create stable share URLs, so they must be unique and reserved-word safe
- public profile publishing remains opt-in, so usernames should not block core private collecting
- the data model must fit the existing `profiles` table, RLS posture, and anonymous-readable future public routes

---

## 2. Decisions

### 2.1 When Username Is Set

**Decision:** Username is optional during private use and required only when the user first enables their public museum profile.

| Option                                  | Decision | Rationale                                                                                                                                        |
| --------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| During registration                     | No       | Adds friction before the user has experienced Curio's private archive value. Conflicts with the MVP time-to-value principle.                     |
| Immediately after first login           | No       | Still front-loads public identity work before a user knows whether they want to share.                                                           |
| On-demand when enabling public profile  | Yes      | Matches `PRODUCT_DESIGN.md` §3.3: profiles are opt-in and off by default. Keeps private archive creation unblocked.                              |
| Optional earlier profile/settings setup | Yes      | Users may reserve/edit identity before publishing, but the app should not force it until public profile activation or first public share action. |

Implementation implication: the "Enable public profile" flow includes a blocking username step if `profiles.username` is null. Saving a draft profile can be allowed without a username, but publishing cannot.

### 2.2 Username Rules

Canonical validation should be identical client-side and server-side.

| Rule               | Spec                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------- |
| Normalization      | Trim, lowercase, collapse validation against the lowercase string                     |
| Allowed characters | `a-z`, `0-9`, single hyphens between alphanumeric characters                          |
| Regex              | `^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$`                                               |
| Length             | 3-30 characters                                                                       |
| Disallowed         | underscores, periods, spaces, emoji, uppercase-only variants, leading/trailing hyphen |
| Uniqueness         | Case-insensitive unique username, enforced by a lowercased column/check               |
| Mutability         | One self-serve change per 90 days after publish                                       |
| Redirects          | No v1 redirects for changed usernames                                                 |

Hyphens are allowed because they read well in URLs. Underscores are not allowed because they are harder to communicate verbally and often disappear in underlined links.

#### Reserved Words

The reserved list protects current routes, future platform surfaces, support pages, and misleading authority claims.

```ts
const RESERVED_USERNAMES = [
  'about',
  'account',
  'admin',
  'api',
  'app',
  'auth',
  'blog',
  'collection',
  'collections',
  'curio',
  'dashboard',
  'explore',
  'help',
  'home',
  'item',
  'items',
  'legal',
  'login',
  'logout',
  'me',
  'museum',
  'new',
  'privacy',
  'profile',
  'profiles',
  'public',
  'settings',
  'share',
  'signin',
  'signup',
  'support',
  'terms',
  'u',
  'user',
  'users',
  'www',
];
```

Server-side validation should treat this list as canonical. Client-side validation should mirror it for immediate feedback.

### 2.3 Display Identity

**Decision:** `username` is the stable URL slug. `display_name` is the human-facing curator name. They are separate fields.

Why:

- users may want a polished display name with spaces and capitalization
- public URLs need stable, typed slugs
- item cards and collection headers should not be forced to show URL-safe lowercase text

Required profile identity fields:

| Field                 | Purpose                                          | Required before publishing |
| --------------------- | ------------------------------------------------ | -------------------------- |
| `username`            | URL slug and lookup key for `/u/:username`       | Yes                        |
| `display_name`        | Curator name shown on public surfaces            | Yes                        |
| `bio`                 | Short curator statement                          | No                         |
| `avatar_url`          | Optional portrait/object mark for identity chips | No                         |
| `cover_image_path`    | Optional profile hero image or featured object   | No                         |
| `public_enabled`      | Public profile switch                            | Yes, defaults false        |
| `username_changed_at` | Rate limit self-serve username changes           | No until first change      |

Fallbacks:

- If `display_name` is absent while editing a draft, the private UI may show the user's email prefix locally.
- Public surfaces must not expose email addresses. Publishing requires `display_name`.

### 2.4 Where Username Appears

Public surfaces:

- profile canonical URL: `/u/:username`
- public profile header: `display_name` primary, `@username` secondary
- public collection pages: curator identity chip links back to `/u/:username`
- public item pages and share cards: curator identity appears as `display_name` or `@username`
- widgets and OG cards: include curator identity when space allows

Owner-facing surfaces:

- profile/settings identity section
- public-profile enablement flow
- publish preview for profile/collection/item share surfaces

Private collection browsing should not add username chrome until the user is working on public sharing.

---

## 3. Supabase Migration SQL

This is the proposed schema migration for the implementation PR. It is intentionally shown here as SQL but not applied in this design-spec PR.

```sql
-- Add public profile identity fields to existing profiles table.
alter table public.profiles
  add column if not exists username text,
  add column if not exists display_name text,
  add column if not exists bio text,
  add column if not exists avatar_url text,
  add column if not exists cover_image_path text,
  add column if not exists public_enabled boolean not null default false,
  add column if not exists username_changed_at timestamptz;

-- Keep username storage normalized so route lookup and uniqueness are simple.
alter table public.profiles
  add constraint profiles_username_lowercase_check
  check (username is null or username = lower(username));

alter table public.profiles
  add constraint profiles_username_format_check
  check (username is null or username ~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$');

alter table public.profiles
  add constraint profiles_display_name_length_check
  check (display_name is null or char_length(display_name) between 1 and 80);

alter table public.profiles
  add constraint profiles_bio_length_check
  check (bio is null or char_length(bio) <= 280);

create unique index if not exists profiles_username_key
  on public.profiles (username)
  where username is not null;

create index if not exists profiles_public_lookup_idx
  on public.profiles (username)
  where public_enabled = true and username is not null;

-- Anonymous public profile lookup. This exposes only rows the owner has published.
drop policy if exists "profiles: read public profiles" on public.profiles;
create policy "profiles: read public profiles"
on public.profiles for select to anon, authenticated
using (public_enabled = true and username is not null);
```

Reserved words should be enforced in application/service validation rather than a database `check` constraint so the list can evolve without lock-heavy schema changes. If public profile updates move behind an RPC, the RPC should enforce the same reserved list transactionally before updating `profiles.username`.

### Existing User Migration

No automatic usernames should be generated for existing users. Existing users keep `profiles.username = null` and `public_enabled = false`.

When an existing user first opens the public-profile setup:

1. Suggest a candidate username from `auth.users.email` prefix if it validates and is available.
2. Let the user edit before saving.
3. Require explicit confirmation before publishing.

This avoids surprising users with public identifiers they did not choose.

---

## 4. UI Flow

### 4.1 Public Profile Enablement

```text
Profile menu
  -> Public profile
    -> Draft profile editor
      -> Identity step
        - Display name
        - Username
        - Availability check
        - Optional bio/avatar/cover
      -> Preview public profile
      -> Enable public profile
```

Publishing is disabled until:

- username is valid, available, and not reserved
- display name is present
- user confirms the privacy note: enabling a public profile creates a public URL, but collections remain private until individually published

### 4.2 Username Field Behavior

The username input should:

- auto-normalize uppercase to lowercase on blur
- show inline validation before availability checks
- debounce availability checks after the local format passes
- show one of four states: idle, checking, available, unavailable
- preserve the user's typed value if the check fails
- explain that changing the username later may break links

Suggested copy:

- Helper: `Your public URL will be curio.app/u/username. You can change it later, but old links may stop working.`
- Available: `Username available`
- Unavailable: `Already taken`
- Reserved: `That username is reserved`
- Invalid: `Use 3-30 lowercase letters, numbers, and single hyphens`

### 4.3 Availability Check Contract

The client should call a service function that resolves to:

```ts
type UsernameAvailability =
  | { ok: true; normalized: string }
  | {
      ok: false;
      normalized: string;
      reason: 'invalid_format' | 'reserved' | 'taken' | 'rate_limited';
    };
```

Implementation can start with a Supabase query against `profiles.username` plus local reserved-word validation. If username updates later need stricter race protection, move claim/update into a Postgres RPC.

---

## 5. Route And Data Contract

### 5.1 Routes

Use `/u/:username` for public profiles.

Reasons:

- short enough to share
- avoids collisions with app routes like `/collection/:id`
- matches the issue's public-profile URL goal

Future public route family:

| Route                                | Purpose                |
| ------------------------------------ | ---------------------- |
| `/u/:username`                       | Public museum profile  |
| `/u/:username/collections/:slugOrId` | Public collection page |
| `/u/:username/items/:slugOrId`       | Public item page       |

### 5.2 Lookup Rules

- Public profile routes resolve by `profiles.username`.
- Username lookup is lowercase and exact.
- If no row exists or `public_enabled = false`, return a public 404.
- Private app routes continue to use internal IDs and Supabase Auth user IDs.

---

## 6. Privacy And Security Requirements

- Publishing a username must not publish collections automatically.
- Public profile reads may expose only profile identity fields and explicitly public collection/item summaries.
- Email addresses must never appear on public surfaces.
- Private collections and private items must never be reachable through username routes.
- Admin status must remain owner-visible only; do not expose `is_admin` through public profile payloads.
- Username changes should be audited through `username_changed_at`; if abuse becomes a concern, add a server-owned `username_change_count`.

---

## 7. Implementation Checklist

1. Add the profile schema migration from §3.
2. Add shared username validation constants and tests.
3. Add a profile service with `getProfile`, `updateProfile`, and `checkUsernameAvailability`.
4. Add the public-profile setup UI in profile/settings.
5. Gate `public_enabled = true` behind valid username and display name.
6. Add `/u/:username` route shell that renders public profile data only when enabled.
7. Add unit tests for validation, reserved words, availability states, and publish gating.
8. Add RLS/integration checks for anonymous read of public profiles and no anonymous read of private profiles.

---

## 8. Acceptance Criteria Mapping

| CUR-1 deliverable                     | Covered by |
| ------------------------------------- | ---------- |
| Username rules and validation spec    | §2.2, §4.2 |
| Supabase migration SQL                | §3         |
| UI flow for username selection        | §4         |
| Decision on when username is required | §2.1, §4.1 |
| Display/name/avatar decisions         | §2.3, §2.4 |
| Existing-user migration prompt        | §3         |
