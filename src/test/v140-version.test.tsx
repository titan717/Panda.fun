import { describe, expect, it } from "vitest";
import changelog from "../../docs/CHANGELOG.md?raw";
import notes from "../../docs/release-notes/v1.4.0.md?raw";

describe("v1.4.0 release notes", () => {
  it("keeps the 1.4.0 entry (v1.4.1 bumped the version, see v141.test.ts)", () => {
    // README intentionally has no version number: its badge and download links read the latest GitHub Release
    expect(changelog.indexOf("## 1.4.0")).toBeLessThan(changelog.indexOf("## 1.3.1"));
    expect(notes).toContain("## What's new in 1.4.0");
  });
  it("release notes are honest about untested hardware", () => {
    expect(notes).toMatch(/not checked on a physical Android TV/);
    expect(notes).toContain("VidLink is gone from phones");
  });
});
