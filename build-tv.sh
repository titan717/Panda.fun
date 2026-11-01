#!/usr/bin/env bash
set -euo pipefail

echo "=================================================="
echo " Building Panda.fun Android TV debug APK"
echo "=================================================="

# Icon PNGs and Android density assets are generated from the canonical SVG sources.
npm run icons
npm run lint
npm test
npm run build

# The Android WebView bundle is generated from dist; never hand-edit or commit it.
rm -rf android/app/src/main/assets/web
mkdir -p android/app/src/main/assets/web
cp -R dist/. android/app/src/main/assets/web/

if [[ -x "android/gradlew" ]]; then
  GRADLE=(./gradlew)
  (cd android && chmod +x gradlew && ./gradlew clean :app:assembleDebug --no-daemon --stacktrace)
elif command -v gradle >/dev/null 2>&1; then
  GRADLE=(gradle)
  (cd android && gradle clean :app:assembleDebug --no-daemon --stacktrace)
else
  echo "Android Gradle tooling is unavailable. Install the Android SDK and Gradle, then retry."
  exit 1
fi

APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"
if [[ ! -s "$APK_PATH" ]]; then
  echo "Android debug build did not produce an APK."
  exit 1
fi

mkdir -p release
cp "$APK_PATH" release/Panda.fun-Android-TV-debug.apk
if command -v apksigner >/dev/null 2>&1; then
  apksigner verify --verbose release/Panda.fun-Android-TV-debug.apk
fi

echo "=================================================="
echo " BUILD SUCCESSFUL"
echo " Debug APK: release/Panda.fun-Android-TV-debug.apk"
echo " Stable signed production APKs are published only by the manual GitHub release workflow."
echo "=================================================="
