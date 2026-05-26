# Android build

The Android app is built with Capacitor from the existing Vue/Vite frontend.

Production backend:

- API: `https://api.ctalkchinese.com/api`
- Socket.IO: `https://api.ctalkchinese.com`

Android package id:

```text
com.ctalkchinese.classmanager
```

## Prerequisites

Install:

- Node.js 20+
- Android Studio
- JDK 17
- Android SDK through Android Studio

After installing Android Studio, open SDK Manager and install a recent Android SDK
platform plus Android SDK Build-Tools.

## Build and sync

```powershell
cd frontend
npm install
npm run android:sync
```

This runs the Vite production build and copies `dist` into the native Android
project.

## Open in Android Studio

```powershell
cd frontend
npm run android:open
```

Then use Android Studio to run on a connected Android device or emulator.

## Build debug APK

```powershell
cd frontend
npm run android:apk
```

Output:

```text
frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

## Build release AAB

```powershell
cd frontend
npm run android:aab
```

Output:

```text
frontend/android/app/build/outputs/bundle/release/app-release.aab
```

For Play Store release, create a signing key in Android Studio and configure
release signing in `frontend/android/app/build.gradle` or through Android
Studio's Generate Signed Bundle/APK flow.

## Notes

- The current app uses the same production API as the web version.
- Uploaded files, login, forum, and flashcards depend on the VPS API being live.
- If API CORS changes, keep backend `CORS_ORIGIN` including:

```text
https://ctalkchinese.com,https://www.ctalkchinese.com
```
