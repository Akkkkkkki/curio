# GitHub Issues Protocol (Curio)

This repo uses a simple, consistent protocol for filing issues so we can triage quickly and automate creation via `gh`.

## When to create an issue

Create a GitHub issue when you find:

- A user-visible bug (broken flow, incorrect data, UI dead-ends)
- A reliability issue (data loss, sync failures, offline inconsistencies)
- A UX improvement that affects completion/trust (confusing affordances, missing feedback)
- A scoped enhancement with clear acceptance criteria

## Required format

Use this structure (markdown):

```md
## Title

<One sentence, user-facing and specific>

## Labels

- phase:0-foundation | phase:1-shareability | phase:1.5-android | phase:2-community | phase:3-monetization | phase:ops | phase:deferred
- type:bug | type:enhancement | type:ux
- area:i18n | area:sync | area:search | area:forms | area:exhibition | area:auth
- severity:p0 | severity:p1 | severity:p2 | severity:p3

## Problem

What’s broken / confusing, and why it matters.

## Steps to Reproduce

1. ...
2. ...

## Expected

What should happen.

## Actual

What actually happens.

## Acceptance Criteria

- Bullet list of “done means done” checks.

## Notes (optional)

Links, investigation hints, screenshots, logs.
```

## Label taxonomy

Every open issue carries **one phase label**, **one severity label**, one type label, and zero-or-more area labels. Phase + severity together answer "what do we work on next" — product and engineering read the same list.

- **phase:\*** (which roadmap phase the work belongs to — see `docs/ROADMAP.md`):
  - `phase:0-foundation` — trust, story, core reliability (current phase)
  - `phase:1-shareability` — public profiles, shareable cards, flexible templates
  - `phase:1.5-android` — Google Play market test
  - `phase:2-community` — Explore feed, follow, collaboration
  - `phase:3-monetization` — billing and tiers
  - `phase:ops` — cross-phase reliability, monitoring, perf, a11y baselines
  - `phase:deferred` — explicitly deferred in `docs/PRODUCT_STRATEGY.md` § 10. **Do not schedule without a strategy review.** Use this instead of closing as "won't fix" — the idea is preserved but not prioritized.
- **severity:\*** (urgency _within the assigned phase_):
  - `severity:p0` — data loss / security / core flow blocked
  - `severity:p1` — major workflow degradation, no viable workaround
  - `severity:p2` — meaningful but non-blocking; workaround exists
  - `severity:p3` — polish / nice-to-have
- **type:\***:
  - `type:bug` — something is broken
  - `type:enhancement` — new feature request
  - `type:ux` — usability / interaction / clarity
- **area:\***:
  - `area:i18n`, `area:sync`, `area:search`, `area:forms`, `area:exhibition`, `area:auth`

### How to read priority

1. Filter by the **current roadmap phase** (today: `phase:0-foundation`).
2. Sort that list by severity (`p0` → `p3`).
3. That's the queue. Work above the queue only for `phase:ops` items tied to a live incident or exit criterion.

### Picking a phase at file time

- Will this unblock a current-phase exit criterion in `docs/ROADMAP.md`? → tag with the current phase.
- Is it a reliability/monitoring/a11y/perf task that could happen in any phase? → `phase:ops`.
- Does `PRODUCT_STRATEGY.md` § 10 explicitly defer this capability? → `phase:deferred`.
- Otherwise, tag with the phase whose goal the work most directly supports.

Phases can be changed later — they are a coordination tool, not a contract.

## Creating issues via GitHub CLI (recommended)

### One-time setup

```bash
gh auth login -h github.com --web --git-protocol https
gh repo set-default Akkkkkkki/curio
```

Labels should already exist in the repo. If they don’t, create them before issue import.

### Draft-first workflow (fast + reviewable)

1. Create draft files in a local folder (recommended in repo so it's shareable in PRs):
   - `docs/issue-drafts/<YYYY-MM-DD>/<short-title>.md`
2. Preview:

```bash
node scripts/github/create-issues-from-drafts.mjs --dry-run --dir docs/issue-drafts/<YYYY-MM-DD>
```

3. Create issues (skips existing by exact title match):

```bash
node scripts/github/create-issues-from-drafts.mjs --skip-existing --dir docs/issue-drafts/<YYYY-MM-DD>
```

4. Cleanup (required):
   - After issues exist on GitHub, **delete the drafts directory for that batch**.
   - We treat drafts as a temporary staging area, not long-term documentation (issues are the source of truth).

## Closing issues

- Never use `wontfix` as a close reason for product scope decisions. If the work is legitimate but not a current priority, relabel as `phase:deferred` and leave it open.
- Only close as "not planned" when an issue is a clear duplicate, invalid, or obsolete because the underlying behavior no longer exists.

## Filename rules for drafts

- Avoid `/` in filenames (it creates folders). Prefer `EN-ZH` and `3 of 5`.
