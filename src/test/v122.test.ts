import { beforeEach, describe, expect, it } from "vitest";
import { binge, BRIGHT_MIN, classifyDrag, dragLevel, dragSeek, DRAG_SEEK_SPAN, DRAG_SLOP, shouldAskStill, STILL_AFTER } from "../lib/player2";
import { hideSpoiler, SPOILER_NOTE } from "../lib/watch";

describe("Are you still watching? (v1.2.2)", () => {
  beforeEach(() => binge.reset());

  it("asks before the 3rd automatic start by default (3 episodes watched in a row)", () => {
    binge.onEpisode(); // ep 1 picked by the viewer
    expect(binge.count).toBe(0);
    expect(shouldAskStill(3)).toBe(false);
    binge.markAuto(); binge.onEpisode(); // ep 2 started by itself
    expect(binge.count).toBe(1);
    expect(shouldAskStill(3)).toBe(false);
    binge.markAuto(); binge.onEpisode(); // ep 3 started by itself
    expect(binge.count).toBe(2);
    expect(shouldAskStill(3)).toBe(true);
  });

  it("any key, click or touch starts the count again", () => {
    binge.markAuto(); binge.onEpisode();
    binge.markAuto(); binge.onEpisode();
    binge.reset();
    expect(shouldAskStill(3)).toBe(false);
    binge.onEpisode(); // a picked episode never counts
    expect(binge.count).toBe(0);
  });

  it("Never turns the question off, and 2 asks after the second episode", () => {
    expect(shouldAskStill(0, 99)).toBe(false);
    expect(shouldAskStill(2, 0)).toBe(false);
    expect(shouldAskStill(2, 1)).toBe(true);
    expect(STILL_AFTER.map((o) => o.id)).toEqual(["2", "3", "4", "0"]);
    expect(STILL_AFTER.find((o) => o.note === "Default")?.id).toBe("3");
  });
});

describe("Swipe gestures (v1.2.2)", () => {
  it("ignores tiny movements so taps and double taps keep working", () => {
    expect(classifyDrag(DRAG_SLOP - 4, 3, 100, 400)).toBeNull();
  });
  it("sideways seeks; up/down is volume on the right and brightness on the left", () => {
    expect(classifyDrag(60, 10, 100, 400)).toBe("seek");
    expect(classifyDrag(-60, 5, 300, 400)).toBe("seek");
    expect(classifyDrag(4, -80, 300, 400)).toBe("volume");
    expect(classifyDrag(4, 80, 80, 400)).toBe("brightness");
  });
  it("a full-width drag moves two minutes and stays inside the video", () => {
    expect(dragSeek(600, 3600, 400, 400)).toBe(600 + DRAG_SEEK_SPAN);
    expect(dragSeek(600, 3600, -200, 400)).toBe(540);
    expect(dragSeek(10, 3600, -400, 400)).toBe(0);
    expect(dragSeek(3590, 3600, 400, 400)).toBe(3598);
  });
  it("dragging up raises a level, 60 % of the height covers the range, brightness keeps a floor", () => {
    expect(dragLevel(0.5, -60, 200)).toBe(1);
    expect(dragLevel(0.5, 30, 200)).toBe(0.25);
    expect(dragLevel(0.5, 500, 200)).toBe(0);
    expect(dragLevel(0.5, 500, 200, BRIGHT_MIN)).toBe(BRIGHT_MIN);
  });
});

describe("Spoiler protection (v1.2.2)", () => {
  it("hides only episodes the profile has not started, and only when turned on", () => {
    expect(hideSpoiler(false, false, 0)).toBe(false);
    expect(hideSpoiler(true, false, 0)).toBe(true);
    expect(hideSpoiler(true, true, 100)).toBe(false);
    expect(hideSpoiler(true, false, 42)).toBe(false);
    expect(SPOILER_NOTE).toMatch(/hidden/);
  });
});
