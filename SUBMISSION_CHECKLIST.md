# App Store Submission Checklist

This document outlines the necessary assets and information required to submit the Curio app to the Apple App Store and Google Play Store.

## 1. Developer Accounts

Before you can submit the app, you need to be enrolled in the developer programs for both platforms.

- **Apple Developer Program:** Requires an annual fee. [Enroll here](https://developer.apple.com/programs/enroll/).
- **Google Play Developer Account:** Requires a one-time registration fee. [Sign up here](https://play.google.com/apps/publish/signup/).

---

## 2. App Information (Metadata)

This text will be displayed on your app store pages.

| Item | Apple App Store | Google Play Store | Notes |
| :--- | :--- | :--- | :--- |
| **App Name** | `Curio` | `Curio` | The name of your app (max 30 chars). |
| **Subtitle / Short Description** | A brief, catchy summary (max 30 chars). | A short summary of your app (max 80 chars). | Example: "Your personal museum." |
| **Full Description** | A detailed description of your app's features and functionality (max 4000 chars). | A detailed description of your app (max 4000 chars). | Explain what your app does, who it's for, and its key features. |
| **Keywords** | A comma-separated list of keywords that describe your app (max 100 chars total). | N/A (Google uses the description for keywords). | Example: `collector, collection, museum, art, manage, track` |
| **Promotional Text** | A short text to announce new features or promotions (max 170 chars). | N/A | |

---

## 3. Legal & Contact

| Item | Requirement | Notes |
| :--- | :--- | :--- |
| **Privacy Policy URL** | **Required.** Must be a publicly accessible URL. | This policy must clearly state what user data you collect and how you use it. You can use a free policy generator online if you don't have one. |
| **Support URL** | **Required.** A URL where users can get support. | This could be a link to your website's contact page or a help center. |
| **Contact Email** | **Required.** A valid email address for the app stores to contact you. | |
| **Demo Account** | **Required if your app has a login.** | Provide a username and password for a demo account so the review team can test the app's full functionality. **Username:** `test@example.com` **Password:** `TestPassword123` |

---

## 4. Visual Assets

These are the images that will represent your app in the stores.

### App Icon
- **Source Image:** A single `1024x1024` pixel PNG file. This will be used to generate all the required icon sizes for both platforms.
- **Location:** Place the source image at `assets/icon.png`.

### Screenshots
- **Requirement:** You will need to capture high-quality screenshots of the app in action.
- **Quantity:** A minimum of 2-3 screenshots per platform is recommended.
- **Apple Devices:**
    - `1290 x 2796` pixels (6.7" iPhone)
    - `2048 x 2732` pixels (12.9" iPad Pro)
- **Android Devices:**
    - `1080 x 1920` pixels (standard smartphone)
- **Notes:** Screenshots should be taken on actual devices or high-fidelity simulators. They should highlight the app's main features and user interface.

---

## 5. Final App Bundles

The following files will be generated and uploaded to the respective stores:

- **iOS:** An `.ipa` file.
- **Android:** An `.aab` (Android App Bundle) file.
