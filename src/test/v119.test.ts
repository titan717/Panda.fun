import { describe, expect, it } from "vitest";
import { arrangeHome, DEFAULT_HOME_ORDER, isCustomHome, moveSection, normalizeOrder, railKey } from "../lib/homeLayout";
import gradle from "../../android/app/build.gradle?raw";
import rules from "../../android/app/proguard-rules.pro?raw";

const row = (id: string) => ({ id });
const buckets = {
  continue: [row("continue")], "top-picks": [row("top-picks")], top10: [row("top10")],
  because: [row("because-0")], watched: [row("watched")], rails: [row("trending"), row("new"), row("because-1")]
};

describe("Personalize Home (v1.1.9)", () => {
  it("keeps the blueprint order by default", () => {
    expect(arrangeHome(buckets, [], []).map((r) => r.id)).toEqual(["continue", "top-picks", "top10", "because-0", "watched", "trending", "new", "because-1"]);
  });
  it("repairs saved orders: drops unknown ids, adds missing sections in their default place", () => {
    expect(normalizeOrder(["top10", "bogus", "top10", "continue"])).toEqual(["top10", "because", "watched", "rails", "continue", "top-picks"]);
    expect(normalizeOrder(undefined)).toEqual(DEFAULT_HOME_ORDER);
  });
  it("moves sections and stops at the ends", () => {
    expect(moveSection([], "top10", -1).slice(0, 3)).toEqual(["continue", "top10", "top-picks"]);
    expect(moveSection([], "continue", -1)).toEqual(DEFAULT_HOME_ORDER);
    expect(moveSection([], "rails", 1)).toEqual(DEFAULT_HOME_ORDER);
  });
  it("hides sections and single editorial rows", () => {
    const ids = arrangeHome(buckets, moveSection([], "rails", -1), ["continue", railKey("new")], new Set(["trending", "new"])).map((r) => r.id);
    expect(ids).toEqual(["top-picks", "top10", "because-0", "trending", "because-1", "watched"]);
    expect(isCustomHome([], [])).toBe(false);
    expect(isCustomHome(["continue"], [])).toBe(false);
    expect(isCustomHome([], ["top10"])).toBe(true);
    expect(isCustomHome(moveSection([], "watched", -1), [])).toBe(true);
  });
});

describe("R8 release build (v1.1.9)", () => {
  it("shrinks the release APK", () => {
    expect(gradle).toMatch(/minifyEnabled true/);
    expect(gradle).toMatch(/shrinkResources true/);
  });
  it("keeps the JavaScript bridge and the Gson models", () => {
    expect(rules).toMatch(/@android\.webkit\.JavascriptInterface <methods>/);
    for (const c of ["UpdateInfo", "GitHubRelease", "GitHubAsset", "MirrorEnvelope"]) expect(rules).toContain(`com.kinoma.tv.data.${c}`);
  });
});
