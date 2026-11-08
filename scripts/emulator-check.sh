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
  # The launcher's tabs switch on focus: Up reaches "Home", Right moves to "Apps". No OK, which would open Notifications.
  adb shell input keyevent KEYCODE_DPAD_UP; sleep 0.5
  adb shell input keyevent KEYCODE_DPAD_RIGHT; sleep 4; shot apps
else
  adb shell input swipe 540 2000 540 500 300; sleep 3; shot apps
fi
# Close any panel left open, then return to Home before launching.
adb shell input keyevent KEYCODE_BACK; sleep 0.5
adb shell input keyevent KEYCODE_BACK; sleep 0.5
adb shell input keyevent KEYCODE_HOME; sleep 2
# Launch the activity directly: `monkey -p PKG 1` also injects one random input event, which can be Back/Home and close the app.
adb logcat -c || true
adb shell am start -W -n "$PKG/.ui.MainActivity" -a android.intent.action.MAIN | tee -a shots/package.txt
sleep 0.8; shot splash-0.8s
sleep 1.5; shot splash-2.3s
sleep 8
# A cold emulator sometimes restarts Google Play services, and Android then kills every app that holds its font
# provider ("depends on provider ... in dying proc"). That is the emulator, not Panda: relaunch once and say so.
if ! adb shell pidof "$PKG" >/dev/null && adb logcat -d | grep -q "depends on provider.*dying proc"; then
  echo "system killed the app (Play services restart); relaunching once" | tee -a shots/package.txt
  adb logcat -d | grep -iE "kinoma|ActivityManager: Killing" | tail -50 > shots/system-kill.txt || true
  adb logcat -c || true
  adb shell am start -W -n "$PKG/.ui.MainActivity" -a android.intent.action.MAIN | tee -a shots/package.txt
  sleep 10
fi
shot first-screen
adb shell input keyevent KEYCODE_DPAD_CENTER; sleep 4; shot after-ok
sleep 8; shot after-ok-12s
adb shell pidof "$PKG" >/dev/null && echo "app running" | tee -a shots/package.txt || { echo "app not running"; { adb logcat -d -b crash; echo ----; adb logcat -d | grep -iE "kinoma|AndroidRuntime|chromium|ActivityTaskManager|am_" | tail -400; } > shots/logcat.txt; exit 1; }
adb logcat -d | grep -iE "kinoma|panda|chromium|AndroidRuntime|KinomaTVWeb" | tail -300 > shots/logcat.txt || true

# Ad shield release gate (docs/AD_SHIELD.md, layer 7): play a title, press and tap around the player for a
# minute, and fail if any other activity (browser, Play Store, another app) ever comes to the front.
resumed() { adb shell dumpsys activity activities | grep -E "mResumedActivity|topResumedActivity" | head -1; }
adb logcat -c || true
adb shell am start -W -n "$PKG/.ui.MainActivity" --es panda_path /watch/movie/550 | tee -a shots/package.txt
sleep 6; adb shell input keyevent KEYCODE_DPAD_CENTER; sleep 25; shot player
FOREIGN=0
for i in $(seq 1 12); do
  if [[ "$NAME" == *tv* ]]; then
    for k in DPAD_CENTER DPAD_RIGHT DPAD_LEFT MEDIA_PLAY_PAUSE; do adb shell input keyevent "KEYCODE_$k"; sleep 0.6; done
  else
    adb shell input tap $((200 + i * 60)) $((600 + (i % 4) * 120)); sleep 1
    adb shell input tap 540 1200; sleep 1
  fi
  R="$(resumed)"; echo "$i $R" >> shots/shield.txt
  [[ "$R" == *"$PKG/"* ]] || FOREIGN=1
done
shot player-after-input
adb logcat -d | grep -E "PandaShield" | tail -200 >> shots/shield.txt || true
if [[ "$FOREIGN" == 1 ]]; then echo "AD SHIELD FAILURE: another activity came to the front during playback" | tee -a shots/shield.txt; exit 1; fi
echo "ad shield: no external activity launched during playback" | tee -a shots/shield.txt
