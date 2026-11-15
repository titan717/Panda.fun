import { describe, expect, it } from "vitest";
import changelog from "../../docs/CHANGELOG.md?raw";
import notes from "../../docs/release-notes/v1.3.1.md?raw";

/*
 * v1.4.0: the v1.3.1 retro paper-cutout TV film (IntroTv.tsx, introTimeline.ts, its score) was replaced by the Intro
 * Manager playing public/intro/intro-tv.mp4; the film's frame tests went with it (see src/test/v140-intro.test.tsx).
 */

describe("v1.3.1 release notes stay on record", () => {
  it("keep their changelog entry and notes file", () => {
    expect(changelog.indexOf("## 1.3.1")).toBeLessThan(changelog.indexOf("## 1.3.0"));
    expect(notes).toContain("## What's new in 1.3.1");
  });
});
