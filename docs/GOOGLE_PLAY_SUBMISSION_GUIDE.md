# Android Market Test Runbook

This document is the single source of truth for Curio's Android readiness and Google Play submission flow.

> **Strategic context:** This supports **Phase 1.5 - Android Market Test** in `docs/ROADMAP.md`. Keep the product web-first, use Android as a distribution and pricing test, and avoid native-only scope unless it is required for launch trust.

## What this doc owns

- The release gate for shipping Curio to Google Play
- The practical steps for signing, building, testing, and submitting the Android app
- The Android-specific product, security, and operational checks that must be true before launch

Status tracking belongs in GitHub Issues, not here.

## Release gate

Curio is ready for a Play submission when all of the following are true:

- Android install, onboarding, add-item, save, sync, and sharing flows work on a real device
- Release signing is configured and a release AAB builds cleanly
- Privacy policy and terms pages are live from the deployed app
- Play Console metadata, screenshots, and Data Safety answers match the actual product behavior
- Android-specific blockers are closed or explicitly accepted for the market test

## Launch blockers

These are the Android-specific issues worth treating as stop-ship for a public market test:

### 1. Production styling must be bundled

- Do not rely on the Tailwind CDN in production.
- The app must render correctly offline and on flaky mobile connections.
- Build-time CSS generation is required before Play submission.

### 2. PWA and app icons must be valid

- `manifest.webmanifest` icon paths and MIME types must match actual files in `public/`.
- Install surfaces should show the real Curio icon, not a generic placeholder.

### 3. Release signing must be configured

- `android/app/build.gradle` needs a working `signingConfigs.release`.
- Release builds should enable minification unless there is a specific blocker.

### 4. Android permissions and denial states must be handled

- Camera and media permissions must be declared and requested correctly.
- The app must offer a usable fallback if camera access is denied.

### 5. Content Security Policy and gateway hardening must be in place

- The web shell should ship with a restrictive CSP after CDN dependencies are removed.
- The Gemini gateway must require auth, validate inputs, rate limit requests, and avoid leaking internal details.

### 6. Users must be able to trust save and sync outcomes

- Save succeeds locally before cloud sync.
- Offline or failed sync states are visible.
- Silent failure paths are not acceptable for a public launch.

## Pre-submission checklist

Before starting the console flow, make sure you have:

- Android Studio installed and a working emulator
- One real Android device for release-candidate testing
- A Google account for Play Console
- A credit or debit card for the $25 registration fee
- Government ID for developer verification
- A deployed environment that serves `public/privacy-policy.html` and `public/terms-of-service.html`

## Create the Play Console account

1. Go to [play.google.com/console](https://play.google.com/console).
2. Create a developer account.
3. For a solo MVP, use a personal account unless you already need an organization.
4. Pay the one-time registration fee.
5. Complete identity verification early. It can take several days.

## Signing and release build

### Generate the keystore

```bash
keytool -genkey -v -keystore curio-release.keystore -alias curio -keyalg RSA -keysize 2048 -validity 10000
```

Store the keystore and both passwords in at least two secure locations. Losing them can block future updates.

### Configure signing

`android/app/build.gradle` should use environment variables for release signing:

```gradle
android {
    signingConfigs {
        release {
            storeFile file('curio-release.keystore')
            storePassword System.getenv('KEYSTORE_PASSWORD')
            keyAlias 'curio'
            keyPassword System.getenv('KEY_PASSWORD')
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

Enable Play App Signing when Google offers it on first upload.

### Build the release artifacts

```bash
npm run build
npx cap sync
cp curio-release.keystore android/app/
cd android
./gradlew bundleRelease
./gradlew assembleRelease
```

Expected outputs:

- `android/app/build/outputs/bundle/release/app-release.aab`
- `android/app/build/outputs/apk/release/app-release.apk`

## Release-candidate test matrix

Install the release APK on a real device before uploading anything to Play:

```bash
adb install app/build/outputs/apk/release/app-release.apk
```

Verify:

- App launches without a white-screen stall or crash
- Back button behavior is sane
- Camera capture works
- Gallery import works
- Permission denial leaves the flow usable
- Authentication works
- Add item works with and without AI success
- Save and sync states are visible and correct
- Offline edits recover when connectivity returns
- Images render correctly after relaunch

## Store listing content

### App name

`Curio`

### Short description

Recommended:

```text
Catalog your collections with AI. Snap a photo, get instant details.
```

### Full description

Use language that matches the current product. Do not promise features that are not live. Keep the copy anchored on:

- photo-first capture
- AI-assisted metadata extraction
- cloud sync
- offline-friendly browsing
- personal museum positioning

### Category

Use `Lifestyle` for the market test unless later research shows a stronger fit.

### Contact info

- Support email should be real and monitored.
- Website is optional for MVP, but if present it should match the privacy-policy host.

## Visual assets

Minimum required assets for Play submission:

- App icon
- Feature graphic, `1024x500`
- At least 2 phone screenshots, preferably 4

Recommended screenshot set:

1. Home screen with a credible collection
2. Add-item flow
3. AI-assisted detail draft
4. Item detail screen

Plain screenshots are fine for MVP. Device frames are optional.

## Privacy policy and terms

Curio already includes:

- `public/privacy-policy.html`
- `public/terms-of-service.html`

Use the deployed URLs from the production host in Play Console. Do not create a second copy on GitHub Pages, Notion, or Google Sites unless the production host is unavailable.

Before submission, confirm the policy text matches the actual app:

- account email collection
- collection photos and metadata
- cloud sync via Supabase
- AI image analysis via Gemini
- diagnostics or analytics, if enabled
- data deletion path that actually exists for users

## Data Safety answers

Google Play requires these answers to match real behavior, not intended behavior.

### Data types currently expected

| Data Type            | Collected? | Shared? | Purpose                               |
| -------------------- | ---------- | ------- | ------------------------------------- |
| Personal info: Email | Yes        | No      | Account functionality                 |
| Photos and videos    | Yes        | No      | App functionality                     |
| App activity         | Yes        | No      | Diagnostics or analytics, if enabled  |
| Device or other IDs  | Maybe      | No      | Diagnostics, only if tooling collects |

### Additional checks

- Data is encrypted in transit: `Yes`
- Deletion request path exists: only answer `Yes` if users can actually request deletion today
- App is not directed to children

Photos sent to Gemini for analysis must be disclosed accurately. Do not under-report third-party processing.

## Create the app in Play Console

1. Create a new app in Play Console.
2. Fill in app name, language, app type, and free/paid status.
3. Complete App Content:
   - privacy policy
   - ads declaration
   - app access
   - content rating
   - target audience
   - data safety
4. Upload the AAB to the appropriate track:
   - internal for smoke tests
   - closed for invited testers
   - production only when the release gate above is satisfied

## Submission notes

- Internal or closed testing is the right first stop for Curio's Android market test.
- Keep the release notes honest and short.
- If Play review rejects the app, update this runbook only if the rejection reveals a durable rule we need to remember.

## Post-launch checks

In the first week after launch, watch:

- crash rate
- authentication failures
- save and sync failure rate
- camera and upload errors
- review feedback about trust, speed, and confusion

Use `docs/ops/AI_GATEWAY_MONITORING.md` for gateway monitoring. Use GitHub Issues for follow-up work.
cd android
./gradlew bundleRelease

# 3. Upload new AAB to Play Console

# 4. Submit for review (usually faster for updates)

````

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
````

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
