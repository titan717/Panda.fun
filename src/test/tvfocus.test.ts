import { afterEach, describe, expect, it } from "vitest";
import { nearestScrollTop, revealFocus, type NearestScroll } from "../lib/focus";

/** v1.3.2 TV focus: Settings-style "nearest" scrolling (data-scroll-y="nearest"). */
const base: NearestScroll = { scrollTop: 0, clientHeight: 800, scrollHeight: 2400, top: 0, height: 90, margin: 128, first: false, last: false };

describe("nearestScrollTop", () => {
  it("leaves a comfortably visible row alone", () => {
    expect(nearestScrollTop({ ...base, top: 300 })).toBeNull();
    expect(nearestScrollTop({ ...base, scrollTop: 500, top: 700 })).toBeNull();
  });
  it("Down scrolls by just enough to keep the margin below the row", () => {
    // row bottom 690 + margin 128 = 818 > 800 → scroll 18
    expect(nearestScrollTop({ ...base, top: 600 })).toBe(18);
    // the next row 97 px lower moves the page 97 px more: one row per press
    expect(nearestScrollTop({ ...base, scrollTop: 18, top: 697 })).toBe(115);
  });
  it("Up reverses Down exactly", () => {
    const down = nearestScrollTop({ ...base, scrollTop: 300, top: 1000 })!; // bottom 1090 + 128 - 800
    expect(down).toBe(418);
    // back up to a row whose top would sit inside the top margin
    expect(nearestScrollTop({ ...base, scrollTop: down, top: 500 })).toBe(372);
  });
  it("the first focusable shows the very top, the last the very bottom", () => {
    expect(nearestScrollTop({ ...base, scrollTop: 200, top: 120, first: true })).toBe(0);
    expect(nearestScrollTop({ ...base, scrollTop: 1300, top: 2100, last: true })).toBe(1600);
  });
  it("does not jump to the end when trailing content is taller than the view", () => {
    // last row at 900 but the page continues to 2400: scroll to the row, not to 1600 (which would hide it)
    expect(nearestScrollTop({ ...base, scrollTop: 0, top: 900, last: true })).toBe(318);
  });
  it("aligns a row taller than the view with its top and clamps to the scroll range", () => {
    expect(nearestScrollTop({ ...base, top: 1000, height: 700 })).toBe(950);
    expect(nearestScrollTop({ ...base, scrollTop: 1600, top: 2300, height: 90 })).toBeNull(); // already at max
    expect(nearestScrollTop({ ...base, scrollTop: 50, top: 10 })).toBe(0);
  });
});

describe("revealFocus in a nearest scroller", () => {
  afterEach(() => { document.body.innerHTML = ""; });
  const rect = (top: number, height: number) => ({ top, bottom: top + height, left: 0, right: 100, width: 100, height, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;

  function setup() {
    document.body.innerHTML = `<section id="panel" data-scroll-y="nearest">${Array.from({ length: 20 }, (_, i) => `<button id="b${i}">Row ${i}</button>`).join("")}</section>`;
    const panel = document.getElementById("panel")!;
    let scrollTop = 0;
    const calls: number[] = [];
    Object.defineProperty(panel, "clientHeight", { value: 800 });
    Object.defineProperty(panel, "scrollHeight", { value: 20 * 100 });
    Object.defineProperty(panel, "scrollTop", { get: () => scrollTop, set: (v: number) => { scrollTop = v; } });
    panel.scrollTo = ((o: ScrollToOptions) => { calls.push(o.top!); scrollTop = o.top!; }) as typeof panel.scrollTo;
    panel.getBoundingClientRect = () => rect(100, 800);
    panel.querySelectorAll<HTMLElement>("button").forEach((b, i) => {
      Object.defineProperty(b, "offsetHeight", { value: 90 });
      b.getBoundingClientRect = () => rect(100 + i * 100 - scrollTop, 90);
    });
    return { panel, calls, el: (i: number) => document.getElementById(`b${i}`)! };
  }

  it("walks down one row at a time and back up to the top", () => {
    const { calls, el, panel } = setup();
    for (let i = 0; i < 20; i++) revealFocus(el(i));
    // nothing moves while rows are well inside the view, then each Down moves exactly one row (100 px)
    const steps = calls.slice(1, -1).map((v, i) => v - calls[i]!);
    expect(steps.every((s) => s === 100)).toBe(true);
    expect(panel.scrollTop).toBe(1200); // the last row scrolls to the end
    for (let i = 19; i >= 0; i--) revealFocus(el(i));
    expect(panel.scrollTop).toBe(0);
  });
});
