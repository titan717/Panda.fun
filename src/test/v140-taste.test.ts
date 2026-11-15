import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearTaste, defaultTaste, getDraft, getTaste, markOnboardingSeen, markWelcomed, needsOnboarding, normalizeGenre, resetTasteCache,
  saveDraft, saveTaste, TASTE_GENRES, TASTE_KEY, validateTaste
} from "../lib/tasteProfile";
import { actions, getState } from "../lib/store";
import onboardingSrc from "../onboarding/Onboarding.tsx?raw";
import settingsSrc from "../pages/Settings.tsx?raw";

beforeEach(() => { localStorage.removeItem(TASTE_KEY); resetTasteCache(); });
afterEach(() => { localStorage.removeItem(TASTE_KEY); resetTasteCache(); });

describe("tasteProfile: validation and migration", () => {
  it("uses the TMDB genre names the API returns", () => {
    expect(TASTE_GENRES).toEqual(["Action", "Adventure", "Comedy", "Drama", "Thriller", "Horror", "Science Fiction", "Fantasy", "Romance", "Animation", "Documentary", "Mystery", "Crime"]);
    expect(normalizeGenre("sci-fi")).toBe("Science Fiction");
    expect(normalizeGenre("  horror ")).toBe("Horror");
    expect(normalizeGenre("Western")).toBeNull();
  });
  it("repairs bad values to safe defaults", () => {
    expect(validateTaste(null)).toBeNull();
    expect(validateTaste("x")).toBeNull();
    expect(validateTaste({ genres: ["Action", "action", "Nope", 3], contentType: "cartoons", popularity: "gems", era: 9, pace: "fast", completedAt: "now", skipped: "yes" })).toEqual({
      v: 1, genres: ["Action"], contentType: "both", popularity: "gems", era: "mix", length: "mix", pace: "fast", completedAt: null, skipped: false
    });
  });
  it("migrates the pre-release `type` field", () => {
    expect(validateTaste({ type: "movies" })!.contentType).toBe("movie");
    expect(validateTaste({ type: "shows" })!.contentType).toBe("tv");
  });
  it("recovers from corrupt storage", () => {
    localStorage.setItem(TASTE_KEY, "{broken");
    resetTasteCache();
    expect(getTaste("p1")).toBeNull();
    localStorage.setItem(TASTE_KEY, JSON.stringify({ v: 1, profiles: { p1: { genres: ["Drama"] }, p2: 7 }, seen: [1, "p3"], drafts: { p1: { step: "nope", taste: {} } } }));
    resetTasteCache();
    expect(getTaste("p1")!.genres).toEqual(["Drama"]);
    expect(getTaste("p2")).toBeNull();
    expect(getDraft("p1")!.step).toBe("genres");
  });
});

describe("tasteProfile: per-profile storage", () => {
  it("saves and reads per profile, isolated", () => {
    saveTaste("p1", { genres: ["Horror"], contentType: "movie", completedAt: 5 });
    saveTaste("p2", { genres: ["Comedy"] });
    expect(getTaste("p1")).toMatchObject({ genres: ["Horror"], contentType: "movie", completedAt: 5 });
    expect(getTaste("p2")!.genres).toEqual(["Comedy"]);
    resetTasteCache();
    expect(getTaste("p1")!.genres).toEqual(["Horror"]); // persisted
    expect(JSON.parse(localStorage.getItem(TASTE_KEY)!).profiles.p2.v).toBe(1);
  });
  it("saveTaste returns the validated copy and clears that profile's draft", () => {
    saveDraft("p1", { step: "taste", taste: { ...defaultTaste(), genres: ["Crime"] } });
    expect(getDraft("p1")!.step).toBe("taste");
    expect(saveTaste("p1", { genres: ["Crime", "x"] as string[] }).genres).toEqual(["Crime"]);
    expect(getDraft("p1")).toBeNull();
  });
  it("reset forgets answers and does not reopen onboarding by itself", () => {
    markWelcomed();
    const p = actions.addProfile("Reset me", "star", false);
    saveTaste(p.id, { genres: ["Drama"], completedAt: 1 });
    clearTaste(p.id);
    expect(getTaste(p.id)).toBeNull();
    expect(needsOnboarding(p.id)).toBe(false);
  });
});

describe("onboarding: who gets it", () => {
  it("a new device starts with Welcome; a returning device with saved state does not", () => {
    // this test file's store loaded with no saved state → first run
    expect(needsOnboarding(null)).toBe(true);
    localStorage.setItem(TASTE_KEY, "garbage-from-old-build"); resetTasteCache(); // unreadable → treated as returning
    expect(needsOnboarding(null)).toBe(false);
    for (const p of getState().profiles) expect(needsOnboarding(p.id)).toBe(false);
  });
  it("a new profile gets it once; answering or skipping ends it; kids never", () => {
    markWelcomed();
    const p = actions.addProfile("New", "panda", false);
    const k = actions.addProfile("Little", "kids", true);
    expect(needsOnboarding(p.id)).toBe(true);
    expect(needsOnboarding(k.id)).toBe(false);
    saveTaste(p.id, { skipped: true });
    expect(needsOnboarding(p.id)).toBe(false);
    const q = actions.addProfile("Other", "wave", false);
    markOnboardingSeen([q.id]);
    expect(needsOnboarding(q.id)).toBe(false);
  });
  it("UI has the welcome copy, every step, skip and back, D-pad helpers; Settings entries exist", () => {
    expect(onboardingSrc).toContain("Let's make your next movie night amazing.");
    for (const s of ["Let's go", "Skip for now", "Your Panda experience is ready!", "useBackHandler", "focusFirst", "data-hover-focus", "ob-dots"]) expect(onboardingSrc).toContain(s);
    expect(settingsSrc).toContain('title="Personalize recommendations"');
    expect(settingsSrc).toContain('title="Reset personalization"');
  });
});
