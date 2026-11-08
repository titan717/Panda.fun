#!/usr/bin/env bash
# Called by .github/workflows/emulator-check.yml inside a booted emulator.
set -uo pipefail
NAME="$1"; PKG=com.kinoma.tv; mkdir -p shots
shot() { adb exec-out screencap -p > "shots/$NAME-$1.png"; echo "captured $1"; }
adb install -r apk/*.apk
adb shell dumpsys package "$PKG" | grep -E "versionName|versionCode|LEANBACK_LAUNCHER|android.intent.category.LAUNCHER" | tee shots/package.txt
adb shell cmd package resolve-activity --brief -c android.intent.category.LEANBACK_LAUNCHER -a android.intent.action.MAIN "$PKG" | tee -a shots/package.txt
adb shell input keyevent KEYCODE_HOME; sleep 6; shot launcher
# App list, where the launcher icon (phone) or the TV banner (Leanback "Apps" tab) is drawn.
if [[ "$NAME" == *tv* ]]; then
  adb shell input keyevent KEYCODE_DPAD_UP; sleep 0.5
  adb shell input keyevent KEYCODE_DPAD_RIGHT; sleep 0.5
  adb shell input keyevent KEYCODE_DPAD_RIGHT; sleep 0.5
  adb shell input keyevent KEYCODE_DPAD_CENTER; sleep 4; shot apps
else
  adb shell input swipe 540 2000 540 500 300; sleep 3; shot apps
fi
adb shell input keyevent KEYCODE_HOME; sleep 2
adb shell monkey -p "$PKG" -c android.intent.category.LEANBACK_LAUNCHER 1 >/dev/null 2>&1 || adb shell monkey -p "$PKG" 1 >/dev/null 2>&1
sleep 0.8; shot splash-0.8s
sleep 1.5; shot splash-2.3s
sleep 8; shot first-screen
adb shell input keyevent KEYCODE_DPAD_CENTER; sleep 4; shot after-ok
adb shell pidof "$PKG" >/dev/null && echo "app running" | tee -a shots/package.txt || { echo "app not running"; adb logcat -d | tail -200 > shots/logcat.txt; exit 1; }
adb logcat -d | grep -iE "kinoma|panda|chromium|AndroidRuntime" | tail -300 > shots/logcat.txt || true
