import { describe, expect, it } from "vitest";
import pkgRaw from "../../package.json?raw";
import lockRaw from "../../package-lock.json?raw";
import changelog from "../../docs/CHANGELOG.md?raw";
import notes from "../../docs/release-notes/v1.5.0.md?raw";
import reco from "../../docs/RECOMMENDATIONS.md?raw";
import gradle from "../../android/app/build.gradle?raw";

describe("v1.5.0 version bump", () => {
  it("is 1.5.0 everywhere", () => {
    const pkg = JSON.parse(pkgRaw) as { version: string };
    const lock = JSON.parse(lockRaw) as { version: string; packages: Record<string, { version: string }> };
    expect(pkg.version).toBe("1.5.0");
    expect(lock.version).toBe("1.5.0");
    expect(lock.packages[""]!.version).toBe("1.5.0");
    expect(changelog.indexOf("## 1.5.0")).toBeLessThan(changelog.indexOf("## 1.4.1"));
    expect(notes).toContain("## What's new in 1.5.0");
    expect(gradle).toContain(': "1.5.0"');
    expect(gradle).toMatch(/toInteger\(\) : 2700\b/);
  });
  it("is honest about what was measured and tested", () => {
    expect(notes).toMatch(/real-world accuracy has not been measured/);
    expect(notes).toMatch(/not checked on a physical Android TV/);
    expect(reco).toMatch(/not real-world recommendation accuracy/);
  });
});
