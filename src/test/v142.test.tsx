import { describe, expect, it } from "vitest";
import pkgRaw from "../../package.json?raw";
import lockRaw from "../../package-lock.json?raw";
import changelog from "../../docs/CHANGELOG.md?raw";
import notes from "../../docs/release-notes/v1.4.2.md?raw";
import gradle from "../../android/app/build.gradle?raw";
import vercel from "../../vercel.json?raw";

describe("v1.4.2 release notes", () => {
  it("keeps the 1.4.2 entry between 1.5.0 and 1.4.1 (v1.5.0 bumped the version, see v150-release.test.ts)", () => {
    const pkg = JSON.parse(pkgRaw) as { version: string };
    const lock = JSON.parse(lockRaw) as { version: string };
    expect(pkg.version).toBe(lock.version);
    expect(changelog.indexOf("## 1.4.2")).toBeGreaterThan(-1);
    expect(changelog.indexOf("## 1.4.2")).toBeLessThan(changelog.indexOf("## 1.4.1"));
    expect(changelog.indexOf("## 1.5.0")).toBeLessThan(changelog.indexOf("## 1.4.2"));
    expect(notes).toContain("## What's new in 1.4.2");
    expect(gradle).toMatch(/toInteger\(\) : (\d+)\b/);
  });
  it("release notes are honest about untested hardware", () => {
    expect(notes).toMatch(/not checked on a physical Android TV/);
  });
  it("the bumper needs no security policy change (canvas, same-origin image, Web Audio)", () => {
    expect(vercel).not.toContain("unsafe-eval");
    expect(vercel).toMatch(/img-src[^;]*'self'/);
  });
});
