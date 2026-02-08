# Git Hooks

This directory contains Git hooks managed by [Husky](https://typicode.github.io/husky/).

## Pre-commit Hook

The `pre-commit` hook runs automatically before each commit to:

- Format staged files using Prettier via lint-staged
- Ensure code style consistency across the codebase

This prevents formatting check failures in CI and keeps the codebase clean.

## Setup

Husky hooks are automatically installed when you run `npm install` (via the `prepare` script in package.json).

If hooks aren't working, you can manually reinstall them:

```bash
npm run prepare
```

## Bypassing Hooks (Not Recommended)

If you need to bypass the pre-commit hook in an emergency:

```bash
git commit --no-verify -m "your message"
```

However, this should be avoided as it can cause CI failures.
