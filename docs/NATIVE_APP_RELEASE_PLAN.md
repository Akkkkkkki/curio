# Native App Release Plan

Status: **In Progress** (Android first, iOS deferred)
Last updated: 2025-01-25

## Overview

This plan covers the work to publish Curio on Google Play using Capacitor. iOS development is deferred due to Apple Developer Program costs ($99/year) and additional requirements.

**Technology choice:** Capacitor 8.x was selected as the wrapper technology. It is the modern successor to Cordova, offering better performance, native TypeScript support, and seamless integration with the existing React/Vite stack.

---

## Progress Summary

### Phase 1: Fix Blocking Issues - COMPLETE

- [x] 1.1 Fix capacitor.config.ts - remove dev server config for production
- [x] 1.2 Replace app icons with Curio branding (all sizes)
- [x] 1.3 Replace splash screens with Curio branding

### Phase 2: Release Build Setup

- [ ] 2.1 Android: Create release keystore and configure signing
- [x] 2.2 ~~iOS: Configure signing team and provisioning~~ (DEFERRED)
- [x] 2.3 Set version numbers (1.0.0 across package.json, iOS, Android)
- [ ] 2.4 Test release build on real Android device

### Phase 3: Store Submission Assets

- [ ] 3.1 Write app description (short + full)
- [ ] 3.2 Create privacy policy page (publicly accessible URL)
- [ ] 3.3 Capture screenshots (Android phone, 1080x1920 minimum)
- [ ] 3.4 Complete Google Play data safety questionnaire

### Phase 4: Submit to Google Play

- [ ] 4.1 Create Google Play Developer account ($25 one-time fee)
- [ ] 4.2 Upload AAB to Play Console internal testing track
- [ ] 4.3 Beta test, fix issues
- [ ] 4.4 Submit for production review

---

## Development Verification

### Prerequisites

1. **Node.js 22+** - Required for Capacitor CLI 8.x
2. **Android Studio** - [Install here](https://developer.android.com/studio)
3. **Java JDK 17+** - Required for Android builds

### Initial Setup

```bash
# Install dependencies
npm install

# Build the web app
npm run build

# Sync web assets to native projects
npx cap sync
```

### Running on Android Emulator

```bash
# Open in Android Studio
npx cap open android
```

1. In Android Studio, ensure a virtual device is available (Device Manager)
2. Select the device from the toolbar
3. Click Run (green play icon) or press `Shift+F10`

### Testing Camera Functionality

1. Click "Add your first item" button
2. In the Add Item modal:
   - Click "Take Photo" → Camera view should open
   - Click "Upload Photo" → Gallery should open
3. Verify images can be selected and processed

---

## Technical Details

### Android Release Signing

Create a keystore (one-time, **store securely and back up**):

```bash
keytool -genkey -v -keystore curio-release.keystore -alias curio -keyalg RSA -keysize 2048 -validity 10000
```

Add signing config to `android/app/build.gradle`:

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

### Building Release AAB

```bash
# From project root
cd android
./gradlew bundleRelease
```

The AAB file will be at: `android/app/build/outputs/bundle/release/app-release.aab`

### Regenerating App Icons

If you need to update the app icon:

```bash
# Edit source files in assets/ folder, then:
node scripts/generate-icon-sources.mjs
npx capacitor-assets generate --iconBackgroundColor '#111827' --splashBackgroundColor '#111827'
npx cap sync
```

### Version Strategy

- Use semantic versioning: `1.0.0`
- Android `versionCode` increments with each Play Store upload (1, 2, 3...)
- Update in `android/app/build.gradle` and `package.json`

---

## Google Play Store Requirements

### App Information (Metadata)

| Item                  | Requirement                                                              |
| --------------------- | ------------------------------------------------------------------------ |
| **App Name**          | Curio (max 30 chars)                                                     |
| **Short Description** | Brief summary (max 80 chars). Example: "Your personal collection museum" |
| **Full Description**  | Detailed features (max 4000 chars)                                       |

### Legal & Contact

| Item                   | Requirement                                                       |
| ---------------------- | ----------------------------------------------------------------- |
| **Privacy Policy URL** | Required. Publicly accessible URL explaining data collection      |
| **Support Email**      | Required. Valid email for user support                            |
| **Demo Account**       | Required if app has login. Provide test credentials for reviewers |

### Visual Assets

| Asset               | Specification                                            |
| ------------------- | -------------------------------------------------------- |
| **App Icon**        | 512x512 PNG (auto-generated from `assets/icon-only.png`) |
| **Feature Graphic** | 1024x500 PNG (displayed at top of store listing)         |
| **Screenshots**     | Minimum 2, recommended 4-8. Size: 1080x1920 or larger    |

### Data Safety Questionnaire

Google Play requires disclosure of:

- Data types collected (photos, user accounts)
- Data sharing practices
- Data security measures
- Data deletion options

---

## iOS Development (DEFERRED)

iOS release is deferred due to costs and complexity:

- Apple Developer Program: $99/year
- Requires macOS with Xcode
- App Store review process is stricter
- TestFlight setup required for beta testing

When ready to proceed:

1. Enroll in Apple Developer Program
2. Configure signing in Xcode (Team ID, provisioning profiles)
3. Run `cd ios/App && pod install`
4. Build and archive in Xcode
5. Upload to App Store Connect

The iOS project files are maintained and will work when these requirements are met.
