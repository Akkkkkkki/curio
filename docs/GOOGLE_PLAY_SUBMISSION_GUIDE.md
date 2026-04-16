# Google Play Store Submission Guide

**Purpose:** Step-by-step guide to publish Curio on Google Play for MVP market testing.

**Scope:** This is an MVP release to gather user feedback, not a full product launch. We prioritize speed and simplicity over perfection.

> **Strategic context:** This guide supports **Phase 1.5 — Android Market Test** in `docs/ROADMAP.md`. The goal is to use Google Play as an early market-test channel without broadening native scope. Product logic stays shared with web per `docs/PRODUCT_STRATEGY.md`.

## Scope & status

- **Platform focus:** Android first; iOS is deferred (Apple Developer Program costs and review overhead).
- **Tracking:** Use GitHub Issues/Projects for status and checklists to avoid stale docs.

---

## Table of Contents

1. [Prerequisites Checklist](#1-prerequisites-checklist)
2. [Create Google Play Developer Account](#2-create-google-play-developer-account)
3. [Create Release Keystore](#3-create-release-keystore)
4. [Build the Release AAB](#4-build-the-release-aab)
5. [Prepare Store Listing Content](#5-prepare-store-listing-content)
6. [Create Visual Assets](#6-create-visual-assets)
7. [Set Up Privacy Policy](#7-set-up-privacy-policy)
8. [Complete Data Safety Form](#8-complete-data-safety-form)
9. [Upload and Test](#9-upload-and-test)
10. [Submit for Review](#10-submit-for-review)
11. [Post-Launch](#11-post-launch)

---

## 1. Prerequisites Checklist

Before starting, ensure you have:

- [ ] Android Studio installed and working
- [ ] App runs correctly in Android emulator
- [ ] Real Android device for testing (recommended)
- [ ] Google account for Play Console
- [ ] Credit/debit card for $25 registration fee
- [ ] Government ID for identity verification

**Time estimate for entire process:** 3-5 days (including Google's verification and review times)

---

## 2. Create Google Play Developer Account

### Step 2.1: Register

1. Go to [play.google.com/console](https://play.google.com/console)
2. Sign in with your Google account
3. Click "Create developer account"

### Step 2.2: Choose Account Type

For MVP testing, choose **Personal account** (simpler setup):

| Account Type | Best For                    | Requirements               |
| ------------ | --------------------------- | -------------------------- |
| Personal     | Individual developers, MVPs | ID verification            |
| Organization | Companies, teams            | Business registration docs |

### Step 2.3: Pay Registration Fee

- **Cost:** $25 USD (one-time, never again)
- **Payment:** Credit/debit card

### Step 2.4: Complete Identity Verification

Google requires identity verification for new developers:

1. Provide your legal name
2. Upload government-issued ID (passport, driver's license)
3. Provide a contact address

**Wait time:** Usually 24-48 hours, can take up to 5 days.

**Tip:** Start this step first while you prepare everything else.

---

## 3. Create Release Keystore

### What is a Keystore?

A keystore is a secure file containing your digital signature. Every Android app must be signed to prove it's authentically from you.

### Step 3.1: Generate the Keystore

Open terminal and run:

```bash
keytool -genkey -v -keystore curio-release.keystore -alias curio -keyalg RSA -keysize 2048 -validity 10000
```

You'll be prompted to enter:

| Prompt              | What to Enter                    | Example            |
| ------------------- | -------------------------------- | ------------------ |
| Keystore password   | Strong password (save this!)     | `MySecure#Pass123` |
| Key password        | Can be same as keystore password | `MySecure#Pass123` |
| First and last name | Your name or company             | `John Smith`       |
| Organizational unit | Optional, can skip               | `Development`      |
| Organization        | Optional, can skip               | `Curio`            |
| City                | Your city                        | `San Francisco`    |
| State               | Your state/province              | `California`       |
| Country code        | 2-letter code                    | `US`               |

### Step 3.2: Store the Keystore Securely

**CRITICAL: If you lose this file or forget the password, you can NEVER update your app.**

Store copies in multiple locations:

- [ ] Password manager (1Password, Bitwarden)
- [ ] Encrypted cloud storage (Google Drive with encryption)
- [ ] Offline backup (USB drive in safe location)

**Record these values somewhere secure:**

```
Keystore file: curio-release.keystore
Keystore password: [YOUR_PASSWORD]
Key alias: curio
Key password: [YOUR_PASSWORD]
```

### Step 3.3: Configure Signing in build.gradle

Edit `android/app/build.gradle`:

```gradle
android {
    // ... existing config ...

    signingConfigs {
        release {
            storeFile file('curio-release.keystore')
            storePassword System.getenv('KEYSTORE_PASSWORD') ?: 'your-password-here'
            keyAlias 'curio'
            keyPassword System.getenv('KEY_PASSWORD') ?: 'your-password-here'
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

**For MVP:** You can hardcode passwords temporarily. For production, use environment variables.

### Step 3.4: Enable Play App Signing (Recommended)

When you upload your first AAB, Google will offer "Play App Signing":

- **What it does:** Google manages your signing key
- **Benefit:** If you lose your keystore, Google can help
- **Recommendation:** Enable this for peace of mind

---

## 4. Build the Release AAB

### Step 4.1: Build the Web App

```bash
npm run build
npx cap sync
```

### Step 4.2: Copy Keystore to Android Folder

```bash
cp curio-release.keystore android/app/
```

### Step 4.3: Build the AAB

```bash
cd android
./gradlew bundleRelease
```

### Step 4.4: Locate the Output

The AAB file will be at:

```
android/app/build/outputs/bundle/release/app-release.aab
```

**File size:** Typically 5-15 MB for a Capacitor app.

### Step 4.5: Test the Release Build (Important!)

Before uploading, test the release build on a real device:

```bash
# Build APK for direct installation testing
./gradlew assembleRelease

# Install on connected device
adb install app/build/outputs/apk/release/app-release.apk
```

Verify:

- [ ] App launches without crashes
- [ ] Camera works (take photo, pick from gallery)
- [ ] Images display correctly
- [ ] Login/authentication works
- [ ] Data syncs to cloud

---

## 5. Prepare Store Listing Content

### App Name

```
Curio
```

(30 characters max - we're using 5)

### Short Description (80 characters max)

This appears in search results. Use the full 80 characters.

**Option A (Feature-focused):**

```
Catalog your collections with AI. Snap a photo, get instant details. Free to use.
```

**Option B (Benefit-focused):**

```
Turn photos into organized collections. AI identifies items automatically. Simple.
```

**Option C (Audience-focused):**

```
For collectors: photograph items, AI extracts details, build your personal museum.
```

**Recommendation for MVP:** Option A - clear and mentions AI as differentiator.

### Full Description (4000 characters max)

```
Curio is your personal collection museum. Whether you collect vinyl records, sneakers, chocolates, perfumes, or anything else — Curio helps you catalog and organize with the power of AI.

HOW IT WORKS
1. Take a photo of any item
2. AI instantly identifies and extracts details
3. Your collection is organized and searchable

PERFECT FOR
• Vinyl & record collectors
• Sneaker enthusiasts
• Chocolate & food connoisseurs
• Perfume & fragrance collectors
• Wine & spirits aficionados
• Anyone who collects anything

KEY FEATURES

📸 Smart Photo Capture
Snap a photo and let AI do the heavy lifting. Curio automatically extracts titles, descriptions, and relevant details from your images.

🏛️ Beautiful Collection Views
Browse your items in elegant gallery layouts. Filter, search, and rediscover treasures in your collection.

☁️ Cloud Sync
Your collections sync securely to the cloud. Access them from any device, never lose your data.

🎨 Multiple Themes
Choose from Gallery (light), Vault (dark), or Atelier (warm) themes to match your style.

🌐 Works Offline
Browse your collections even without internet. Changes sync when you're back online.

GETTING STARTED
Creating your first collection takes under a minute:
1. Open Curio and tap "Add your first item"
2. Take a photo or choose from your gallery
3. Review the AI-extracted details
4. Save — you're done!

PRIVACY FIRST
Your photos stay on your device and in your private cloud storage. We don't sell your data or show ads.

FEEDBACK WELCOME
Curio is actively being developed. We'd love to hear what features you want next. Reach out through the app or email us directly.

Download Curio and start building your personal museum today.
```

(Approximately 1,600 characters - well within limit)

### Category

Select: **Lifestyle**

(Alternatives: Productivity, Tools)

### Tags/Keywords

Google doesn't use explicit keywords like Apple, but include these terms naturally in your description:

- collection manager
- collector app
- catalog app
- inventory
- AI photo
- organize collections

### Contact Email

Use a dedicated email for app support:

```
support@[your-domain].com
```

Or create a Gmail:

```
curio.app.support@gmail.com
```

### Contact Website (Optional for MVP)

If you have one, add it. If not, skip for now.

---

## 6. Create Visual Assets

### App Icon (512x512)

**Already done!** The icon is automatically extracted from your AAB.

### Feature Graphic (1024x500) - REQUIRED

This banner appears at the top of your store listing.

**Quick option for MVP:** Use Canva (free)

1. Go to [canva.com](https://canva.com)
2. Create custom design: 1024 x 500 pixels
3. Design tips:
   - Dark background (#111827 - matches app theme)
   - App icon or logo on left
   - Tagline: "Your Personal Collection Museum"
   - Keep text minimal and large

**Simple design spec:**

```
Background: #111827 (dark gray)
Left side: Curio "C" logo
Right side: "Your Personal Collection Museum" in white
Font: Clean sans-serif (Inter, Roboto)
```

### Screenshots (2-8 required)

**Minimum:** 2 screenshots
**Recommended for MVP:** 4 screenshots

**Required size:** At least 1080 x 1920 pixels (9:16 ratio)

**How to capture:**

1. Run app in Android emulator with a Pixel device
2. In Android Studio, click the camera icon to capture
3. Or use `adb shell screencap` command

**Screenshots to capture:**

| #   | Screen      | What to Show                      |
| --- | ----------- | --------------------------------- |
| 1   | Home screen | Collection grid with sample items |
| 2   | Add item    | Camera/photo selection UI         |
| 3   | AI analysis | AI extracting details from photo  |
| 4   | Item detail | Full item view with all fields    |

**Pro tip:** Add device frames and captions using:

- [screenshots.pro](https://screenshots.pro) (free)
- Canva templates
- Figma device mockup plugins

**Simple approach for MVP:** Plain screenshots without frames are acceptable.

### Video (Optional)

Skip for MVP. Add later if needed.

---

## 7. Set Up Privacy Policy

A privacy policy URL is **required** by Google Play.

> **Already created:** `public/privacy-policy.html` and `public/terms-of-service.html` are included in the repo and will be served from the deployed app (e.g., `https://your-domain.com/privacy-policy.html`).

### Option A: GitHub Pages (Free, Recommended for MVP)

1. Create file `privacy-policy.md` in your repo
2. Enable GitHub Pages in repo settings
3. Your URL will be: `https://[username].github.io/curio/privacy-policy`

### Option B: Google Sites (Free)

1. Go to [sites.google.com](https://sites.google.com)
2. Create a simple one-page site
3. Publish and use that URL

### Option C: Notion (Free)

1. Create a Notion page
2. Share publicly
3. Use the public link

### Privacy Policy Content

Create a file or page with this content:

```markdown
# Privacy Policy for Curio

**Last updated:** [Current Date]

## Overview

Curio ("we", "our", "the app") is a personal collection management application. This policy explains how we handle your information.

## Information We Collect

### Information You Provide

- **Account information:** Email address and password when you create an account
- **Collection data:** Photos, titles, descriptions, and other details you add to your collections
- **Usage data:** How you interact with the app to improve our service

### Information Collected Automatically

- **Device information:** Device type, operating system version
- **Log data:** App crashes, error reports

## How We Use Your Information

We use your information to:

- Provide and maintain the Curio service
- Sync your collections across devices
- Improve app performance and fix bugs
- Respond to your support requests

## Data Storage

- **Photos and collection data** are stored securely in cloud storage (Supabase)
- **Local cache** is stored on your device for offline access
- All data transmission uses HTTPS encryption

## Third-Party Services

Curio uses the following third-party services:

| Service       | Purpose                     | Privacy Policy                                                             |
| ------------- | --------------------------- | -------------------------------------------------------------------------- |
| Supabase      | Database and authentication | [supabase.com/privacy](https://supabase.com/privacy)                       |
| Google Gemini | AI image analysis           | [ai.google.dev/terms](https://ai.google.dev/terms)                         |
| Vercel        | Web hosting                 | [vercel.com/legal/privacy-policy](https://vercel.com/legal/privacy-policy) |

## Data Sharing

We do **not**:

- Sell your personal information
- Share your data with advertisers
- Use your photos for AI training

We **may** share data:

- With service providers who help operate the app (listed above)
- If required by law

## Your Rights

You can:

- **Access** your data through the app
- **Export** your collections
- **Delete** your account and all associated data

To delete your account, contact us at [support email].

## Children's Privacy

Curio is not intended for children under 13. We do not knowingly collect information from children.

## Changes to This Policy

We may update this policy occasionally. We'll notify you of significant changes through the app.

## Contact Us

Questions about this policy? Contact us at:

- Email: [your support email]

---

© [Year] Curio. All rights reserved.
```

**Customize before publishing:**

- Replace `[Current Date]` with today's date
- Replace `[support email]` with your actual email
- Replace `[Year]` with current year

---

## 8. Complete Data Safety Form

Google Play requires you to declare what data your app collects. Here's exactly what to answer for Curio:

### Section: Data Collection

**Does your app collect or share any of the required user data types?**
→ **Yes**

### Section: Data Types

For each data type, answer:

| Data Type                | Collected? | Shared? | Purpose                               |
| ------------------------ | ---------- | ------- | ------------------------------------- |
| **Personal info: Email** | Yes        | No      | Account functionality                 |
| **Personal info: Name**  | No         | -       | -                                     |
| **Photos and videos**    | Yes        | No      | App functionality (collection photos) |
| **App activity**         | Yes        | No      | Analytics, app functionality          |
| **Device info**          | Yes        | No      | App functionality, diagnostics        |

### Section: Data Usage and Handling

**Is all of the user data collected by your app encrypted in transit?**
→ **Yes** (We use HTTPS)

**Do you provide a way for users to request that their data be deleted?**
→ **Yes** (Account deletion)

### Section: Security Practices

**Is your app designed to comply with the Children's Online Privacy Protection Act (COPPA)?**
→ **No** (App is not directed at children)

**Does your app target children?**
→ **No**

### Detailed Answers by Data Type

**Email Address:**

- Collection: Required
- Purpose: Account management
- Sharing: Not shared
- Processing: On-device and transferred off device

**Photos:**

- Collection: Required
- Purpose: App functionality (core feature)
- Sharing: Not shared externally
- Processing: Transferred to cloud for sync

**Note:** Fill out the form carefully. False declarations can result in app removal.

---

## 9. Upload and Test

### Step 9.1: Create App in Play Console

1. Log into [Play Console](https://play.google.com/console)
2. Click "Create app"
3. Fill in:
   - App name: `Curio`
   - Default language: English (United States)
   - App or game: App
   - Free or paid: Free

### Step 9.2: Complete App Content Section

Navigate to "App content" and complete:

- [ ] Privacy policy (paste your URL)
- [ ] Ads declaration (select "No ads")
- [ ] App access (select "All functionality available without restrictions" OR provide test credentials)
- [ ] Content ratings (complete questionnaire)
- [ ] Target audience (select 18+, not designed for children)
- [ ] Data safety (from Section 8 above)

### Step 9.3: Content Rating Questionnaire

Google asks about your app's content. For Curio:

| Question              | Answer                                                   |
| --------------------- | -------------------------------------------------------- |
| Violence              | None                                                     |
| Sexual content        | None                                                     |
| Language              | None                                                     |
| Controlled substances | None (unless you catalog wine/spirits, then "reference") |
| User interaction      | Yes (user-generated content - their collections)         |

**Result:** Likely rated "Everyone" or "Teen"

### Step 9.4: Upload to Internal Testing

1. Go to "Testing" → "Internal testing"
2. Click "Create new release"
3. Upload your AAB file (`app-release.aab`)
4. Add release notes: "Initial MVP release for testing"
5. Click "Save" then "Review release"
6. Click "Start rollout to Internal testing"

### Step 9.5: Add Testers

1. Go to "Internal testing" → "Testers"
2. Create an email list with your email
3. Copy the opt-in link
4. Open the link on your Android device
5. Install the app from Play Store

### Step 9.6: Test Everything

On the internal testing build, verify:

- [ ] App installs from Play Store
- [ ] App opens without crashes
- [ ] Sign up / Sign in works
- [ ] Camera captures photos
- [ ] Gallery selection works
- [ ] AI analysis runs
- [ ] Items save to collection
- [ ] Collections sync to cloud
- [ ] Offline mode works
- [ ] All three themes work

**Fix any issues before proceeding to production.**

---

## 10. Submit for Review

### Step 10.1: Complete Store Listing

Go to "Main store listing" and fill in:

- [ ] App name
- [ ] Short description
- [ ] Full description
- [ ] App icon (auto-populated from AAB)
- [ ] Feature graphic (upload 1024x500)
- [ ] Screenshots (upload 2-8)
- [ ] App category

### Step 10.2: Set Up Pricing

Go to "Monetization setup":

- Select "Free"
- Select countries (start with your country, or "All countries")

### Step 10.3: Create Production Release

1. Go to "Production"
2. Click "Create new release"
3. Upload the same AAB (or a newer one if you fixed bugs)
4. Add release notes:

```
Initial release of Curio - Your Personal Collection Museum

Features:
• AI-powered item cataloging
• Multiple collection templates
• Cloud sync across devices
• Beautiful gallery views
• Dark and light themes
```

### Step 10.4: Submit for Review

1. Review all sections show green checkmarks
2. Click "Review release"
3. Click "Start rollout to Production"

### What Happens Next

- Google reviews your app (1-7 days, typically 2-3 days)
- You'll get an email when approved (or if changes required)
- Once approved, app goes live on Play Store

### Common Rejection Reasons (And How to Avoid)

| Reason                          | Prevention                               |
| ------------------------------- | ---------------------------------------- |
| Privacy policy missing/invalid  | Ensure URL works and content is complete |
| Broken functionality            | Test thoroughly before submitting        |
| Misleading description          | Be accurate about what app does          |
| Missing permissions explanation | Explain why camera access is needed      |
| Intellectual property issues    | Don't use trademarked names/images       |

---

## 11. Post-Launch

### Monitor Reviews

- Check Play Console daily for first week
- Respond to user reviews (shows engagement)
- Note feature requests and bugs

### Track Key Metrics

Play Console provides:

- Install count
- Uninstall rate
- Crash reports
- User ratings

### Iterate Based on Feedback

For MVP, focus on:

1. Crash fixes (highest priority)
2. Major usability issues
3. Most-requested features

### Updating the App

When you have updates:

```bash
# 1. Update version in android/app/build.gradle
#    Increment versionCode (e.g., 1 → 2)
#    Update versionName if needed (e.g., "1.0.0" → "1.0.1")

# 2. Build new AAB
npm run build
npx cap sync
cd android
./gradlew bundleRelease

# 3. Upload new AAB to Play Console
# 4. Submit for review (usually faster for updates)
```

---

## Quick Reference: Files and Locations

| Item           | Location                                                   |
| -------------- | ---------------------------------------------------------- |
| Keystore       | `android/app/curio-release.keystore` (create this)         |
| Build config   | `android/app/build.gradle`                                 |
| Release AAB    | `android/app/build/outputs/bundle/release/app-release.aab` |
| App icons      | `android/app/src/main/res/mipmap-*/`                       |
| Splash screens | `android/app/src/main/res/drawable-*/`                     |
| Icon sources   | `assets/` folder                                           |

---

## Quick Reference: Commands

```bash
# Build web app
npm run build

# Sync to Android
npx cap sync

# Open in Android Studio
npx cap open android

# Build release AAB
cd android && ./gradlew bundleRelease

# Build release APK (for direct testing)
cd android && ./gradlew assembleRelease

# Install APK on device
adb install android/app/build/outputs/apk/release/app-release.apk
```

---

## Estimated Costs

| Item                   | Cost    | Frequency           |
| ---------------------- | ------- | ------------------- |
| Google Play Developer  | $25     | One-time            |
| Privacy policy hosting | $0      | Free (GitHub Pages) |
| Feature graphic design | $0      | Free (Canva)        |
| **Total**              | **$25** |                     |

---

## Timeline Summary

| Day | Tasks                                                           |
| --- | --------------------------------------------------------------- |
| 1   | Register Play Console, start verification, create keystore      |
| 2   | Build AAB, prepare store listing content, create privacy policy |
| 3   | Create screenshots and feature graphic, complete data safety    |
| 4   | Upload to internal testing, test on real device                 |
| 5   | Submit to production, wait for review                           |
| 6-8 | Review period (usually 2-3 days)                                |
| 8+  | **App live on Play Store!**                                     |

---

## Support Resources

- [Play Console Help](https://support.google.com/googleplay/android-developer)
- [Android App Bundle Guide](https://developer.android.com/guide/app-bundle)
- [Data Safety Form Guide](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Content Rating Guide](https://support.google.com/googleplay/android-developer/answer/9898843)

---

**You're ready to publish!** Follow this guide step by step, and you'll have Curio on the Play Store within a week.
