import { describe, expect, it } from "vitest";
import pkgRaw from "../../package.json?raw";
import lockRaw from "../../package-lock.json?raw";
import readme from "../../README.md?raw";
import changelog from "../../docs/CHANGELOG.md?raw";
import notes from "../../docs/release-notes/v1.3.1.md?raw";
import gradle from "../../android/app/build.gradle?raw";

/*
 * v1.4.0: the v1.3.1 retro paper-cutout TV film (IntroTv.tsx, introTimeline.ts, its score) was replaced by the Intro
 * Manager playing public/intro/intro-tv.mp4; the film's frame tests went with it (see src/test/v140-intro.test.tsx).
 */

describe("v1.3.1 version bump", () => {
  it("is 1.3.1 everywhere", () => {
    const pkg = JSON.parse(pkgRaw) as { version: string };
    const lock = JSON.parse(lockRaw) as { version: string; packages: Record<string, { version: string }> };
    expect(pkg.version).toBe("1.3.1");
    expect(lock.version).toBe("1.3.1");
    expect(lock.packages[""]!.version).toBe("1.3.1");
    expect(readme).toContain("the current version is 1.3.1");
    expect(changelog.indexOf("## 1.3.1")).toBeLessThan(changelog.indexOf("## 1.3.0"));
    expect(notes).toContain("## What's new in 1.3.1");
    // CI passes the real values (-PKINOMA_VERSION_NAME / _CODE); the local fallback matches this release
    expect(gradle).toContain(': "1.3.1"');
    expect(gradle).toMatch(/toInteger\(\) : 2512\b/);
  });
});
