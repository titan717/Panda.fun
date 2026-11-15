import { describe, expect, it } from "vitest";
import pkgRaw from "../../package.json?raw";
import lockRaw from "../../package-lock.json?raw";
import changelog from "../../docs/CHANGELOG.md?raw";
import notes from "../../docs/release-notes/v1.4.1.md?raw";
import gradle from "../../android/app/build.gradle?raw";
import mainActivity from "../../android/app/src/main/java/com/kinoma/tv/ui/MainActivity.kt?raw";
import remoteInput from "../lib/remoteInput.ts?raw";
import tvSearch from "../tv/TvSearch.tsx?raw";
import tokens from "../styles/tokens.css?raw";

describe("v1.4.1 version bump", () => {
  it("is 1.4.1 everywhere", () => {
    const pkg = JSON.parse(pkgRaw) as { version: string };
    const lock = JSON.parse(lockRaw) as { version: string; packages: Record<string, { version: string }> };
    expect(pkg.version).toBe("1.4.1");
    expect(lock.version).toBe("1.4.1");
    expect(lock.packages[""]!.version).toBe("1.4.1");
    expect(changelog.indexOf("## 1.4.1")).toBeLessThan(changelog.indexOf("## 1.4.0"));
    expect(notes).toContain("## What's new in 1.4.1");
    // CI passes the real values (-PKINOMA_VERSION_NAME / _CODE); the local fallback matches this release
    expect(gradle).toContain(': "1.4.1"');
    expect(gradle).toMatch(/toInteger\(\) : 2610\b/);
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
