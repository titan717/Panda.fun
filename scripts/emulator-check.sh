#!/usr/bin/env bash
# Called by .github/workflows/emulator-check.yml inside a booted emulator.
set -uo pipefail
NAME="$1"; PKG=com.kinoma.tv; mkdir -p shots
# Every adb call is bounded: when the emulator itself dies ("error: closed") adb would otherwise block until the job timeout.
ADB_BIN="$(command -v adb)"
adb() { timeout 90 "$ADB_BIN" "$@"; local rc=$?; if [[ $rc == 124 ]]; then echo "adb timed out: $*"; "$ADB_BIN" devices | tee -a shots/emulator.txt; fi; return $rc; }
shot() { adb exec-out screencap -p > "shots/$NAME-$1.png"; echo "captured $1"; }
# Update path (master mission §10: in-app update verified from the previous version)
if compgen -G "prev/*.apk" >/dev/null; then
  PREV_TAG="$(cat prev/TAG)"
  adb install prev/*.apk | tee shots/upgrade.txt
  adb shell dumpsys package "$PKG" | grep -E "versionName|firstInstallTime" | tee -a shots/upgrade.txt
  # the old build's own updater must see the new release
  adb shell am start -W -n "$PKG/.ui.MainActivity" --es panda_path /settings/updates >/dev/null
  sleep 16; shot "updater-on-$PREV_TAG"
  # What the old build's Check for Updates screen says (WebView text is exposed to uiautomator)
  adb shell uiautomator dump /sdcard/upd.xml >/dev/null 2>&1 && adb shell cat /sdcard/upd.xml | grep -oE 'text="[^"]*(pdate|ersion|atest)[^"]*"' | head -8 | tee -a shots/upgrade.txt || true
  adb shell am force-stop "$PKG"
  # upgrade in place: fails on a different signing key or a lower versionCode
  if ! adb install -r apk/*.apk 2>&1 | tee -a shots/upgrade.txt | grep -q Success; then echo "UPDATE FAILURE: $PREV_TAG -> new APK did not install over the old one" | tee -a shots/upgrade.txt; exit 1; fi
  adb shell dumpsys package "$PKG" | grep -E "versionName|versionCode|firstInstallTime|lastUpdateTime" | tee -a shots/upgrade.txt
  echo "update from $PREV_TAG installed in place with the same signing key" | tee -a shots/upgrade.txt
else
  adb install -r apk/*.apk
fi
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

# The new build's own updater (R8-shrunk release since v1.1.9: Gson models and the JS bridge must survive shrinking)
adb shell am start -W -n "$PKG/.ui.MainActivity" --es panda_path /settings/updates >/dev/null
sleep 12; shot updater-new
adb shell uiautomator dump /sdcard/upd2.xml >/dev/null 2>&1 && adb shell cat /sdcard/upd2.xml | grep -oE 'text="[^"]*(pdate|ersion|atest)[^"]*"' | head -8 | tee -a shots/upgrade.txt || true
adb shell pidof "$PKG" >/dev/null || { echo "app crashed on the updates screen"; adb logcat -d -b crash > shots/logcat-updates.txt; exit 1; }

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

# v1.2.4 deep links: a shared title link opens its Details page inside Panda.
adb shell am start -W -a android.intent.action.VIEW -d "pandafun://title/movie/550" "$PKG" | tee -a shots/package.txt
sleep 8; shot deeplink-title
adb shell am start -W -a android.intent.action.VIEW -d "https://apikinoma.vercel.app/p/movie/550" "$PKG" | tee -a shots/package.txt
sleep 6; shot deeplink-share
adb shell pidof "$PKG" >/dev/null || { echo "app crashed on a deep link"; adb logcat -d -b crash > shots/logcat-deeplink.txt; exit 1; }
adb shell dumpsys activity activities | grep -E "mResumedActivity|topResumedActivity" | head -1 | grep -q "$PKG/" || { echo "deep link did not open Panda"; exit 1; }
echo "deep links: pandafun:// and share links open in Panda" | tee -a shots/remote.txt

# v1.2.4 phone remote: Connect Phone starts the LAN server; it serves the remote page and refuses calls without the code.
adb shell am start -W -n "$PKG/.ui.MainActivity" --es panda_path /connect-phone >/dev/null
sleep 8; shot connect-phone
adb forward tcp:18765 tcp:8765
curl -s -m 5 http://127.0.0.1:18765/ | grep -q "Panda remote" || { echo "REMOTE FAILURE: remote page not served"; exit 1; }
CODE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -m 5 -X POST -H "content-type: application/json" -d '{"k":"up"}' http://127.0.0.1:18765/api/key)
[[ "$CODE_STATUS" == 401 ]] || { echo "REMOTE FAILURE: call without a code answered $CODE_STATUS"; exit 1; }
adb shell uiautomator dump /sdcard/cp.xml >/dev/null 2>&1 || true
CODE=$(adb shell cat /sdcard/cp.xml 2>/dev/null | grep -oE '\b[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}\b' | head -1 || true)
if [[ -n "$CODE" ]]; then
  HELLO=$(curl -s -o /dev/null -w "%{http_code}" -m 5 -X POST -H "X-Panda-Code: $CODE" -H "content-type: application/json" -d '{"name":"CI phone"}' http://127.0.0.1:18765/api/hello)
  [[ "$HELLO" == 200 ]] || { echo "REMOTE FAILURE: pairing with the on-screen code answered $HELLO"; exit 1; }
  curl -s -m 5 -X POST -H "X-Panda-Code: $CODE" -H "content-type: application/json" -d '{"k":"down"}' http://127.0.0.1:18765/api/key >/dev/null
  sleep 3; shot connect-phone-paired
  echo "phone remote: paired with the on-screen code and sent a key" | tee -a shots/remote.txt
else
  echo "phone remote: code not exposed to accessibility on this image; pairing step skipped" | tee -a shots/remote.txt
fi
adb shell pidof "$PKG" >/dev/null || { echo "app crashed on Connect Phone"; adb logcat -d -b crash > shots/logcat-remote.txt; exit 1; }
echo "phone remote: page served, unpaired calls refused" | tee -a shots/remote.txt
