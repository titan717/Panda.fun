# Panda.fun Universal Android Application

This directory contains the native Android wrapper for Panda.fun. The intended package is a single APK for Android TV and touchscreen Android devices, with both ordinary and Leanback launcher entries. The primary activity loads the bundled React web app in a WebView; existing TV remote navigation, fullscreen handling and update installation behavior must be preserved. Android TV / Media3 components remain in the project, but this wrapper change does not replace the current Vidy web playback flow.

## How to Build `Panda.fun.apk`

1. Open Android Studio (Hedgehog or newer recommended).
2. Select **Open** and choose the `/android` directory of this project.
3. Allow Gradle to sync dependencies.
4. Run the build or generate signed APK:
   - **Debug APK**: Run `./gradlew assembleDebug` in the terminal inside `/android`. The output APK will be generated at `/android/app/build/outputs/apk/debug/app-debug.apk` (you can rename this to `Panda.fun.apk`).
   - **Release APK**: Run `./gradlew assembleRelease` to produce `app-release.apk`.

## Features
- **Universal launcher intent**: ordinary Android launcher plus Leanback launcher; verify both on target devices.
- **Adaptive presentation**: TV mode is selected from native TV capability; touch devices retain system bars and can use portrait layouts.
- **D-pad navigation**: directional focus behavior remains active only on TV devices.
- **Fullscreen WebView handling**: the current web player/provider flow remains unchanged.
- **Self-Update System**: Automatically queries `https://raw.githubusercontent.com/titan717/Panda.fun/main/update/latest.json` and prompts users to download and install updates via Android's package installer.
- **Panda.fun Backend Integration**: Connects directly to the Panda.fun anime backend API for real-time catalogs and trending shows.
