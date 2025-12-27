
# Curio - Product Design Document

## 1. Vision & Purpose
Curio is a digital sanctuary for physical collectors. Unlike marketplace-driven apps, Curio is an **intimate archival tool**. It is designed for the "joy of ownership"—focusing on personal narratives, high-end aesthetics, and the emotional value of a curated collection.

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

## 4. Onboarding Tiers & Cloud Transition
Curio follows a progressive disclosure model for data synchronization.

### Tier 1: Local Curator (Offline Mode)
*   **Experience**: No account required. Data strictly in IndexedDB.

### Tier 2: Guest Curator (Anonymous Sync)
*   **Experience**: Automatic anonymous backup. Amber indicators signal temporary cloud state.

### Tier 3: Member Curator (Permanent Cloud)
*   **Experience**: Full cross-device sync. Emerald status icons.

## 5. Future Roadmap
*   **Social Curation**: Generate cinematic video "portraits" of items for sharing.
*   **NFC/QR Tagging**: Print tiny archival stickers that link directly to the Curio record.
