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

- **type:\***:
  - `type:bug` — something is broken
  - `type:enhancement` — new feature request
  - `type:ux` — usability / interaction / clarity
- **area:\***:
  - `area:i18n`, `area:sync`, `area:search`, `area:forms`, `area:exhibition`, `area:auth`
- **severity:\***:
  - `severity:p0` — data loss / security / core flow blocked
  - `severity:p1` — major workflow degradation, no viable workaround
  - `severity:p2` — meaningful but non-blocking; workaround exists
  - `severity:p3` — polish / nice-to-have

## Creating issues via GitHub CLI (recommended)

### One-time setup

```bash
gh auth login -h github.com --web --git-protocol https
gh repo set-default Akkkkkkki/curio
```

Labels should already exist in the repo. If they don’t, create them before issue import.

### Draft-first workflow (fast + reviewable)

1. Create draft files in a local folder (recommended in repo so it’s shareable in PRs):
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

## Filename rules for drafts

- Avoid `/` in filenames (it creates folders). Prefer `EN-ZH` and `3 of 5`.
