
# Curio - Product Design Document

## 1. Vision & Purpose
Curio is a digital companion for physical collectors. Unlike marketplace-driven apps, Curio is an **intimate archival tool**. It is designed for the "joy of the collection"—focusing on personal notes, sensory details, and aesthetic presentation rather than resale value.

## 2. MVP Goals (Commercial Focus)
1.  **Capture Velocity**: Enable users to go from "seeing an item" to "cataloging an item" in under 10 seconds.
2.  **Assisted Accuracy**: Use Gemini AI to populate technical fields (brand, origin, year) so users can focus on their personal notes.
3.  **Data Durability**: Guarantee that collections remain on-device even if the browser cache is cleared (via Persistent Storage API).
4.  **Aesthetic Reward**: Ensure that browsing the collection feels as satisfying as looking at a well-organized physical shelf.

## 3. Design Language
*   **Typography**: *DM Serif Display* for headers; *Inter* for functional data.
*   **Color**: `Stone-50` base, `Amber-600` accents, `Stone-900` ink.
*   **Grid vs Waterfall**: Grid for technical comparison; Waterfall for "Art Gallery" aesthetic.

## 4. Local Archive Mode & Cloud Sync Strategy
Curio employs a **Local-First** architecture. This ensures high availability and privacy while allowing for seamless multi-device access when a cloud provider is connected.

### Local Archive Mode (Default)
When no cloud environment (Supabase) is detected via environment variables:
- **Privacy**: All item data, personal notes, and photos are stored strictly within the user's browser using **IndexedDB**.
- **Performance**: Zero-latency browsing and cataloging.
- **Persistence**: Uses the browser's Persistent Storage API to prevent data loss during cache cleanups.
- **Portability**: Users can export their entire archive as a structured file for manual backup.

### Cloud Synchronization (Extended)
When Supabase is fully configured:
- **Automatic Sync**: Metadata is normalized and synced to a PostgreSQL backend.
- **Asset Storage**: High-resolution photos are uploaded to Supabase Storage buckets, allowing for device roaming.
- **Hydration**: When logging into a new device, Curio automatically pulls the cloud archive into the local IndexedDB for immediate offline use.
- **State Conflict**: Local changes are pushed to the cloud with a "last-write-wins" debounce strategy to balance performance and consistency.

## 5. Privacy Policy
- **Local-First**: Collections never touch a server unless explicitly enabled by the user via cloud settings.
- **User Ownership**: Easy JSON export/import for manual backups and data portability.
