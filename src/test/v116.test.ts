import { afterEach, describe, expect, it, vi } from "vitest";
import { lruMap, memoryCap } from "../lib/cache";
import { canPrefetch, setPrefetchDataSaver, setPreloadMode } from "../lib/network";
import { actions, getPrefs } from "../lib/store";
import settingsSrc from "../pages/Settings.tsx?raw";
import { preconnect, prefetchSegments, prefetchTitle, resetPrefetch, warmPlayback } from "../lib/prefetch";
import { preloadImages, resetPreload } from "../lib/preload";
import playerSrc from "../pages/Player.tsx?raw";
import appSrc from "../App.tsx?raw";
import cardsSrc from "../mobile/MCards.tsx?raw";

const setConnection = (c: object | undefined) => Object.defineProperty(navigator, "connection", { value: c, configurable: true });

afterEach(() => { setConnection(undefined); resetPrefetch(); resetPreload(); vi.restoreAllMocks(); document.head.querySelectorAll("link[rel=preconnect],link[rel=dns-prefetch]").forEach((l) => l.remove()); });

describe("v1.1.6 bounded SWR memory cache", () => {
  it("evicts the least recently used entries past the cap", () => {
    const m = lruMap(3);
    m.set("/a", { data: 1 }); m.set("/b", { data: 2 }); m.set("/c", { data: 3 });
    m.get("/a"); // /a becomes the youngest
    m.set("/d", { data: 4 });
    expect([...m.keys()]).toEqual(["/c", "/a", "/d"]);
    expect(m.get("/b")).toBeUndefined();
    expect(m.size).toBe(3);
  });
  it("never evicts pinned keys (SWR bookkeeping, in-flight requests)", () => {
    const m = lruMap(2, (k) => k.startsWith("$"));
    m.set("$ctx$/x", { data: 0 }); m.set("/a", { data: 1 }); m.set("/b", { data: 2 }); m.set("/c", { data: 3 });
    expect(m.get("$ctx$/x")).toBeDefined();
    expect(m.get("/a")).toBeUndefined();
  });
  it("uses a tighter cap on TV and low-memory devices", () => {
    document.documentElement.dataset.mode = "tv";
    expect(memoryCap()).toBe(240);
    document.documentElement.dataset.mode = "mobile";
    expect([240, 400]).toContain(memoryCap());
  });
});

describe("v1.1.6 network-aware prefetch", () => {
  it("prefetches on normal connections and stops on Data Saver, 2G and the Data Saver quality", () => {
    expect(canPrefetch()).toBe(true);
    setConnection({ saveData: true }); expect(canPrefetch()).toBe(false);
    setConnection({ effectiveType: "2g" }); expect(canPrefetch()).toBe(false);
    setConnection({ effectiveType: "4g" }); expect(canPrefetch()).toBe(true);
    setPrefetchDataSaver(true); expect(canPrefetch()).toBe(false);
    setPrefetchDataSaver(false); expect(canPrefetch()).toBe(true);
  });
  it("honours Settings › Data & storage › Preload titles", () => {
    setPreloadMode("off"); expect(canPrefetch()).toBe(false);
    setPreloadMode("wifi");
    setConnection({ type: "cellular", effectiveType: "4g" }); expect(canPrefetch()).toBe(false);
    setConnection({ type: "wifi", effectiveType: "4g" }); expect(canPrefetch()).toBe(true);
    setConnection({ effectiveType: "4g" }); expect(canPrefetch()).toBe(true);
    setPreloadMode("smart");
    setConnection({ type: "cellular", effectiveType: "4g" }); expect(canPrefetch()).toBe(true);
  });
  it("stores the preload choice in prefs and shows it in Settings", () => {
    expect(getPrefs().preloadMode).toBe("smart");
    actions.setPrefs({ preloadMode: "wifi" });
    expect(getPrefs().preloadMode).toBe("wifi");
    actions.setPrefs({ preloadMode: "smart" });
    expect(settingsSrc).toMatch(/id="preload" title="Preload titles"/);
  });
  it("limits image warm-up to one image on Data Saver", () => {
    setConnection({ saveData: true });
    expect(preloadImages(["https://image.tmdb.org/t/p/w780/a.jpg", "https://image.tmdb.org/t/p/w780/b.jpg", "https://image.tmdb.org/t/p/w780/c.jpg"], 10)).toBe(1);
  });
  it("warms each title once and skips everything on Data Saver", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ success: true, data: {} })));
    expect(prefetchTitle("movie", 550)).toBe(true);
    expect(prefetchTitle("movie", 550)).toBe(false);
    setConnection({ saveData: true });
    expect(prefetchTitle("movie", 551)).toBe(false);
    expect(prefetchSegments("tt0137523")).toBe(false);
  });
  it("preconnects to a source origin only once", () => {
    expect(preconnect("https://cinesrc.st")).toBe(true);
    expect(preconnect("https://cinesrc.st")).toBe(false);
    expect(document.head.querySelectorAll('link[rel=preconnect][href="https://cinesrc.st"]').length).toBe(1);
    expect(document.head.querySelectorAll('link[rel=dns-prefetch][href="https://cinesrc.st"]').length).toBe(1);
  });
  it("Details warms the preferred source, the resume episode's markers and its season", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ success: true, data: {} })));
    const r = warmPlayback({ type: "tv", tmdbId: 1396, imdbId: "tt0903747", season: 2, episode: 3 }, "vidy");
    expect(r).toEqual({ source: true, segments: true, season: true });
    expect(document.head.querySelector('link[rel=preconnect][href="https://vidy.st"]')).not.toBeNull();
    const movie = warmPlayback({ type: "movie", tmdbId: 550, imdbId: null }, "cinesrc");
    expect(movie).toEqual({ source: true, segments: false, season: false });
    setConnection({ saveData: true });
    expect(warmPlayback({ type: "movie", tmdbId: 550, imdbId: "tt0137523" })).toEqual({ source: false, segments: false, season: false });
  });
});

describe("v1.1.6 smaller bundles and intent prefetch wiring", () => {
  it("loads the TV player chrome lazily and warms it on TV only", () => {
    expect(playerSrc).toMatch(/lazyNamed\(loadTvChrome, "TvPlayerChrome"\)/);
    expect(playerSrc).not.toMatch(/import \{ TvPlayerChrome/);
    expect(appSrc).toMatch(/mode === "tv"\) void m\.loadTvChrome\(\)/);
  });
  it("mobile posters start the title request on touch down", () => {
    expect(cardsSrc.match(/onPointerDown=\{\(\) => prefetchItem\(item\)\}/g)?.length).toBeGreaterThanOrEqual(2);
  });
  it("Data Saver quality turns speculative fetching off app-wide", () => {
    expect(appSrc).toMatch(/setPrefetchDataSaver\(quality === "480"\)/);
  });
});
