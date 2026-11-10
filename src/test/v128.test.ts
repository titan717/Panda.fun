import { describe, expect, it } from "vitest";
import paddlesSrc from "../components/DesktopMouse.tsx?raw";
import deviceSrc from "../lib/device.ts?raw";
import tvShellSrc from "../tv/TvShell.tsx?raw";
import mShellSrc from "../mobile/MobileShell.tsx?raw";
import mobileCss from "../styles/mobile.css?raw";
import { playerShortcut, SHORTCUTS } from "../lib/shortcuts";
import { nativeScroller, pageRow, paddleBox } from "../components/DesktopMouse";

const key = (k: string, target: Partial<HTMLElement> | null = null, mods: Partial<KeyboardEvent> = {}) =>
  ({ key: k, ctrlKey: false, metaKey: false, altKey: false, target: target as EventTarget | null, ...mods });

describe("player keyboard shortcuts (v1.2.8)", () => {
  it("maps the common web-player letters", () => {
    expect(playerShortcut(key("k"))).toBe("toggle");
    expect(playerShortcut(key("K"))).toBe("toggle");
    expect(playerShortcut(key("j"))).toBe("back10");
    expect(playerShortcut(key("l"))).toBe("fwd10");
    expect(playerShortcut(key("m"))).toBe("mute");
    expect(playerShortcut(key("f"))).toBe("fullscreen");
    expect(playerShortcut(key("?"))).toBe("help");
    expect(playerShortcut(key("x"))).toBeNull();
  });
  it("never fires while typing or with a modifier", () => {
    expect(playerShortcut(key("k", { tagName: "INPUT" } as HTMLElement))).toBeNull();
    expect(playerShortcut(key("f", { tagName: "TEXTAREA" } as HTMLElement))).toBeNull();
    expect(playerShortcut(key("f", null, { ctrlKey: true }))).toBeNull();
    expect(playerShortcut(key("l", null, { metaKey: true }))).toBeNull();
  });
  it("lets Space press a focused button but toggles playback elsewhere", () => {
    const btn = document.createElement("button");
    expect(playerShortcut(key(" ", btn))).toBeNull();
    expect(playerShortcut(key(" ", document.createElement("div")))).toBe("toggle");
    expect(playerShortcut(key(" ", null))).toBe("toggle");
  });
  it("documents every shortcut it handles", () => {
    const listed = SHORTCUTS.flatMap((s) => s.keys).join(" ");
    for (const k of ["Space", "K", "J", "L", "M", "F", "C", "?"]) expect(listed).toContain(k);
  });
});

describe("desktop wheel on focus-driven TV pages (v1.2.8)", () => {
  it("treats row-scrolled pages as focus-driven and real scrollers as native", () => {
    const page = document.createElement("div");
    page.dataset.scrollY = "row";
    const card = document.createElement("a");
    page.appendChild(card); document.body.appendChild(page);
    expect(nativeScroller(card, page)).toBeNull();

    const list = document.createElement("div");
    list.style.overflowY = "auto";
    Object.defineProperty(list, "scrollHeight", { value: 900 });
    Object.defineProperty(list, "clientHeight", { value: 300 });
    const row = document.createElement("button");
    list.appendChild(row);
    const plain = document.createElement("div");
    plain.appendChild(list); document.body.appendChild(plain);
    expect(nativeScroller(row, plain)).toBe(list);
    page.remove(); plain.remove();
  });
  it("is wired as a non-passive window wheel listener", () => {
    expect(paddlesSrc).toMatch(/addEventListener\("wheel", onWheel, \{ passive: false \}\)/);
  });
});

describe("row paddles for mouse users (v1.2.8)", () => {
  const row = (scrollWidth: number, clientWidth: number, scrollLeft: number) => {
    const el = document.createElement("div");
    Object.defineProperty(el, "scrollWidth", { value: scrollWidth });
    Object.defineProperty(el, "clientWidth", { value: clientWidth });
    el.scrollLeft = scrollLeft;
    Object.defineProperty(el, "scrollLeft", { value: scrollLeft, writable: true });
    el.getBoundingClientRect = () => ({ left: 100, top: 200, width: clientWidth, height: 300, right: 100 + clientWidth, bottom: 500, x: 100, y: 200, toJSON: () => ({}) });
    return el;
  };
  it("shows nothing for rows that fit", () => { expect(paddleBox(row(800, 800, 0))).toBeNull(); });
  it("shows only the sides that can scroll", () => {
    expect(paddleBox(row(3000, 1000, 0))).toMatchObject({ canLeft: false, canRight: true, top: 200, height: 300 });
    expect(paddleBox(row(3000, 1000, 900))).toMatchObject({ canLeft: true, canRight: true });
    expect(paddleBox(row(3000, 1000, 2000))).toMatchObject({ canLeft: true, canRight: false });
  });
  it("pages by most of the visible width", () => {
    const el = row(3000, 1000, 0);
    let by: ScrollToOptions | undefined;
    el.scrollBy = ((o: ScrollToOptions) => { by = o; }) as typeof el.scrollBy;
    pageRow(el, 1);
    expect(by?.left).toBe(850);
    pageRow(el, -1);
    expect(by?.left).toBe(-850);
  });
  it("are pointer-only, never focusable, and only downloaded where a mouse can hover", () => {
    expect(deviceSrc).toMatch(/\(hover: hover\) and \(pointer: fine\)/);
    expect(deviceSrc).toMatch(/!isTvDevice\(\)/);
    expect(paddlesSrc.match(/tabIndex=\{-1\}/g)?.length).toBe(2);
    for (const shell of [tvShellSrc, mShellSrc]) expect(shell).toMatch(/finePointer\(\) \? lazyNamed\(\(\) => import\("..\/components\/DesktopMouse"\)/);
  });
});

describe("mobile touch targets (v1.2.8)", () => {
  it("give small controls a 44 px hit area without changing their look", () => {
    const css = mobileCss;
    expect(css).toMatch(/:is\(\.m-link, \.m-head-link, \.m-whats-new\)::after \{ content: ""; position: absolute; inset: -12px -8px; \}/);
    expect(css).toMatch(/\.m-more \{ width: 36px; height: 40px;/);
  });
});
