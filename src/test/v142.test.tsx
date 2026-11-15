import { describe, expect, it } from "vitest";
import pkgRaw from "../../package.json?raw";
import lockRaw from "../../package-lock.json?raw";
import changelog from "../../docs/CHANGELOG.md?raw";
import notes from "../../docs/release-notes/v1.4.2.md?raw";
import gradle from "../../android/app/build.gradle?raw";
import vercel from "../../vercel.json?raw";

describe("v1.4.2 version bump", () => {
  it("is 1.4.2 everywhere", () => {
    const pkg = JSON.parse(pkgRaw) as { version: string };
    const lock = JSON.parse(lockRaw) as { version: string; packages: Record<string, { version: string }> };
    expect(pkg.version).toBe("1.4.2");
    expect(lock.version).toBe("1.4.2");
    expect(lock.packages[""]!.version).toBe("1.4.2");
    expect(changelog.indexOf("## 1.4.2")).toBeGreaterThan(-1);
    expect(changelog.indexOf("## 1.4.2")).toBeLessThan(changelog.indexOf("## 1.4.1"));
    expect(notes).toContain("## What's new in 1.4.2");
    // CI passes the real values (-PKINOMA_VERSION_NAME / _CODE); the local fallback matches this release
    expect(gradle).toContain(': "1.4.2"');
    expect(gradle).toMatch(/toInteger\(\) : 2620\b/);
  });
  it("release notes are honest about untested hardware", () => {
    expect(notes).toMatch(/not checked on a physical Android TV/);
  });
  it("the bumper needs no security policy change (canvas, same-origin image, Web Audio)", () => {
    expect(vercel).not.toContain("unsafe-eval");
    expect(vercel).toMatch(/img-src[^;]*'self'/);
  });
});
