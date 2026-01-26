# Collection Creation: Faster Setup With Suggested Tags

## Background (Why we’re doing this)
Creating a collection should feel effortless and personal. Today, users must pick from a handful of presets, which can feel restrictive and slow for anyone whose collection doesn’t fit a template. The goal is to make the first-time experience feel welcoming and quick—more like “describe what you collect and start” than “fill out a form.”

This effort focuses on:
- **Reducing time-to-first-collection**
- **Removing jargon and complexity**
- **Keeping the experience friendly and guided**
- **Letting users feel in control of their collection’s identity**

---

## Product Goals (Baseline)
1. **Fast start**: A user should create a collection in under 30 seconds.
2. **Low effort**: Minimal typing, no technical setup.
3. **Personal fit**: Fields should reflect the user’s real collection.
4. **Gentle guidance**: Suggest helpful tags without forcing decisions.
5. **Simple language**: Avoid “AI,” “prompts,” or data-model terms.

---

## New User Journey (High-Level)
1. **Start** → “Create Collection”
2. **Describe** → User describes what they collect; we suggest tags
3. **Pick Tags** → User selects from suggested tags and adds their own
4. **Display Preview** → User sees how tags will appear
5. **Create** → Collection is created

---

## Tag Model (Simplified)
- **All tags are plain text.**
- **No tag types** (no numbers, dates, dropdowns, etc.).
- **One universal long-text field for “Description/Notes.”**
- **Tag length limits** keep labels tidy (e.g., 24–32 characters).

This keeps the experience simple and future‑proof. More advanced types can be introduced later if needed.

---

## Wireframe Sequence (Textual)

> Notes:
> - The “suggested tags” come from a background model but are framed as **suggestions**, not “AI.”
> - The template picker remains available as a secondary path.

### Screen 1 — Create Collection (Entry)
```
┌─────────────────────────────────────────────┐
│ New Collection                              │
│                                             │
│ What do you collect?                        │
│ [ Vintage postcards...               ]      │
│                                             │
│ [Suggest tags]                               │
│                                             │
│ — or choose a preset —                      │
│ [ Choose a preset template ▾ ]              │
│                                             │
│ [Cancel]                         [Continue] │
└─────────────────────────────────────────────┘
```
**Behavior**
- Default focus: description input (fast path).
- If user chooses a template, “Suggest tags” can be skipped.
- “Continue” is enabled when tag suggestions exist or a template is selected.

---

### Screen 2 — Suggestions (Loading)
```
┌─────────────────────────────────────────────┐
│ Creating suggestions…                        │
│ “Getting ideas for: vintage postcards”       │
│                                             │
│ [Cancel]                                    │
└─────────────────────────────────────────────┘
```
**Behavior**
- If suggestions are unavailable, we fallback to **manual tag entry**.

---

### Screen 3 — Pick Tags (Suggestion Review)
```
┌─────────────────────────────────────────────┐
│ Pick tags for your collection               │
│                                             │
│ Suggested tags                              │
│ [✓ Country] [✓ Era] [✓ Condition] [□ City]  │
│ [□ Publisher] [□ Date Sent] [□ Theme]       │
│                                             │
│ Add your own                                │
│ [ + Add tag ]                               │
│                                             │
│ Tag limits: 4–6 recommended                  │
│                                             │
│ [Back]                            [Next]    │
└─────────────────────────────────────────────┘
```
**Behavior**
- Users select from suggested tags or add their own.
- **Hard cap**: 6 tags max.
- **Minimum**: 3–4 tags to keep cards useful.
- Tags are **string-only**; no additional configuration.

---

### Screen 4 — Display Preview
```
┌─────────────────────────────────────────────┐
│ Preview                                     │
│                                             │
│ Collection card preview                     │
│ ┌───────────────────────────────────────┐   │
│ │ Vintage Postcards                      │   │
│ │ Tags: Country • Era • Condition        │   │
│ └───────────────────────────────────────┘   │
│                                             │
│ [Back]                            [Create]  │
└─────────────────────────────────────────────┘
```
**Behavior**
- Shows how tags will appear on cards and item details.

---

### Screen 5 — Success
```
┌─────────────────────────────────────────────┐
│ Collection created                          │
│ “Vintage Postcards”                         │
│                                             │
│ [Add your first item]                        │
└─────────────────────────────────────────────┘
```

---

## Copy Guidelines (User-Friendly Language)
Replace “AI/prompt/schema/field type” language with:
- “Suggestions” instead of “AI”
- “Tags” instead of “fields”
- “Pick tags” instead of “configure data types”

Examples:
- “Describe what you collect”
- “Here are some suggested tags. Pick the ones you want.”
- “Add more tags”

---

## Suggested Tag Limits (Recommended)
- **Minimum**: 3–4 tags
- **Maximum**: 6 tags
- **Tag length**: 24–32 characters

**Why:**
- Ensures item cards remain scannable
- Keeps tagging simple, not overwhelming
- Encourages thoughtful metadata without turning into a form

---

## LLM Prompt (Internal Only)
> This is internal. The user-facing UI should never reference “AI.”

### System Prompt
```
You are helping suggest simple tags for a personal collection.
Favor short, everyday labels. Avoid technical jargon.
Return 4–6 tags maximum. Use the current app language.
```

### Developer Prompt
```
Return JSON with:
- collectionName: string
- tags: array of { id, label }

Rules:
- Use lowercase snake_case for id.
- Keep tag labels <= 32 chars.
- Keep tag count between 4 and 6.
- Use the current UI language.
```

### User Prompt Template
```
User description: "{{collection_description}}"
App language: "{{locale}}"
```

---

## Example LLM Output
```json
{
  "collectionName": "Vintage Postcards",
  "tags": [
    { "id": "country", "label": "Country" },
    { "id": "era", "label": "Era" },
    { "id": "condition", "label": "Condition" },
    { "id": "publisher", "label": "Publisher" }
  ]
}
```

---

## Decisions (Applied)
1. **Fallback behavior**: If suggestions are unavailable, show manual tag entry. All tags are simple strings, with a length limit. Also include a universal “Description/Notes” field for every collection.
2. **Regenerate limits**: Allow **one** successful suggestion pass. If it fails, retry automatically once. No user-triggered “regenerate.”
3. **Field (tag) cap**: Enforce a **hard max of 4–6 tags** (recommended 6 max).
4. **Confidence**: Not surfaced. All tags are treated as plain text strings.
5. **Locale**: Suggestions must use the current app language.
6. **Persistence**: If existing storage isn’t enough, add a new column for tags. Migration should preserve existing collections.
7. **Safety**: Keep tags as strings only; no type selection or option lists.

---

## Technical Notes (Relevant Only)
- Suggested tags are stored as a list of labels/ids.
- Tag data is saved with the collection so items can reuse it.
- One **universal Description/Notes field** exists for all collections.

---

## Success Metrics
- Time to first collection created (median)
- % of users completing creation without templates
- Tag selection completion rate
- Average number of tags used per collection
