
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

## 4. Privacy Policy
*   **Local-First**: Collections never touch a server owned by Curio.
*   **User Ownership**: Easy JSON export/import for manual backups and data portability.
