import { describe, expect, it } from "vitest";
import pkgRaw from "../../package.json?raw";
import lockRaw from "../../package-lock.json?raw";
import readme from "../../README.md?raw";
import changelog from "../../docs/CHANGELOG.md?raw";
import notes from "../../docs/release-notes/v1.4.0.md?raw";
import gradle from "../../android/app/build.gradle?raw";

describe("v1.4.0 version bump", () => {
  it("is 1.4.0 everywhere", () => {
    const pkg = JSON.parse(pkgRaw) as { version: string };
    const lock = JSON.parse(lockRaw) as { version: string; packages: Record<string, { version: string }> };
    expect(pkg.version).toBe("1.4.0");
    expect(lock.version).toBe("1.4.0");
    expect(lock.packages[""]!.version).toBe("1.4.0");
    expect(readme).toContain("the current version is 1.4.0");
    expect(changelog.indexOf("## 1.4.0")).toBeLessThan(changelog.indexOf("## 1.3.1"));
    expect(notes).toContain("## What's new in 1.4.0");
    // CI passes the real values (-PKINOMA_VERSION_NAME / _CODE); the local fallback matches this release
    expect(gradle).toContain(': "1.4.0"');
    expect(gradle).toMatch(/toInteger\(\) : 2600\b/);
  });
  it("release notes are honest about untested hardware", () => {
    expect(notes).toMatch(/not checked on a physical Android TV/);
    expect(notes).toContain("VidLink is gone from phones");
  });
});
