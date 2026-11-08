import { beforeEach, describe, expect, it } from "vitest";
import { takeUpdateNotice, whatsNewSection } from "../lib/updates";

const body = `Signed release.

## What's new in 1.0.5

- **Faster start**: loads less code
- What's New after updates

## Install

Download the APK.

**Full Changelog**: https://github.com/x/y/compare/v1.0.4...v1.0.5`;

describe("whatsNewSection", () => {
  it("extracts the section for the version", () => {
    expect(whatsNewSection(body, "1.0.5")).toBe("- **Faster start**: loads less code\n- What's New after updates");
  });
  it("falls back to the body without the changelog link", () => {
    expect(whatsNewSection("Plain notes\n\n**Full Changelog**: x", "2.0.0")).toBe("Plain notes");
  });
});

describe("takeUpdateNotice", () => {
  beforeEach(() => localStorage.clear());
  it("is silent on a fresh install and after the notice was taken", () => {
    expect(takeUpdateNotice("1.0.5")).toBeNull();
    expect(takeUpdateNotice("1.0.5")).toBeNull();
  });
  it("returns the new version once after an update", () => {
    localStorage.setItem("panda:seen-version", "1.0.4");
    expect(takeUpdateNotice("1.0.5")).toBe("1.0.5");
    expect(takeUpdateNotice("1.0.5")).toBeNull();
  });
  it("ignores downgrades", () => {
    localStorage.setItem("panda:seen-version", "1.1.0");
    expect(takeUpdateNotice("1.0.5")).toBeNull();
  });
});
