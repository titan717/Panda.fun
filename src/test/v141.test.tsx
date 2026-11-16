import { describe, expect, it } from "vitest";
import changelog from "../../docs/CHANGELOG.md?raw";
import notes from "../../docs/release-notes/v1.4.1.md?raw";
import mainActivity from "../../android/app/src/main/java/com/kinoma/tv/ui/MainActivity.kt?raw";
import remoteInput from "../lib/remoteInput.ts?raw";
import tvSearch from "../tv/TvSearch.tsx?raw";
import tokens from "../styles/tokens.css?raw";

describe("v1.4.1 release notes", () => {
  it("keeps the 1.4.1 entry (v1.4.2 bumped the version, see v142.test.tsx)", () => {
    expect(changelog.indexOf("## 1.4.1")).toBeGreaterThan(-1);
    expect(changelog.indexOf("## 1.4.1")).toBeLessThan(changelog.indexOf("## 1.4.0"));
    expect(notes).toContain("## What's new in 1.4.1");
  });
  it("release notes are honest about untested hardware", () => {
    expect(notes).toMatch(/not checked on a physical Android TV/);
  });
});

describe("v1.4.1 TV keyboard", () => {
  it("switches the field's input mode inside the OK press, before asking for the keyboard", () => {
    const open = remoteInput.slice(remoteInput.indexOf("const open = () =>"), remoteInput.indexOf("const close = () =>"));
    expect(open).toMatch(/el\.inputMode = opts\.mode/);
    expect(open.indexOf("el.inputMode =")).toBeLessThan(open.indexOf("requestKeyboard("));
    expect(open).toMatch(/el\.blur\(\); el\.focus\(/);
  });
  it("native side retries until the IME is visible and stops once it is", () => {
    expect(mainActivity).toMatch(/KEYBOARD_ATTEMPTS_MS = longArrayOf\(/);
    expect(mainActivity).toMatch(/\|\| imeVisible\) return@postDelayed/);
    expect(mainActivity).toContain("WindowInsetsCompat.Type.ime()");
  });
  it("the remote's OK reaches the page as Enter, so a no-keyboard text field can react to it", () => {
    expect(mainActivity).toMatch(/KEYCODE_DPAD_CENTER && customView == null && okAsEnter\) \{\s*return super\.dispatchKeyEvent\(asEnter\(event\)\)/);
    // only while a TV remote field has focus: the phone layout and every other screen keep the normal OK
    expect(mainActivity).toMatch(/fun setOkAsEnter\(key: String, on: Boolean\) \{\s*if \(!trusted\(key\)\) return/);
    expect(remoteInput).toMatch(/onFocus: \(\) => \{ setOkAsEnter\(true\); \}/);
  });
  it("WebView debugging is only for debug builds", () => {
    expect(mainActivity).toMatch(/FLAG_DEBUGGABLE != 0\) WebView\.setWebContentsDebuggingEnabled\(true\)/);
  });
  it("TV search shows what OK does", () => {
    expect(tvSearch).toContain("tv-search-hint");
    expect(tvSearch).toContain("is-editing");
  });
  it("TV focus uses the brand colours, and high contrast still overrides them", () => {
    const tv = tokens.slice(tokens.indexOf('html[data-mode="tv"] {'));
    expect(tv).toContain("--tv-focus-ring");
    expect(tokens.indexOf('html[data-contrast="high"]')).toBeGreaterThan(tokens.indexOf("--tv-focus-ring"));
  });
});
