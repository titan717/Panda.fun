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

# v1.4.1: debug APKs (pre-release runs) enable WebView debugging. Seed a profile that has finished first-run setup,
# the same state the e2e specs use, so the updater, Search and Connect Phone steps reach their screens instead of
# the onboarding / Who's watching? screens that cover every route on a fresh install. Release APKs (tag runs) skip this.
CDP=0
cdp() { node scripts/cdp.mjs 9333 "$1" 2>>shots/cdp.txt; }
cdp_connect() {
  local pid; pid="$(adb shell pidof "$PKG" | tr -d '\r ')"; [[ -n "$pid" ]] || return 1
  adb forward --remove tcp:9333 >/dev/null 2>&1 || true
  adb forward tcp:9333 "localabstract:webview_devtools_remote_$pid" >/dev/null || return 1
  sleep 1; cdp "location.href" >/dev/null
}
SEED_JS='(() => { const now = Date.now();
  localStorage.setItem("panda:v1:state", JSON.stringify({ profiles: [{ id: "p1", name: "Asha", avatar: "smile", kids: false, createdAt: 1 }], activeProfileId: "p1", prefs: { autoplayTrailers: false }, data: {} }));
  localStorage.setItem("panda:v1:taste", JSON.stringify({ v: 1, profiles: { p1: { v: 1, genres: ["Thriller", "Crime"], contentType: "both", popularity: "mix", era: "mix", length: "mix", pace: "mix", completedAt: now, skipped: false } }, drafts: {}, seen: ["p1"], welcomed: true }));
  sessionStorage.setItem("panda:v1:intro-session", "emulator"); return "seeded"; })()'
if command -v node >/dev/null && cdp_connect && cdp "$SEED_JS" | grep -q seeded; then
  CDP=1; echo "seeded a finished profile over DevTools" | tee -a shots/package.txt
  adb shell am force-stop "$PKG"; sleep 1
  adb shell am start -W -n "$PKG/.ui.MainActivity" -a android.intent.action.MAIN >/dev/null; sleep 10; shot seeded-home
else
  echo "no DevTools (release APK): later steps go through first-run screens" | tee -a shots/package.txt
fi

# The new build's own updater (R8-shrunk release since v1.1.9: Gson models and the JS bridge must survive shrinking)
adb shell am start -W -n "$PKG/.ui.MainActivity" --es panda_path /settings/updates >/dev/null
sleep 12; shot updater-new
adb shell uiautomator dump /sdcard/upd2.xml >/dev/null 2>&1 && adb shell cat /sdcard/upd2.xml | grep -oE 'text="[^"]*(pdate|ersion|atest)[^"]*"' | head -8 | tee -a shots/upgrade.txt || true
adb shell pidof "$PKG" >/dev/null || { echo "app crashed on the updates screen"; adb logcat -d -b crash > shots/logcat-updates.txt; exit 1; }

# v1.4.0 text entry (directive: "test actual text entry on an Android TV environment or representative emulator").
# Search focuses the field without a keyboard; OK must raise the system IME, a key pressed ON the IME must land in the
# field, typed text must drive real results, and Enter must close the IME. Every step is logged to shots/text-entry.txt.
TE=shots/text-entry.txt
field_value() { adb shell uiautomator dump /sdcard/te.xml >/dev/null 2>&1; adb shell cat /sdcard/te.xml 2>/dev/null | grep -oE '<node[^>]*class="android.widget.EditText"[^>]*>' | head -1 | grep -oE ' text="[^"]*"' | head -1; }
ime_shown() { adb shell dumpsys input_method | grep -qE "mInputShown=true|isInputShown=true|mIsInputViewShown=true"; }
if [[ "$NAME" == *tv* ]]; then
  # A fresh install may first show onboarding or Who's watching: get past them the way a user would, then open Search.
  tap_text() { local b; b="$(adb shell cat /sdcard/te0.xml 2>/dev/null | grep -oE "<node[^>]*(text|content-desc)=\"$1\"[^>]*>" | head -1 | grep -oE 'bounds="\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]"' | grep -oE '[0-9]+' | tr '\n' ' ')"; [[ -n "$b" ]] || return 1; set -- $b; adb shell input tap $((($1+$3)/2)) $((($2+$4)/2)); }
  for attempt in 1 2 3 4; do
    adb shell am start -W -n "$PKG/.ui.MainActivity" --es panda_path /search >/dev/null
    sleep 10
    adb shell uiautomator dump /sdcard/te0.xml >/dev/null 2>&1
    adb shell cat /sdcard/te0.xml 2>/dev/null | grep -q 'class="android.widget.EditText"' && break
    echo "attempt $attempt: no search field yet" >> shots/text-entry-gates.txt; shot "search-gate-$attempt"
    tap_text "Skip for now" || tap_text "Skip" || tap_text "Not now" || adb shell input keyevent KEYCODE_DPAD_CENTER
    sleep 4
  done
  shot search-field
  echo "IME: $(adb shell settings get secure default_input_method)" | tee $TE
  ime_shown && echo "keyboard already open before OK (unexpected)" | tee -a $TE
  if [[ "$CDP" == 1 ]]; then cdp_connect >/dev/null 2>&1; echo "before OK: $(cdp '({ active: document.activeElement && document.activeElement.id, mode: document.getElementById("search-input") && document.getElementById("search-input").inputMode })')" | tee -a $TE; fi
  adb shell input keyevent KEYCODE_DPAD_CENTER; sleep 3; shot search-ime-open
  if [[ "$CDP" == 1 ]]; then echo "after OK: $(cdp '({ active: document.activeElement && document.activeElement.id, mode: document.getElementById("search-input") && document.getElementById("search-input").inputMode, editing: !!document.querySelector(".tv-search-field.is-editing") })')" | tee -a $TE; fi
  adb logcat -d | grep -E "soft keyboard requested" | tail -5 >> $TE || true
  adb shell dumpsys input_method | grep -E "mInputShown|mCurMethodId|mCurFocusedWindowName|mServedView" | head -6 >> $TE
  if ime_shown; then echo "PASS OK on the field opened the system keyboard" | tee -a $TE; else echo "FAIL OK did not open the system keyboard" | tee -a $TE; TEXT_FAIL=1; fi
  # one key typed BY the keyboard itself (its focused key), not injected into the app
  adb shell input keyevent KEYCODE_DPAD_CENTER; sleep 2; shot search-ime-key
  V1="$(field_value)"; echo "after one IME key press: ${V1:-<no EditText node>}" | tee -a $TE
  [[ "$V1" =~ text=\"[^\"]+\" ]] && echo "PASS a key pressed on the on-screen keyboard reached the field" | tee -a $TE || echo "WARN could not read an IME-typed character from the accessibility tree" | tee -a $TE
  # clear, then a whole word (adb key injection into the focused field while the keyboard is up)
  for _ in 1 2 3 4; do adb shell input keyevent KEYCODE_DEL; done
  adb shell input text matrix; sleep 3; shot search-typed
  V2="$(field_value)"; echo "after typing 'matrix': ${V2:-<no EditText node>}" | tee -a $TE
  if [[ "$CDP" == 1 && "$V2" != *matrix* ]]; then V2="$(cdp 'document.getElementById("search-input") && document.getElementById("search-input").value')"; echo "field value over DevTools: $V2" | tee -a $TE; fi
  if [[ "$V2" == *matrix* ]]; then echo "PASS typed text is in the search field" | tee -a $TE; else echo "FAIL typed text not found in the field" | tee -a $TE; TEXT_FAIL=1; fi
  adb shell input keyevent KEYCODE_ENTER; sleep 4; shot search-results
  ime_shown && { echo "FAIL Enter did not close the keyboard" | tee -a $TE; TEXT_FAIL=1; } || echo "PASS Enter closed the keyboard" | tee -a $TE
  adb shell uiautomator dump /sdcard/te2.xml >/dev/null 2>&1; adb shell cat /sdcard/te2.xml 2>/dev/null | grep -oE 'text="Results for[^"]*"' | head -1 | tee -a $TE
  adb shell cat /sdcard/te2.xml 2>/dev/null | grep -q 'Results for' && echo "PASS results shown for the typed query" | tee -a $TE || echo "WARN results heading not exposed to accessibility (see search-results.png)" | tee -a $TE
  adb shell input keyevent KEYCODE_DPAD_DOWN; sleep 1; shot search-after-down
  adb shell pidof "$PKG" >/dev/null || { echo "app crashed during text entry" | tee -a $TE; adb logcat -d -b crash > shots/logcat-text.txt; exit 1; }
  [[ "${TEXT_FAIL:-0}" == 1 ]] && { echo "TEXT ENTRY FAILURE (see $TE)"; exit 1; }
  echo "text entry: keyboard opens on OK, typing reaches the field, Enter closes it" | tee -a $TE
fi

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
