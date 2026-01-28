# Flexible Collection Creation — Design Document

> **Status:** Design (Ready for Implementation)
> **PR Reference:** [#161](https://github.com/Akkkkkkki/curio/pull/161)
> **Last Updated:** 2026-01-27
> **Supersedes:** `docs/DESIGN_field-first_collection_creation.md` (to be deleted)

---

## 1. Overview & Motivation

### Problem Statement

The current collection creation flow requires users to:

1. Pick a predefined template (Vinyl, Chocolate, Sneakers, etc.)
2. Accept the template's fixed field schema

This creates friction for users who collect things not covered by templates (vintage postcards, Lego sets, rare coins, etc.) and forces them to use the generic "General Archive" template with irrelevant fields.

### Goal

Allow users to create collections with **custom metadata fields** through a guided, AI-assisted flow that:

- Reduces decision fatigue (fewer upfront choices)
- Lets users describe what they collect in natural language
- Suggests relevant fields based on their description
- Maintains flexibility for any collection type
- Preserves the option to use predefined templates

### Design Principles

1. **Easy over comprehensive**: Users make fewer decisions; smart defaults fill the gaps
2. **Recoverable AI**: AI suggestions are helpful but never blocking
3. **Honest terminology**: UI language matches actual behavior ("fields" not "tags")
4. **Progressive disclosure**: Start simple, allow customization when needed
5. **Minimal backend changes**: Reuse existing patterns; no schema migrations

---

## 2. Goals & Non-Goals

### 2.1 Goals (V1)

| Goal                     | Measure                                                |
| ------------------------ | ------------------------------------------------------ |
| Fast creation            | User can create a meaningful collection in <30 seconds |
| Low cognitive load       | Users make ≤5 decisions total                          |
| Flexibility              | User can define any metadata they care about           |
| AI assist when helpful   | Optional suggestions; never required                   |
| Good card scannability   | Cards show 1-2 useful fields                           |
| Full detail on item view | Item detail shows **all** fields                       |

### 2.2 Non-Goals (V1 — explicitly deferred)

- Typed field schemas (number, date, select) for custom collections
- Advanced field editing after items exist
- Complex inference for primary vs badge layout
- Sharing/exporting custom schemas

---

## 3. User Flow

### 3.1 Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        ENTRY SCREEN                             │
│                                                                 │
│  "What do you collect?"                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Vintage postcards from the 1920s...                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Icon: [🎴] ← picker (default: ✨)                              │
│                                                                 │
│  ─────────────── or choose a preset ───────────────            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Choose a preset template                            ▼   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                              [Cancel]  [Continue →]             │
└─────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
           (description entered)        (preset selected)
                    │                           │
                    ▼                           │
┌─────────────────────────────┐                │
│       LOADING SCREEN        │                │
│                             │                │
│    ◐ Creating suggestions   │                │
│      for: {description}     │                │
│                             │                │
│         [Cancel]            │                │
└─────────────────────────────┘                │
                    │                           │
                    ▼                           │
┌─────────────────────────────────────────────────────────────────┐
│                      FIELDS SCREEN                              │
│                                                                 │
│  "Pick fields for your collection"                              │
│  Select suggestions or add your own.                            │
│                                                                 │
│  SUGGESTED FIELDS                                               │
│  ┌────────┐ ┌────────┐ ┌─────────┐ ┌──────────┐                │
│  │✓ Era   │ │✓Country│ │✓Conditn │ │  Theme   │                │
│  └────────┘ └────────┘ └─────────┘ └──────────┘                │
│                                                                 │
│  ADD YOUR OWN                                                   │
│  ┌─────────────────────────────────────┐ ┌─────────┐           │
│  │ Add a field...                      │ │  Add    │           │
│  └─────────────────────────────────────┘ └─────────┘           │
│                                                                 │
│  YOUR FIELDS (drag to reorder)                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ≡ Era           [📌 Pin to card]    [×]                 │   │
│  │ ≡ Country       [📌 Pin to card]    [×]                 │   │
│  │ ≡ Condition     [ Pin to card ]     [×]                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ℹ️ Pinned fields show on cards. Pin up to 2.                   │
│                                                                 │
│                              [← Back]  [Continue →]             │
└─────────────────────────────────────────────────────────────────┘
                    │                           │
                    └─────────────┬─────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PREVIEW SCREEN                             │
│                                                                 │
│  "Preview"                                                      │
│  See how your collection will appear.                           │
│                                                                 │
│  COLLECTION CARD PREVIEW                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🎴  Vintage Postcards                                   │   │
│  │      Fields: Era • Country • Condition                  │   │
│  │      0 items                                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Name: ┌────────────────────────────────────────────────┐      │
│        │ Vintage Postcards                              │      │
│        └────────────────────────────────────────────────┘      │
│  (defaults to description, title-cased, editable)               │
│                                                                 │
│                         [← Back]  [Create Collection ✓]         │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SUCCESS SCREEN                             │
│                                                                 │
│              ✓ Collection created!                              │
│                "Vintage Postcards"                              │
│                                                                 │
│              ┌─────────────────────────────────┐                │
│              │     Add your first item         │                │
│              └─────────────────────────────────┘                │
│                                                                 │
│                        [Close]                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Step-by-Step Behavior

#### Step 1: Entry Screen

**Purpose:** Capture user intent with a single forward action.

**Elements:**

- **Description input** (required for custom path)
  - Label: "What do you collect?"
  - Placeholder: "Vintage postcards..."
  - Max length: 100 characters
  - `data-testid="collection-description-input"`
- **Icon picker** (optional)
  - Default: ✨
  - Tap to open emoji picker
  - `data-testid="collection-icon-picker"`
- **Preset dropdown** (optional alternative)
  - Label: "— or choose a preset —"
  - Options: All templates from `constants.ts`
  - When selected, shows template preview card
  - `data-testid="collection-preset-select"`

**Actions:**

- **Continue** — enabled when description OR preset is provided
  - If description entered (no preset) → proceed to Loading → Fields
  - If preset selected → proceed directly to Preview
  - `data-testid="collection-continue-btn"`
- **Cancel** → close modal

**Key UX Fix:** User types description → Continue is immediately enabled. No separate "Suggest" button required. AI suggestions are triggered automatically on Continue.

#### Step 2: Loading Screen

**Purpose:** Show progress while AI generates field suggestions.

**Elements:**

- Spinner with message: "Creating suggestions..."
- Subtext: "Getting ideas for: {description}"
- Cancel button

**Behavior:**

1. Call `POST /api/gemini/suggest-fields` with description + locale
2. On success → navigate to Fields screen with suggestions
3. On first failure → **auto-retry once** (2-second delay)
4. On second failure → proceed to Fields with empty suggestions + info message
5. On cancel → return to Entry screen
6. Timeout: 15 seconds max, then proceed with empty suggestions

**Key Principle:** AI failure is never blocking.

#### Step 3: Fields Screen

**Purpose:** Let users select, add, remove, and pin fields for cards.

**Elements:**

- **Suggested fields section**
  - Shows AI-suggested fields as toggleable chips
  - Selected fields have checkmark
  - `data-testid="suggested-field-{index}"`
- **Custom field input**
  - Text input + "Add" button
  - Enter key also adds
  - `data-testid="custom-field-input"`
- **Selected fields list**
  - Each field shows:
    - Drag handle (≡) for reordering
    - Field name
    - "Pin to card" toggle (📌 when pinned)
    - Remove button (×)
  - `data-testid="selected-field-{id}"`
- **Help text**
  - "Pinned fields show on cards. Pin up to 2."
  - "3-6 fields recommended."

**Constraints:**

- Minimum: 3 fields
- Maximum: 6 fields
- Max label length: 32 characters
- Pinned fields: 1-2 required (default: first 2)

**Actions:**

- **Back** → return to Entry (preserves state)
- **Continue** → enabled when 3-6 fields, 1-2 pinned

**Duplicate Prevention (real-time):**

- Case-insensitive match (e.g., "Year" == "YEAR")
- If duplicate in suggestions but not selected → auto-select it
- If already selected → show "Field already added" briefly
- Block submission if duplicates exist at submit time

#### Step 4: Preview Screen

**Purpose:** Confirm collection details before creation.

**Elements:**

- **Collection card preview** (mimics real card appearance)
- **Editable name field**
  - Pre-filled with title-cased description or template name
  - e.g., "vintage postcards" → "Vintage Postcards"
  - `data-testid="collection-name-input"`

**Actions:**

- **Back** → return to Fields (custom) or Entry (preset)
- **Create Collection** → create and proceed to Success

#### Step 5: Success Screen

**Purpose:** Confirm creation and guide to next action.

**Elements:**

- Success message with collection name
- Primary CTA: "Add your first item" → opens AddItemModal
- Secondary: "Close" → close modal

---

## 4. Data Model

### 4.1 Field Definition (UPDATED)

The key change: **display mode is a flag on each field**, not separate arrays.

```typescript
// BEFORE (old pattern - being removed)
interface FieldDefinition {
  id: string;
  label: string;
  type: FieldType;
  options?: string[];
}
// + separate displayFields[] and badgeFields[] arrays

// AFTER (new pattern)
interface FieldDefinition {
  id: string;
  label: string;
  type: FieldType;
  options?: string[]; // For select types
  displayMode: 'primary' | 'badge' | 'detail'; // NEW: unified display control
}
```

**Display modes:**

| Mode      | Where shown                  | Limit    |
| --------- | ---------------------------- | -------- |
| `primary` | Item cards, collection cards | Max 2    |
| `badge`   | Item cards (as small pills)  | No limit |
| `detail`  | Item detail page only        | No limit |

### 4.2 Collection Template (UPDATED)

Remove `displayFields` and `badgeFields` arrays — display mode is now on each field.

```typescript
// BEFORE
interface CollectionTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  accentColor: string;
  fields: FieldDefinition[];
  displayFields: string[]; // REMOVE
  badgeFields: string[]; // REMOVE
}

// AFTER
interface CollectionTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  accentColor: string;
  fields: FieldDefinition[]; // Each field has displayMode
}
```

### 4.3 User Collection (UPDATED)

```typescript
interface UserCollection {
  id: string;
  templateId: string; // "custom" for user-defined fields
  name: string;
  icon?: string;
  customFields: FieldDefinition[]; // Each field has displayMode
  items: CollectionItem[];
  isPublic?: boolean;
  ownerId?: string;
  updatedAt?: string;
  collectionDescription?: string; // For AI context
  // settings.displayFields and settings.badgeFields REMOVED
}
```

### 4.4 Built-in Item Fields (reminder)

Items have these **built-in fields** that are NOT part of `customFields`:

```typescript
interface CollectionItem {
  title: string; // Built-in: item name
  rating: number; // Built-in: 0-5 stars
  notes: string; // Built-in: diary/description/narrative
  data: Record<string, any>; // Custom field values
  // ...
}
```

**Users must be aware** that `notes` exists — see Section 7.3 for reserved names.

### 4.5 Custom Template Marker

```typescript
// In constants.ts
export const CUSTOM_TEMPLATE_ID = 'custom';
```

### 4.6 Field ID Generation

```typescript
function buildFieldId(label: string, existingIds: Set<string>): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'field';

  let id = base;
  let counter = 2;
  while (existingIds.has(id)) {
    id = `${base}_${counter}`;
    counter++;
  }
  existingIds.add(id);
  return id;
}
```

---

## 5. API Design

### 5.1 Suggest Fields Endpoint

**Endpoint:** `POST /api/gemini/suggest-fields`

**Request:**

```json
{
  "description": "vintage postcards from the 1920s",
  "locale": "en"
}
```

**Response:**

```json
{
  "fields": ["Era", "Country", "Condition", "Theme", "Postmark Date"]
}
```

**Prompt Design:**

```text
You are helping suggest metadata fields for a personal collection app.

User's language: {locale}
The user wants to collect: "{description}"

Suggest 4-6 short field names that would be useful for cataloging these items.

Rules:
- Use simple, everyday labels (e.g., "Year" not "Year of Manufacture")
- Match the user's language ({locale})
- Focus on attributes a collector would actually track
- NEVER suggest: "Notes", "Description", "Title", "Name", "Rating", "Diary", "Comments"
  (these are built-in fields)

Return JSON: { "fields": [...] }
```

**Error Handling:**

- 503: Gemini not configured → `{ fields: [] }`
- 500: AI failure → retry once, then `{ fields: [] }`
- 400: Missing description → error response

### 5.2 Enhanced Analyze Endpoint

**Existing Endpoint:** `POST /api/gemini/analyze`

**Enhanced Request:**

```json
{
  "imageBase64": "...",
  "fields": [{ "id": "era", "label": "Era", "type": "text" }],
  "collectionContext": {
    "name": "Vintage Postcards",
    "description": "vintage postcards from the 1920s"
  },
  "locale": "en"
}
```

**Enhanced Prompt:**

```
Analyze this image of a collectible item.

Collection context:
- Name: "{name}"
- User's description: "{description}"
  (Note: This may be a stylized/creative name rather than a literal description.
   Use it as a hint for context, not a strict definition.)
- Language: {locale}

Extract metadata for the provided fields. Match the user's language and style
where appropriate. If a field cannot be determined, leave it null.
```

**Backward Compatibility:** `collectionContext` and `locale` are optional.

---

## 6. UI Specifications

### 6.1 Field Pin Controls ("Pin to card")

| State    | Icon         | Meaning              | Limit    |
| -------- | ------------ | -------------------- | -------- |
| Pinned   | 📌 (filled)  | Shown on cards       | Max 2    |
| Unpinned | 📌 (outline) | Shown in detail only | No limit |

**Default:** First 2 selected fields are auto-pinned.

**User Override:**

- Tap pin icon to toggle
- If user tries to pin 3rd field → show "Maximum 2 pinned fields"
- If user tries to unpin when only 1 pinned → show "At least 1 pinned field required"

### 6.2 Item Detail Layout

Item detail shows **all fields** for the item:

```
┌─────────────────────────────────────┐
│  [Photo]                            │
│                                     │
│  Item Title                    ⭐⭐⭐ │
│                                     │
│  ─── PINNED FIELDS ───              │
│  Era: 1920s                         │
│  Country: France                    │
│                                     │
│  ─── MORE DETAILS ─── [expandable]  │
│  Condition: Good                    │
│  Theme: Landscape                   │
│                                     │
│  ─── NOTES ───                      │
│  Found at a flea market...          │
└─────────────────────────────────────┘
```

**Note:** Items already have a built-in `notes` field; no need to add one automatically to custom schemas.

### 6.3 Theme Support

All screens respect the app theme (Gallery/Vault/Atelier):

- Surface colors from `panelSurfaceClasses`
- Text colors from `mutedTextClasses`
- Input styling per theme

---

## 7. Validation Rules

### 7.1 Field Count & Length

| Rule             | Value    | Error Message                               |
| ---------------- | -------- | ------------------------------------------- |
| Minimum fields   | 3        | "Add at least 3 fields"                     |
| Maximum fields   | 6        | "Maximum 6 fields reached"                  |
| Minimum pinned   | 1        | "At least 1 pinned field required"          |
| Maximum pinned   | 2        | "Maximum 2 pinned fields"                   |
| Max label length | 32 chars | "Field names must be 32 characters or less" |

### 7.2 Duplicate Detection

**Normalization for comparison:**

1. Trim whitespace
2. Collapse multiple spaces
3. Case-insensitive (e.g., "Year" == "YEAR" == "year")

**Behavior:**

- Real-time feedback when adding
- Block submission if duplicates exist
- Show clear error with highlighted duplicates

### 7.3 Reserved Field Names

Certain field names are **blocked** because they conflict with built-in item fields.

**Reserved names (case-insensitive):**

| Reserved      | Reason                           |
| ------------- | -------------------------------- |
| `notes`       | Built-in diary/description field |
| `description` | Alias for notes                  |
| `diary`       | Alias for notes                  |
| `comments`    | Alias for notes                  |
| `title`       | Built-in item name               |
| `name`        | Alias for title                  |
| `rating`      | Built-in star rating             |

**UI Behavior:**

- Show indicator in Fields screen: "📝 Notes field is built-in (for diary/description)"
- If user tries to add a reserved name → show error: "'{name}' is a built-in field. Use the Notes section for descriptions."
- AI prompt explicitly avoids suggesting these names

### 7.4 Collection Name

Collection name is **user-controlled** — no auto-formatting:

- Keep exactly as user typed
- Default to description if no separate name entered
- No title-casing or normalization

---

## 8. Localization

### 8.1 New Translation Keys

```typescript
// English additions
{
  // Entry
  collectionPrompt: "What do you collect?",
  collectionPromptPlaceholder: "Vintage postcards...",
  orChoosePreset: "— or choose a preset —",
  choosePreset: "Choose a preset template",

  // Loading
  creatingSuggestions: "Creating suggestions...",
  creatingSuggestionsFor: "Getting ideas for: {item}",

  // Fields
  pickFieldsTitle: "Pick fields for your collection",
  pickFieldsDesc: "Select suggestions or add your own.",
  suggestedFields: "Suggested fields",
  suggestionsEmpty: "No suggestions available. Add your own fields below.",
  suggestionsUnavailable: "Suggestions unavailable. Add fields manually.",
  addYourOwn: "Add your own",
  addField: "Add",
  addFieldPlaceholder: "Add a field...",
  yourFields: "Your fields",
  pinToCard: "Pin to card",
  pinnedToCard: "Pinned to card",
  fieldLimitHelp: "3-6 fields recommended.",
  fieldMinimum: "Add at least 3 fields",
  fieldMaximum: "Maximum 6 fields reached",
  fieldDuplicate: "Field already added",
  fieldTooLong: "Field names must be {max} characters or less",
  fieldReserved: "'{name}' is a built-in field. Use the Notes section for descriptions.",
  builtInNotesHint: "Notes field is built-in (for diary/description)",
  pinLimitReached: "Maximum 2 pinned fields",
  pinRequired: "At least 1 pinned field required",
  pinnedFieldsHelp: "Pinned fields show on cards. Pin up to 2.",

  // Preview
  previewTitle: "Preview",
  previewDesc: "See how your collection will appear.",
  collectionCardPreview: "Collection card preview",
  collectionName: "Name",
  fieldsLabel: "Fields",

  // Success
  collectionCreated: "Collection created!",
  ctaAddFirst: "Add your first item",

  // Common
  continue: "Continue",
  back: "Back",
  cancel: "Cancel",
  close: "Close",
  createCollection: "Create Collection",
}
```

_(Chinese translations follow same structure)_

---

## 9. Implementation Priority

### P0 — Must Fix (blocks merge)

| Item                  | Description                                                                   | Effort |
| --------------------- | ----------------------------------------------------------------------------- | ------ |
| Schema migration      | Add `displayMode` to FieldDefinition; remove displayFields/badgeFields arrays | M      |
| Template migration    | Update all templates in `constants.ts` with new schema                        | M      |
| Terminology rename    | "tags" → "fields" in UI, code, API                                            | S      |
| Locale in API         | Pass `locale` to suggest-fields and analyze endpoints                         | S      |
| Continue button fix   | Enable when description present (remove "Suggest" button)                     | S      |
| Custom template ID    | Use `templateId: 'custom'` instead of `'general'`                             | S      |
| Reserved field names  | Block reserved names (notes, title, etc.) with error message                  | S      |
| Duplicate validation  | Real-time feedback + block at submit                                          | M      |
| AI context in analyze | Pass `collectionContext` to item analysis                                     | M      |

### P1 — Should Fix (improves quality)

| Item                   | Description                           | Effort |
| ---------------------- | ------------------------------------- | ------ |
| Pin to card UI         | User-controlled displayMode selection | M      |
| Icon picker restore    | Let users choose emoji                | S      |
| Built-in notes hint    | Show "Notes field is built-in" in UI  | S      |
| Auto-retry AI          | One retry on suggestion failure       | S      |
| data-testid attributes | Add test IDs for automation           | S      |

### P2 — Nice to Have (can defer)

| Item                   | Description                                    | Effort |
| ---------------------- | ---------------------------------------------- | ------ |
| Field reordering       | Drag-and-drop in fields list                   | M      |
| Loading on Continue    | Spinner state on button during AI call         | S      |
| Heuristic pin defaults | Prefer "identity" fields (Artist, Brand, Year) | S      |

### Effort Key

- **S** = Small (< 2 hours)
- **M** = Medium (2-4 hours)
- **L** = Large (> 4 hours)

---

## 10. Testing Plan

### 10.1 Unit Tests (required before merge)

| Test                                          | Location                            |
| --------------------------------------------- | ----------------------------------- |
| `buildFieldId` generates unique IDs           | `src/App.test.ts`                   |
| `buildFieldId` handles collisions with suffix | `src/App.test.ts`                   |
| Duplicate label detection (case/whitespace)   | `src/utils/fieldValidation.test.ts` |
| Pin limit enforcement (max 2)                 | `src/utils/fieldValidation.test.ts` |
| Name normalization (title-case)               | `src/utils/nameUtils.test.ts`       |

### 10.2 Component Tests

| Test                        | Description                                 |
| --------------------------- | ------------------------------------------- |
| Entry → Fields (happy path) | Description → Continue → Loading → Fields   |
| Entry → Preview (preset)    | Select preset → Continue → Preview          |
| AI unavailable              | Shows fallback message, allows manual entry |
| Duplicate field blocked     | Shows error, input cleared                  |
| Pin toggle                  | Respects 1-2 limit                          |

### 10.3 E2E Tests

| Test                       | Description                                                  |
| -------------------------- | ------------------------------------------------------------ |
| Full custom flow           | Entry → Fields → Preview → Success → Add Item                |
| Preset flow (regression)   | Entry → Preset → Preview → Success                           |
| Item analysis with context | Create custom collection → Add item → Verify AI uses context |

---

## 11. Open Questions (resolved)

| Question                           | Resolution                           |
| ---------------------------------- | ------------------------------------ |
| "Tags" vs "Fields" terminology?    | **Fields** — matches actual behavior |
| Field reordering: drag vs buttons? | **Drag-and-drop** (P2, can defer)    |
| Max fields: 6 or 7?                | **6** — keeps cards scannable        |
| Emoji picker: native or custom?    | **Native OS picker** — simpler       |
| Store description?                 | **Yes** — for AI context             |
| isCustomSchema flag needed?        | **Yes** — avoids heuristic bugs      |

---

## 12. Future Enhancements (Phase 2+)

1. **Smart field types** — AI suggests type (number, select) not just label
2. **Field type editing** — Change text → number after creation
3. **Template sharing** — Export/import custom schemas
4. **Field inference** — Suggest fields based on item notes patterns

---

## Appendix A: Comparison with PR #161

| Aspect                 | PR #161                                   | This Design                      |
| ---------------------- | ----------------------------------------- | -------------------------------- |
| Terminology            | "Tags"                                    | "Fields"                         |
| Continue button        | Requires "Suggest" click first            | Enabled when description entered |
| Locale support         | Not passed                                | Passed to all AI calls           |
| Pin selection          | Auto (first 2)                            | User-controlled                  |
| Field structure        | Separate displayFields/badgeFields arrays | `displayMode` flag on each field |
| Icon customization     | Removed                                   | Restored                         |
| Duplicate validation   | At submit only                            | Real-time + submit               |
| Reserved field names   | Not enforced                              | Blocked (notes, title, etc.)     |
| AI retry               | None                                      | One auto-retry                   |
| Template ID            | Falls back to "general"                   | Uses "custom"                    |
| Collection description | Not stored                                | Stored for AI context            |
| Name normalization     | None                                      | User-controlled (no auto-format) |
| Test IDs               | Removed                                   | Required                         |

---

## Appendix B: Component Structure

```
CreateCollectionModal/
├── CreateCollectionModal.tsx    # Main component with step state
├── steps/
│   ├── EntryStep.tsx           # Description + icon + preset
│   ├── LoadingStep.tsx         # AI suggestion loading
│   ├── FieldsStep.tsx          # Field selection + pin controls
│   ├── PreviewStep.tsx         # Final review
│   └── SuccessStep.tsx         # Confirmation
├── components/
│   ├── IconPicker.tsx          # Emoji selection
│   ├── FieldChip.tsx           # Suggested field toggle
│   ├── FieldRow.tsx            # Selected field with pin/remove
│   └── CollectionPreviewCard.tsx
└── hooks/
    └── useFieldSuggestions.ts  # API call + retry logic
```

---

## Appendix C: State Machine

```
                    ┌─────────┐
                    │  IDLE   │ (modal closed)
                    └────┬────┘
                         │ open
                         ▼
                    ┌─────────┐
            ┌───────│  ENTRY  │───────┐
            │       └────┬────┘       │
            │            │            │
     preset selected    description   cancel
            │            │            │
            │            ▼            │
            │       ┌─────────┐       │
            │       │ LOADING │───────┤ (cancel/timeout/fail×2)
            │       └────┬────┘       │
            │            │ success    │
            │            ▼            │
            │       ┌─────────┐       │
            │  ┌────│ FIELDS  │───────┤ (back)
            │  │    └────┬────┘       │
            │  │         │ continue   │
            │  │         ▼            │
            │  │    ┌─────────┐       │
            └──┼───►│ PREVIEW │───────┤ (back)
               │    └────┬────┘       │
               │         │ create     │
               │         ▼            │
               │    ┌─────────┐       │
               └────│ SUCCESS │───────┘ (close)
                    └─────────┘
```
