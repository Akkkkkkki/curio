
# Curio - Technical Design Document

## 1. System Architecture
*   **Storage**: IndexedDB (Native API) with Persistent Storage request.
*   **Backend**: Supabase (PostgreSQL + Auth + Storage).
*   **AI Inference**: Gemini-3-flash-preview for vision-to-metadata extraction.

## 2. Identity & Sync Logic
The application uses a "Promotion" strategy for identity management.

### Anonymous Authentication
When the cloud endpoint is active, `services/supabase.ts` calls `signInAnonymously()`. This provides a unique UUID even before the user provides an email. This UUID is used as the `user_id` in the `collections` and `items` tables.

### Data Promotion
When a "Guest" Curio user decides to register:
1.  The Supabase Auth service links the anonymous session to the new email/password.
2.  Row Level Security (RLS) policies ensure that all previously created items (associated with that UUID) remain accessible to the newly promoted user.
3.  This makes the "Switch" to cloud mode invisible and lossless for the user.

## 3. Asset Pipeline
*   **Local Caching**: `getAsset` in `services/db.ts` always checks IndexedDB first.
*   **Cloud Fallback**: If an asset is missing locally (e.g., on a new device), it is pulled from Supabase Storage and cached back into IndexedDB.
*   **Normalization**: Images are stored as Blobs locally and served as signed/public URLs from the cloud depending on visibility settings.

## 4. UI Synchronization Feedback
*   **Pulse Indicator**: A CSS animation is applied to the sync icon when `isCloudAvailable` is true but the user is still in a `Guest` state, signaling that data is being backed up but not yet "Member-secured."
*   **Sync Debounce**: Metadata changes are debounced by 1500ms before hitting the network to prevent rate-limiting during rapid cataloging.

## 5. Security
*   **RLS Policies**: `user_id = auth.uid()` is enforced on every table.
*   **Storage Buckets**: Assets are stored in user-specific folders (`bucket/user_uuid/asset_id`) to ensure strict isolation.
