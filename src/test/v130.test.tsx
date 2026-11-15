import { describe, expect, it, vi } from "vitest";
import { splitWall, wallLayers } from "../components/PosterWall";
import { dissolveIntoHome, PUSH_MS } from "../pages/Profiles";
import profilesCss from "../pages/profiles.css?raw";
import tvCss from "../styles/tv.css?raw";
import remoteSrc from "../lib/remote.ts?raw";
import profilesSrc from "../pages/Profiles.tsx?raw";

/*
 * v1.4.0: the v1.3.0 non-skippable launch intro (eyes/ribbons, Web Audio score, input block) was replaced by the
 * Intro Manager (lib/intro, components/Intro.tsx); its tests moved to src/test/v140-intro.test.tsx. Who's watching
 * (poster wall, push-in, dissolve) is unchanged and still tested here.
 */

/* ---------------- Who's watching ---------------- */

describe("v1.3.0 Who's watching", () => {
  it("draws 3 depth layers on TV, 2 on phones, 1 in lite mode", () => {
    expect(wallLayers(true, false).map((l) => l.key)).toEqual(["far", "mid", "near"]);
    expect(wallLayers(false, false).map((l) => l.key)).toEqual(["far", "near"]);
    expect(wallLayers(true, true)).toEqual([{ key: "near", cols: 6, speed: 1 }]);
    expect(wallLayers(false, true)[0]!.cols).toBe(4);
    // far layers drift more slowly (parallax)
    const [far, mid, near] = wallLayers(true, false);
    expect(far!.speed).toBeGreaterThan(mid!.speed);
    expect(mid!.speed).toBeGreaterThan(near!.speed);
  });
  it("keeps the near band free of repeats and fills every layer", () => {
    const posters = Array.from({ length: 60 }, (_, i) => `p${i}.jpg`);
    const cols = splitWall(posters, wallLayers(true, false));
    expect(cols.map((l) => l.length)).toEqual([12, 9, 7]);
    const near = cols[2]!.flat();
    expect(new Set(near).size).toBe(near.length);
    expect(splitWall(posters.slice(0, 20), wallLayers(true, false))).toEqual([]);
  });
  it("blurs only far layers, statically, and keeps the blueprint colours and horizon", () => {
    expect(profilesCss).toMatch(/\.poster-wall-layer--far img \{[^}]*filter: blur/);
    expect(profilesCss).toMatch(/\.poster-wall-layer--mid img \{[^}]*filter: blur/);
    expect(profilesCss).not.toMatch(/\.poster-wall-layer--near img \{[^}]*filter/);
    expect(profilesCss).toContain("color: #E6D6FF");
    expect(profilesCss).toContain("color: #B9A6DA");
    expect(tvCss).toContain("top: calc(var(--horizon) - 6 * var(--u) - 60 * var(--tu))");
    expect(profilesCss).toContain(".profile-btn:focus .profile-lift");
  });
  // v1.4.0: whoDone() is gone — the picked profile is remembered in the store and restored on the next cold start
  it("keeps preload, waits for the intro and pushes in before Home", () => {
    expect(profilesSrc).toContain("void preload(keys.page(kind), fetcher)");
    expect(profilesSrc).toContain("if (!reduce) dissolveIntoHome(); if (!stay)");
    expect(profilesSrc).toContain('const waiting = introPhase === "show";');
    expect(PUSH_MS).toBeGreaterThanOrEqual(500);
    expect(PUSH_MS).toBeLessThanOrEqual(700);
  });
  it("dissolves into Home with a veil that always removes itself", () => {
    vi.useFakeTimers();
    dissolveIntoHome();
    expect(document.querySelectorAll(".who-veil")).toHaveLength(1);
    vi.advanceTimersByTime(900);
    expect(document.querySelectorAll(".who-veil")).toHaveLength(0);
    vi.useRealTimers();
  });
  it("ignores phone-remote text while the intro plays", () => {
    expect(remoteSrc).toContain("if (!introActive()) typeIntoTv(text, open)");
  });
});
