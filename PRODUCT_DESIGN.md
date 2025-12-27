
# Curio - Product Design Document

## 1. Vision & Purpose
Curio is a digital companion for physical collectors. Unlike marketplace-driven apps, Curio is an **intimate archival tool**. It is designed for the "joy of the collection"—focusing on personal notes, sensory details, and aesthetic presentation rather than resale value.

## 2. MVP Goals
1.  **Capture Velocity**: Enable users to go from "seeing an item" to "cataloging an item" in under 10 seconds.
2.  **Assisted Accuracy**: Use Gemini AI to populate technical fields so users can focus on their personal notes.
3.  **Aesthetic Reward**: Ensure that browsing the collection feels as satisfying as looking at a well-organized physical shelf.
4.  **Zero-Configuration Sync**: Provide a friction-free transition from local storage to cloud backup.

## 3. Design Language
*   **Typography**: *DM Serif Display* for headers; *Inter* for functional data.
*   **Color**: `Stone-50` base, `Amber-600` for Guests, `Emerald-600` for Members.
*   **Grid vs Waterfall**: Grid for technical comparison; Waterfall for "Art Gallery" aesthetic.

## 4. Onboarding Tiers & Cloud Transition
Curio follows a progressive disclosure model for data synchronization.

### Tier 1: Local Curator (Offline Mode)
*   **Trigger**: No Supabase environment variables detected.
*   **Experience**: Data is stored strictly in IndexedDB. No account is required.
*   **Visual**: "Local Archive" badge in the header.

### Tier 2: Guest Curator (Anonymous Sync)
*   **Trigger**: Supabase environment variables present.
*   **Experience**: On first boot, the app silently creates an anonymous cloud session. Data is backed up to the cloud but tied to the specific browser instance.
*   **Visual**: Amber "Guest Sync" pulse in the header.

### Tier 3: Member Curator (Permanent Cloud)
*   **Trigger**: User signs up/logs in with Email.
*   **Experience**: Previous "Guest" data is promoted to the permanent account. Full cross-device sync and asset persistence are enabled.
*   **Visual**: Emerald "Cloud Active" status in the header.

## 5. Privacy Policy
*   **Local-First**: Data never touches a server in Tier 1.
*   **Encryption**: All cloud data is protected by Supabase RLS (Row Level Security).
*   **Portability**: Users can export their entire archive regardless of their tier.
