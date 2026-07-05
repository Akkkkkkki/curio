# Product Analytics

CUR-8 uses Vercel Web Analytics custom events as Curio's lightweight product-tracking sink. The app
already loads `@vercel/analytics`; `src/services/analytics.ts` is the single transport boundary for
web, Android, and iOS so callers do not depend on provider APIs.

## Rules

- Event names are lowercase `snake_case`.
- Payloads contain no object titles, stories, email addresses, user IDs, image paths, or free-form
  error messages.
- Every event receives `platform: web | android | ios` from the shared transport.
- Payload values stay flat and use only strings, numbers, booleans, or `null`.
- New native clients use the same event names and payload keys.

## Baseline Events

| Event                        | When emitted                               | Payload                                                                  |
| ---------------------------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| `item_creation_started`      | Add Item opens                             | `surface`                                                                |
| `item_saved`                 | One item is accepted by the save handler   | `mode`, `has_story`, `has_photo`, `story_length_bucket`                  |
| `item_edited`                | A debounced Item Detail edit is persisted  | `surface`, comma-separated `fields`                                      |
| `story_prompt_panel_opened`  | Story prompts are requested                | `surface`                                                                |
| `story_prompt_inserted`      | A prompt is inserted into Story            | `surface`, `prompt_length`                                               |
| `story_legacy_banner_action` | A legacy-story action is selected          | `action`                                                                 |
| `sync_failed`                | Collection sync or manual retry fails      | `operation`, `online`, optional `has_error_message`                      |
| `upload_failed`              | Image processing or pending upload fails   | `operation`, `retryable`, optional `has_error_message`                   |
| `share_initiated`            | Item-card Share is selected                | `surface`                                                                |
| `share_completed`            | Native share or download fallback succeeds | `surface`, `method: native` or `download_fallback`                       |
| `share_failed`               | Item-card Share fails                      | `surface`, browser error `reason` (error class only, never message text) |

`story_length_bucket` uses `0`, `1-50`, `51-200`, `201-500`, or `500+`.

## Metrics

- Activation: `item_saved / item_creation_started`, segmented by `mode` and `platform`.
- Story usage: share of `item_saved` events where `has_story = true`, plus length buckets.
- Editing: users who emit `item_edited` after an item save.
- Trust: `sync_failed` and `upload_failed` rates by operation and platform.
- Sharing: `share_completed / share_initiated`, segmented by method and platform.

Public profile and billing events are intentionally not emitted until those product surfaces exist.
When implemented, reserve `public_profile_visited`, `subscription_checkout_started`,
`subscription_checkout_completed`, and `subscription_checkout_failed`, following the same privacy and
platform rules.

## Provider Operations

Custom events appear in the Vercel project's Web Analytics events view. No production credentials are
stored in the client: the existing Vercel deployment integration supplies the analytics endpoint.
Development builds log the event name and sanitized payload to the console while still exercising the
same transport.
