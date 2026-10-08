#!/usr/bin/env bash
set -e

echo "=================================================="
echo " Starting Panda.fun Android TV Release APK Build"
echo "=================================================="

# Create output directories if they don't exist
mkdir -p android/app/build/outputs/apk/release
mkdir -p android/app/build/outputs/apk/debug
mkdir -p public/downloads
mkdir -p android/app/src/main/assets/web

echo "Building web application frontend..."
npm run build
cp -r dist/* android/app/src/main/assets/web/

# Check if gradlew exists, run gradle build if available
if [ -f "android/gradlew" ]; then
  echo "Found Gradle wrapper. Running assembleDebug and assembleRelease..."
  cd android
  chmod +x gradlew
  ./gradlew clean assembleDebug assembleRelease
  cd ..
else
  echo "Gradle wrapper not found. Cannot build a real Android TV APK."
  exit 1
fi

# A release is valid only when Gradle produced a real APK.
APK_PATH="android/app/build/outputs/apk/release/app-release.apk"
PUBLIC_APK_PATH="public/downloads/Panda.fun-Android-TV.apk"

test -s "$APK_PATH"
if command -v file >/dev/null 2>&1; then
  file "$APK_PATH" | grep -qi 'Android package\|Zip archive'
fi

mkdir -p "$(dirname "$PUBLIC_APK_PATH")"
cp "$APK_PATH" "$PUBLIC_APK_PATH"


echo "=================================================="
echo " BUILD SUCCESSFUL!"
echo " Release APK available at:"
echo "   - $APK_PATH"
echo "   - $PUBLIC_APK_PATH"
echo "=================================================="
