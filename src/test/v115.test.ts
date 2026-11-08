import { describe, expect, it } from "vitest";
import { detectIntro, forgetIntros, getIntro, inIntroWindow, learnIntro, nextCardDue, sleepDue, sleepLeft, sleepPillLabel, speedLabel, startSleep, SPEEDS, isSpeed } from "../lib/player2";
import { embedUrl, parseMessage } from "../lib/player";
import { actions, getPrefs } from "../lib/store";
import type { PlaybackSource } from "../lib/types";
import settingsSrc from "../pages/Settings.tsx?raw";
import chromeSrc from "../tv/TvPlayerChrome.tsx?raw";

const cine = { id: "cinesrc", events: "cinesrc", origin: "https://cinesrc.st", url: "https://cinesrc.st/embed/tv/1399?s=1&e=1" } as unknown as PlaybackSource;

describe("Player 2.0: speed", () => {
  it("offers 0.5×–2× with Normal at 1", () => {
    expect([...SPEEDS]).toEqual([0.5, 0.75, 1, 1.25, 1.5, 2]);
    expect(speedLabel(1)).toBe("Normal");
    expect(speedLabel(1.5)).toBe("1.5×");
    expect(isSpeed(1.25)).toBe(true);
    expect(isSpeed(3)).toBe(false);
  });
  it("persists the speed per profile", () => {
    const p = actions.addProfile("Speedy", "panda", false); actions.selectProfile(p.id);
    actions.setPrefs({ playbackSpeed: 1.5 });
    expect(getPrefs().playbackSpeed).toBe(1.5);
    const q = actions.addProfile("Slow", "panda", false); actions.selectProfile(q.id);
    expect(getPrefs().playbackSpeed).toBe(1);
  });
  it("reads CineSrc rate and skip-intro events", () => {
    expect(parseMessage(cine, "https://cinesrc.st", { type: "cinesrc:ratechange", data: { playbackRate: 1.25 } })).toEqual({ kind: "rate", rate: 1.25 });
    expect(parseMessage(cine, "https://cinesrc.st", { type: "cinesrc:skipintro", data: { time: 92 } })).toEqual({ kind: "skipintro", to: 92 });
  });
});

describe("Player 2.0: sleep timer", () => {
  it("counts down in minutes and fires on time", () => {
    const t = startSleep("30", 0);
    expect(sleepLeft(t, 0)).toBe(30);
    expect(sleepLeft(t, 29 * 60_000 + 1)).toBe(1);
    expect(sleepDue(t, 30 * 60_000 - 1)).toBe(false);
    expect(sleepDue(t, 30 * 60_000)).toBe(true);
    expect(sleepPillLabel(t, true, 0)).toBe("Sleep · 30 min");
  });
  it("supports Off and End of episode", () => {
    expect(sleepPillLabel(startSleep("off"), true)).toBe("Sleep Timer");
    expect(sleepPillLabel(startSleep("end"), true)).toBe("Sleep · End of episode");
    expect(sleepPillLabel(startSleep("end"), false)).toBe("Sleep · End of movie");
    expect(sleepDue(startSleep("end"))).toBe(false);
  });
});

describe("Player 2.0: skip intro", () => {
  it("learns an intro only from an early forward jump of 25–150 s", () => {
    expect(detectIntro(60, 150)).toEqual({ start: 60, end: 150 });
    expect(detectIntro(60, 70)).toBeNull();          // a 10 s nudge
    expect(detectIntro(60, 400)).toBeNull();         // scrubbing far ahead
    expect(detectIntro(1200, 1290)).toBeNull();      // mid-episode
    expect(detectIntro(120, 60)).toBeNull();         // backwards
  });
  it("remembers the intro per show and shows the pill in its window", () => {
    forgetIntros();
    expect(learnIntro(1399, 45, 135, 1)).toMatchObject({ start: 45, end: 135 });
    const intro = getIntro(1399);
    expect(intro).toMatchObject({ start: 45, end: 135 });
    expect(getIntro(1396)).toBeNull();
    expect(inIntroWindow(intro, 30)).toBe(false);
    expect(inIntroWindow(intro, 44)).toBe(true);
    expect(inIntroWindow(intro, 100)).toBe(true);
    expect(inIntroWindow(intro, 133)).toBe(false);
    forgetIntros();
    expect(getIntro(1399)).toBeNull();
  });
  it("passes autoskip to CineSrc only when the profile asks for it", () => {
    expect(embedUrl(cine, { customChrome: true, autoskip: true })).toContain("autoskip=true");
    expect(embedUrl(cine, { customChrome: true })).not.toContain("autoskip");
  });
});

describe("Player 2.0: next-episode card", () => {
  it("appears over the last 40 s when there is a next episode", () => {
    expect(nextCardDue(2560, 2600, true)).toBe(true);
    expect(nextCardDue(2500, 2600, true)).toBe(false);
    expect(nextCardDue(2599, 2600, true)).toBe(false);   // the up-next countdown takes over
    expect(nextCardDue(2580, 2600, false)).toBe(false);
    expect(nextCardDue(100, 120, true)).toBe(false);     // clips and trailers
  });
});

describe("Player 2.0: controls are wired", () => {
  it("adds Speed, Sleep Timer and intro settings", () => {
    expect(chromeSrc).toContain('id="tvp-sleep"');
    expect(chromeSrc).toContain('className="tvp-group">Speed');
    expect(settingsSrc).toContain('id="sp-autoskip"');
    expect(settingsSrc).toContain('id="sp-intros"');
  });
});

describe("Player 2.0: published markers", () => {
  it("prefers IntroDB markers and shows Skip Recap before Skip Intro", async () => {
    const { activeSkip } = await import("../lib/player2");
    const m = { recap: { start: 0, end: 60 }, intro: { start: 62, end: 120 }, learned: { start: 10, end: 90, at: 1 } };
    expect(activeSkip(20, m)).toEqual({ kind: "recap", end: 60 });
    expect(activeSkip(70, m)).toEqual({ kind: "intro", end: 120 });
    expect(activeSkip(118, m)).toBeNull();
    expect(activeSkip(30, { learned: { start: 10, end: 90, at: 1 } })).toEqual({ kind: "intro", end: 90 });
    expect(activeSkip(30, { intro: { start: 200, end: 260 }, learned: { start: 10, end: 90, at: 1 } })).toBeNull();
  });
  it("opens the next-episode card when the credits start", () => {
    expect(nextCardDue(2850, 2901, true, 2847)).toBe(true);
    expect(nextCardDue(2840, 2901, true, 2847)).toBe(false);
    expect(nextCardDue(2870, 2901, true, 100)).toBe(true);      // implausible marker → last 40 s rule
  });
});
