# CUR-9 Flexible Template Builder Design Addendum

> Status: Ready for implementation
> Issue: [CUR-9](https://linear.app/qiuyue/issue/CUR-9/design-spec-flexible-collection-template-builder-for-cross-category)
> Last updated: 2026-06-08

This addendum completes the CUR-9 acceptance criteria on top of the existing flexible collection creation design in [`DESIGN_flexible_collection_creation.md`](./DESIGN_flexible_collection_creation.md). That document already defines the guided creation flow, validation rules, localization keys, and implementation plan. This addendum records the product and technical boundaries that need to be explicit before implementation starts.

## Acceptance Criteria Map

| CUR-9 requirement                                   | Decision in this addendum                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Initial supported field types                       | V1 custom builder exposes text fields only; starter templates may keep existing typed fields.     |
| Common card contract for mixed-schema browsing      | Cards render from `displayMode` slots, not from template-specific layouts.                        |
| Hardcoded-template migration into starter templates | Existing `TEMPLATES` entries become stable starter templates with copied collection-local fields. |
| Custom templates created, edited, and rendered      | Custom templates are collection-local schemas stored in `UserCollection.customFields`.            |
| Builder stays intentionally narrow                  | Advanced typed editing, schema sharing, and destructive field migration are deferred.             |

## Initial Field Types

Curio already defines `FieldType` as `text | long_text | number | date | boolean | rating | select`. CUR-9 should not expose all of that power in the first custom-template builder.

| Field type  | V1 custom builder          | Starter templates                 | Rendering contract                                                                  |
| ----------- | -------------------------- | --------------------------------- | ----------------------------------------------------------------------------------- |
| `text`      | Supported                  | Supported                         | One-line input; truncate on cards; full value on detail.                            |
| `long_text` | Deferred                   | Allowed only when already present | Detail-only; never card-primary in V1.                                              |
| `number`    | Deferred                   | Supported                         | Numeric input where implemented; display as plain text on cards.                    |
| `date`      | Deferred                   | Supported                         | Date input where implemented; display localized short date where available.         |
| `boolean`   | Deferred                   | Supported                         | Detail-only toggle/checkbox label in V1.                                            |
| `rating`    | Deferred                   | Avoid for custom fields           | Use built-in item rating unless a starter template needs a distinct rating concept. |
| `select`    | Deferred for custom fields | Supported with fixed `options`    | Dropdown/select; display selected label as text or badge.                           |

V1 custom collections create `text` fields only. That is a product decision, not a type-system limitation: most collector metadata can start as short labels, and the first builder should feel like naming useful details, not administering a database schema.

## Mixed-Schema Card Contract

Every collection, custom or preset, must support the same card view model so a public museum can browse vinyl, postcards, heirlooms, chocolate, and future object types without special-case layouts.

```ts
interface CardFieldSlot {
  fieldId: string;
  label: string;
  value: string;
  displayMode: 'primary' | 'badge';
}

interface ItemCardViewModel {
  id: string;
  title: string;
  photoUrl: string;
  storyExcerpt?: string;
  rating?: number;
  primaryFields: CardFieldSlot[]; // max 2
  badgeFields: CardFieldSlot[];
}
```

Rendering rules:

- Item cards always show title, image, and built-in rating/story cues before custom metadata.
- `primaryFields` are the first non-empty fields whose definitions have `displayMode: 'primary'`, capped at two.
- `badgeFields` are non-empty `displayMode: 'badge'` fields and render only when space allows.
- `detail` fields never appear on cards.
- Empty values are omitted from cards instead of showing placeholder punctuation.
- Public/share cards may use the same contract but must hide draft, private, or low-confidence system-managed values.

## Starter Template Migration

Existing hardcoded templates should become starter templates in place rather than a separate product surface.

1. Keep each current `TEMPLATES` entry with stable `id`, `name`, `icon`, `description`, `accentColor`, and `fields`.
2. Preserve field IDs so existing `CollectionItem.data` values continue to render.
3. Encode display placement with per-field `displayMode`; do not reintroduce template-level `displayFields` or `badgeFields` arrays.
4. Mark only one or two fields as `primary`; secondary scannable facts can be `badge`; everything else is `detail`.
5. When users choose a preset, copy starter fields into `UserCollection.customFields` so collection-level edits do not mutate the global starter template.
6. Add new starter templates as data first; a later backend-backed registry can import the same shape without changing item rendering.

## Custom Template Lifecycle

Custom templates are collection-local. A user is creating a schema for one collection, not publishing a reusable global template.

- **Create:** store `templateId: CUSTOM_TEMPLATE_ID`, the collection name, optional icon, `collectionDescription`, and three to six `customFields`.
- **Edit before items exist:** allow rename, remove, reorder, and pin changes because no item data can be orphaned.
- **Edit after items exist:** V1 should allow label renames and `displayMode` changes only. Deleting fields or changing field type stays deferred until Curio has an archive-safe migration affordance.
- **Render:** item detail iterates over `collection.customFields` and reads values from `item.data[field.id]`; built-in `title`, `rating`, and `notes` render outside the custom schema.
- **AI analysis:** image analysis receives the current collection fields and description as context; unknown or unfilled values return empty rather than inventing fields.

## Narrow Builder Boundary

The initial builder is intentionally narrow:

- 3-6 custom fields
- text fields only for custom-created schemas
- 1-2 pinned `primary` fields
- no global template publishing
- no field type conversion after item data exists
- no destructive field deletion after item data exists
- no advanced conditional logic, formulas, validation rules, or nested sections

This keeps Curio aligned with the product principle from `docs/PRODUCT_DESIGN.md`: broad product, elegant execution rather than database for everything.
