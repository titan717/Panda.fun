# Panda.fun Universal Android Application

This directory contains the native Android wrapper for Panda.fun. The intended package is a single APK for Android TV and touchscreen Android devices, with both ordinary and Leanback launcher entries. The main activity loads the bundled React application in a WebView. Existing TV remote navigation, fullscreen handling and update installation behavior must be preserved.

The web app's current playback route uses the configured Vidy embed. Android TV / Media3 components remain in this repository, but this wrapper change does not replace the current Vidy playback flow with native ExoPlayer.

## Build the universal debug APK

Requirements:

- JDK 17
- Android SDK platform 34 and build tools 34.0.0
- Gradle 8.5 (the repository does not include a Gradle wrapper)
- Node.js and npm

From the repository root, run:

```bash
npm install
npm run lint
npm test
npm run build

rm -rf android/app/src/main/assets/web
mkdir -p android/app/src/main/assets/web
cp -R dist/. android/app/src/main/assets/web/

cd android
gradle --version
gradle clean assembleDebug --no-daemon
```

The debug APK is generated at `android/app/build/outputs/apk/debug/app-debug.apk`.

Android Studio can also open the `android/` directory after installing the required SDK and Gradle versions. Ensure the web assets have been built and copied before packaging so the APK contains the same frontend that passed web verification.

## Production release and in-app updates

The public update manifest is maintained at:

```text
update/latest.json
https://raw.githubusercontent.com/titan717/Panda.fun/main/update/latest.json
```

The manifest provides the latest version code/name, release tag, APK URL, release notes, and SHA-256 checksum. The Android updater compares numeric version codes, downloads the APK only when a newer version is available, verifies the checksum, and then hands installation to Android. Android still enforces package/signature compatibility; keep the existing `com.kinoma.tv` application ID and release signing key for upgrade installs.

The manually triggered GitHub Actions production-release workflow packages the production web build into the Android app and publishes a stable GitHub release (not a pre-release). It rejects beta-suffixed version names and publishes `channel: stable` with `prerelease: false` only after the signed APK has been verified. Before building, it runs:

```bash
npm run lint
npm test
npm run build
```

A successful source build or workflow run does not replace device testing. Before calling a production release verified, check the APK signature, manifest checksum, update discovery, install/upgrade behavior, and playback on supported devices. The stable update manifest is published by the workflow only after the signed production APK has been built and verified.

## Runtime behavior

- **Ordinary Android launcher and Leanback launcher:** both launcher categories are declared; installation and launcher behavior must still be checked on real devices/emulators.
- **TV capability:** the native bridge reports Android TV UI mode or Leanback support. The web app uses this signal to enable TV-focused layout and D-pad navigation.
- **Touchscreen devices:** Leanback is optional, touchscreen is optional, and the main activity is not forced to landscape. The web shell can use mobile/tablet layouts and Android system bars.
- **TV remote navigation:** directional focus movement remains TV-only. Inputs and embedded media keep ownership of their keyboard events.
- **Fullscreen and updates:** the existing WebView fullscreen lifecycle and verified APK update path remain in place.

The source-level manifest contract does not prove device-level compatibility. Verify launcher visibility, orientation, touch navigation, TV D-pad behavior and playback on an Android TV and a touchscreen Android device before publishing a release. Do not add release signing credentials to source control.
