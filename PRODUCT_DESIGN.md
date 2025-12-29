
# Curio - Product Design Document

## 1. Vision & Purpose
Curio is a digital sanctuary for physical collectors. Unlike marketplace-driven apps, Curio is an **intimate archival tool**. It is designed for the "joy of ownership"—focusing on personal narratives, high-end aesthetics, and the emotional value of a curated collection.

## 1.1 MVP North Star: Value in the First 5 Minutes
**Goal:** A brand-new user should experience Curio’s “museum-grade” feel and successfully create **one high-quality item record** within 5 minutes, without confusion or dead-ends.

### The 5-Minute Aha Flow (MVP)
- **Minute 0–1: Immediate delight (no friction)**
  - User lands in a beautiful **Public Sample Gallery** (read-only) or can enter it with one click.
  - One-line positioning explains Curio: *a personal archival sanctuary, not a marketplace*.
- **Minute 1–3: One clear action**
  - One primary CTA: **Add your first item** (secondary: **Explore sample**).
  - Capture is guided by visible stages (e.g., Upload → Analyzing → Review → Save) with progress copy.
- **Minute 3–5: Trust + completion**
  - AI produces a usable draft (title + key fields). User confirms and saves.
  - Clear feedback: **Saved** and **Synced / Will sync**. User sees the item in the collection grid.

### MVP Onboarding Principles
- **Delight before auth:** Users should be able to see the sample gallery before creating an account. Auth can be requested when they attempt to save their own content.
- **Single-path first-run:** Avoid presenting many choices up front. Default path: Explore sample → Add item → Review → Save.
- **AI must be recoverable:** AI latency/failure must never block the flow. Provide a clear fallback to manual entry and keep the user’s progress.
- **Templates must be self-explanatory:** Template selection should show a short description + field preview so users can pick confidently in seconds.
- **Read-only must be obvious:** Public/sample content must always show a persistent read-only indicator and disabled edit affordances.
- **Defer advanced features:** Museum Guide, Exhibition, deep filtering, etc. should be discoverable *after* the first successful save.

## 2. MVP Goals & Enhancements
1.  **Velocity of Capture**:
    *   **Rapid-Fire Mode**: Batch upload for serious archivists.
    *   **AI Auto-naming**: Gemini suggests high-quality archival names based on visual cues.
2.  **Emotional Utility**:
    *   **Archive Archeology**: "On This Day" feature to surface past memories.
    *   **Museum Guide**: A proactive vocal companion that acts as a sophisticated curator.
3.  **Global Aesthetic Curation**:
    *   **Dynamic Global Themes**: Users select from *The Gallery* (Light/Airy), *The Vault* (Moody/Dark), or *The Atelier* (Artisanal/Warm).
4.  **Security for High-Value Collections**:
    *   **Vault Lock**: Optional biometric-style lock for specific collections.

## 3. Design Language
*   **Typography**: *DM Serif Display* for elegance; *Inter* for precision.
*   **Visual Layout**: "Bento Grid" home screen for a modern museum feel; Masonry grids for item browsing.
*   **Theming**: Global theme selection replaces collection-specific accents for a unified aesthetic experience.

## 4. Onboarding & Cloud Access
Curio now requires an account before access. Collections live in the cloud by default, with a local cache for speed and offline resilience.

### MVP Requirement: Sample-first entry
To ensure fast time-to-value, Curio must support **pre-login access** to the **Public Sample Gallery** (read-only). A user should be prompted to sign in only when they attempt to create or save their own collection/items.

### Manual Local Import
Users with legacy local data can import it into their account from the profile menu.

### Public Sample Gallery
A curated public sample collection is visible to all users as inspiration. It is read-only for everyone except admins, keeping the showcase consistent while allowing staff to update it centrally.

## 5. Future Roadmap
*   **Social Curation**: Generate cinematic video "portraits" of items for sharing.
*   **NFC/QR Tagging**: Print tiny archival stickers that link directly to the Curio record.
