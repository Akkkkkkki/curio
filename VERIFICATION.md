# Verification Guide

This guide provides step-by-step instructions on how to build, run, and verify the new native mobile app functionality on your local machine.

---

## Prerequisites

Before you begin, ensure you have the following installed:

1.  **Node.js and npm:** [Install here](https://nodejs.org/)
2.  **Xcode:** Required for running the iOS app. Install it from the Mac App Store.
3.  **Android Studio:** Required for running the Android app. [Install here](https://developer.android.com/studio).

---

## 1. Initial Setup

First, you need to install the project dependencies and prepare the native projects.

```bash
# 1. Install all npm dependencies
npm install

# 2. Build the web app for production
npm run build

# 3. Sync the web app with the native projects
npx cap sync
```

---

## 2. Verifying the iOS App

Follow these steps to run the app on the iOS Simulator.

### Step A: Open the Xcode Project

Capacitor manages the native project for you. To open it in Xcode, run the following command:

```bash
npx cap open ios
```

This will launch Xcode and open the `ios` project.

### Step B: Run the App

1.  In Xcode, select a target simulator from the top of the window (e.g., "iPhone 15 Pro").
2.  Click the "Run" button (the play icon) or press `Cmd+R`.
3.  Xcode will now build the app and launch it in the selected simulator.

### Step C: Test the Camera Functionality

1.  Once the app is running, click the "**Add your first item**" button.
2.  The "Add Item" modal will appear.
3.  Click the "**Take Photo**" button.
    *   Since this is a simulator, a sample image will be displayed. This confirms the native camera API is working.
4.  Click the "**Upload Photo**" button.
    *   The photo gallery will open with sample images. Select one to confirm that gallery access is working.

---

## 3. Verifying the Android App

Follow these steps to run the app on the Android Emulator.

### Step A: Open the Android Studio Project

To open the project in Android Studio, run the following command:

```bash
npx cap open android
```

This will launch Android Studio and open the `android` project.

### Step B: Run the App

1.  In Android Studio, ensure a virtual device is available in the "Device Manager." If not, create one.
2.  Select the virtual device from the toolbar.
3.  Click the "Run" button (the green play icon) or press `Shift+F10`.
4.  Android Studio will build the app and launch it in the emulator.

### Step C: Test the Camera Functionality

1.  Once the app is running, click the "**Add your first item**" button.
2.  The "Add Item" modal will appear.
3.  Click the "**Take Photo**" button.
    *   The emulator will open a simulated camera view. This confirms the native camera API is working.
4.  Click the "**Upload Photo**" button.
    *   The photo gallery will open. Select an image to confirm that gallery access is working.

---

By following these steps, you can verify that the PWA has been successfully wrapped and that the new native camera functionality is working as expected on both iOS and Android.
