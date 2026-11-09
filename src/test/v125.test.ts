import { describe, expect, it } from "vitest";
import { trackLeft } from "../lib/focus";
import tokensCss from "../styles/tokens.css?raw";
import tvCss from "../styles/tv.css?raw";
import mobileCss from "../styles/mobile.css?raw";
import shellCss from "../tv/shell.css?raw";

/** v1.2.5 Home polish: row scrolling through positioned wrappers, numerals, type and spacing tokens. */
// "tv.css" means every TV rule: the entry sheet plus the shell sheet that loads with the TV chunk (D-147)
const SHEETS: Record<string, string> = { "tokens.css": tokensCss, "tv.css": tvCss + "\n" + shellCss, "mobile.css": mobileCss };
const css = (f: string) => SHEETS[f] ?? "";

/** happy-dom has no layout, so give each node the offsets a browser would compute. */
function box(tag: string, left: number, parent: HTMLElement | null, offsetParent: HTMLElement | null) {
  const el = document.createElement(tag);
  Object.defineProperty(el, "offsetLeft", { value: left });
  Object.defineProperty(el, "offsetParent", { value: offsetParent });
  Object.defineProperty(el, "clientLeft", { value: 0 });
  parent?.appendChild(el);
  return el;
}

describe("trackLeft (TV rows follow focus, v1.2.5)", () => {
  it("adds the wrapper's offset when a card sits inside a positioned Top 10 wrapper", () => {
    const section = box("section", 0, document.body, null); // .tv-row, position: relative
    const row = box("div", 160, section, section); // .tv-row-track, not positioned
    const wrap = box("div", 160 + 6 + 5 * 430, row, section); // 6th .tv-card-wrap.has-rank (position: relative)
    const card = box("a", 110, wrap, wrap); // the poster after the numeral
    // the card's offsetLeft alone is 110: the old code never scrolled past the first screen
    expect(card.offsetLeft).toBe(110);
    expect(trackLeft(card, row)).toBe(6 + 5 * 430 + 110);
  });
  it("uses the offset directly when the row itself is the offsetParent", () => {
    const row = box("div", 0, document.body, null);
    const card = box("a", 900, row, row);
    expect(trackLeft(card, row)).toBe(900);
  });
});

describe("Top 10 numerals (spec 6.4 / 12.4)", () => {
  it("TV and phone share the outlined stroke and gradient fill tokens", () => {
    const tokens = css("tokens.css");
    expect(tokens).toMatch(/--rank-stroke: rgba\(255, 255, 255, 0\.75\)/);
    expect(tokens).toMatch(/--rank-fill: linear-gradient/);
    expect(css("tv.css")).toMatch(/\.top10-num \{[^}]*-webkit-text-stroke: calc\(2\.5 \* var\(--tu\)\) var\(--rank-stroke\)[^}]*background: var\(--rank-fill\)/);
    expect(css("mobile.css")).toMatch(/\.m-rank \{[^}]*-webkit-text-stroke: 1\.5px var\(--rank-stroke\)[^}]*background: var\(--rank-fill\)/);
  });
  it("two-digit ranks get more room instead of being covered", () => {
    expect(css("tv.css")).toMatch(/\.tv-card-wrap\.is-wide-rank \{ padding-left: var\(--rank-pad-wide\); \}/);
    expect(css("mobile.css")).toMatch(/\.m-poster\.is-wide-rank \{ margin-left: 22px; \}/);
    // lining, proportional figures: Inter's tabular "1" has a foot that reads as a serif at 220 tu
    expect(css("tv.css")).not.toMatch(/tabular-nums/);
    expect(css("mobile.css")).not.toMatch(/tabular-nums/);
  });
  it("the phone numeral sits behind its poster", () => {
    expect(css("mobile.css")).not.toMatch(/\.m-rank \{[^}]*z-index/);
  });
});

describe("type scale and spacing rhythm (v1.2.5)", () => {
  it("rows and headers use the shared tokens", () => {
    const m = css("mobile.css"), tv = css("tv.css");
    expect(m).toMatch(/\.m-row, \.m-section, \.m-det-section \{ margin-bottom: var\(--m-row-space\); \}/);
    expect(m).toMatch(/\.m-head-title \{ font-size: var\(--m-header\);/);
    expect(tv).toMatch(/\.tv-row \{[^}]*margin-bottom: var\(--row-space\)/);
    expect(tv).toMatch(/\.tv-row-title \{[^}]*text-shadow: var\(--row-glow\)/);
  });
  it("the row chevron has a 44 px tap target and cards share hover, focus and press states", () => {
    const m = css("mobile.css");
    expect(m).toMatch(/\.m-row-more \{[^}]*width: var\(--m-hit\); height: var\(--m-hit\)/);
    expect(m).toMatch(/@media \(hover: hover\) and \(pointer: fine\) \{\s*\.m-poster:hover \.m-poster-media/);
    expect(m).toMatch(/\.m-poster:focus-visible \.m-poster-media/);
  });
});

describe("TV shell styles load with the TV chunk (v1.2.5, D-147)", () => {
  it("keeps Home, rows and cards out of the entry sheet", () => {
    for (const sel of [".rail", ".tv-row-title", ".top10-num", ".tv-hero-card", ".tv-search"]) {
      expect(tvCss.includes(sel + " ")).toBe(false);
      expect(shellCss.includes(sel)).toBe(true);
    }
  });
  it("keeps what renders outside the shell in the entry sheet", () => {
    for (const sel of [".tv-shell", ".sk-poster", '.state {', ".profiles-title", ".p2-still", ".tv-settings-list"]) expect(tvCss).toContain(sel);
  });
});
