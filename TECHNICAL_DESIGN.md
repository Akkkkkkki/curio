
# Curio - Technical Design Document

## 1. System Architecture
*   **Storage**: IndexedDB (Native API) with Persistent Storage request.
*   **Asset Pipeline**: Dual-asset storage (Master 1600px, Thumbnail 400px).
*   **AI Inference**: Gemini-3-flash-preview for vision-to-metadata extraction.

## 2. Performance & Scaling
### Thumbnail Strategy
To maintain 60fps scrolling on mobile devices, the `ItemCard` component solely requests the 400px thumbnail. The 1600px master is lazy-loaded only during "Export" or "Detail" view.

### Storage Persistence
The app calls `navigator.storage.persist()` on boot. If denied, a subtle warning is shown to the user that data may be cleared by the browser under extreme storage pressure.

## 3. Schema Evolution
IndexedDB versioning is used to handle data migrations.
*   **V1**: Collections and Assets.
*   **V2**: Added Thumbnails store.
*   **Future (V3+)**: Planned support for `meta_version` inside collection JSON to handle dynamic field renames or new template structures.

## 4. Security
*   **Sandboxed Inference**: Photos are converted to Base64 in-memory and sent to Gemini API via HTTPS. No persistent server-side storage of images occurs.
