import { describe, expect, it, beforeEach } from "vitest";
import { effectiveTier, lastResortOnly, rankSources, TIER_LABEL } from "../lib/shield";
import { embedUrl, ADAPTERS, SOURCE_ORDER } from "../lib/player";
import { playback, DEFAULT_TIER } from "../lib/validate";
import { sourceRanking } from "../lib/validateLazy";
import { tierLabel } from "../lib/sources";
import { seekDelta, seekStep } from "../tv/TvPlayerChrome";
import { median, recordTtff, TickWatch, ttffStats, ttffLabel } from "../lib/ttff";
import { trailerEmbedUrl, TRAILER_ALLOW, TRAILER_SANDBOX } from "../components/Trailer";
import { playClock } from "../lib/format";
import type { PlaybackSource } from "../lib/types";

const src = (id: PlaybackSource["id"], tier: PlaybackSource["tier"], url = `https://${id}.example/movie/550`): PlaybackSource =>
  ({ id, provider: id, label: id, url, origin: "https://x", events: id === "cinesrc" ? "cinesrc" : "vidy", supportsStart: true, tier });

describe("ad tiers (v1.2.4, §6)", () => {
  it("sorts by tier before any ranking, and outside the app a popup source is tier 4", () => {
    const list = [src("vidlink", 3), src("vidy", 2), src("cinesrc", 1)];
    // community order prefers VidLink, but the tier wins
    expect(rankSources(list, ["vidlink", "vidy", "cinesrc"], { tv: false, shielded: true }).map((s) => s.id)).toEqual(["cinesrc", "vidy", "vidlink"]);
    expect(effectiveTier({ id: "vidlink", tier: 3 }, false)).toBe(4);
    expect(effectiveTier({ id: "vidlink", tier: 3 }, true)).toBe(3);
    expect(effectiveTier({ id: "cinesrc", tier: 1 }, false)).toBe(1);
    expect(TIER_LABEL[1]).toBe("Ad-free");
  });
  it("never picks a tier 3/4 source first on TV and tier 4 anywhere", () => {
    expect(lastResortOnly("vidlink", true, 3)).toBe(true);
    expect(lastResortOnly("vidlink", false, 3)).toBe(true); // browsers: no native firewall → tier 4
    expect(lastResortOnly("cinesrc", true, 1)).toBe(false);
    expect(tierLabel("vidlink").tier).toBe(4);
  });
  it("reads tiers from the backend and falls back to the measured defaults", () => {
    const p = playback("/panda/play/movie/550", { type: "movie", tmdbId: 550, sources: [
      { id: "vidlink", url: "https://vidlink.pro/movie/550", origin: "https://vidlink.pro", events: "vidy", tier: 3 },
      { id: "cinesrc", url: "https://cinesrc.st/embed/movie/550", origin: "https://cinesrc.st", events: "cinesrc" },
      { id: "evil", url: "https://evil.example", origin: "https://evil.example", tier: 1 }
    ] });
    expect(p.sources.map((s) => [s.id, s.tier])).toEqual([["vidlink", 3], ["cinesrc", 1]]);
    expect(DEFAULT_TIER.vidy).toBe(2);
    const r = sourceRanking("/panda/sources/ranking", { sources: [{ id: "vidlink", rank: 4, tier: 3, ads: { popups: 1, navigations: 0, adRequests: 20, measuredAt: "2026-11-09" } }] });
    expect(r.sources[0]!.tier).toBe(3);
    expect(r.sources[0]!.ads?.adRequests).toBe(20);
  });
});

describe("VidLink adapter", () => {
  it("is registered last with its own controls and no command API", () => {
    expect(SOURCE_ORDER[SOURCE_ORDER.length - 1]).toBe("vidlink");
    expect(ADAPTERS.vidlink.commands).toBe(false);
    expect(ADAPTERS.vidlink.hosts).toEqual(["vidlink.pro"]);
  });
  it("resumes with startAt, hands over the subtitle file and starts over cleanly", () => {
    const s = src("vidlink", 3, "https://vidlink.pro/movie/550?primaryColor=1f80e0&startAt=600");
    const u = new URL(embedUrl(s, { customChrome: false, start: 1234.6, subtitle: { url: "https://apikinoma.vercel.app/api/v1/panda/subtitles/file?f=x", label: "English" } }));
    expect(u.searchParams.get("startAt")).toBe("1234");
    expect(u.searchParams.get("sub_file")).toContain("https://apikinoma.vercel.app/");
    expect(u.searchParams.get("sub_label")).toBe("English");
    const over = new URL(embedUrl(s, { customChrome: false, start: 0 }));
    expect(over.searchParams.has("startAt")).toBe(false);
    expect(new URL(embedUrl(s, { customChrome: false, subtitle: { url: "http://insecure", label: "x" } })).searchParams.has("sub_file")).toBe(false);
  });
});

describe("player 1.2.4", () => {
  it("accumulates the seek step and labels the jump", () => {
    expect([0, 4, 10, 18].map(seekStep)).toEqual([10, 20, 30, 60]);
    expect(seekDelta(90)).toBe("+1:30");
    expect(seekDelta(-20)).toBe("\u22120:20");
    expect(seekDelta(3725)).toBe("+1:02:05");
    expect(playClock(1394)).toBe("23:14");
  });
  it("detects a stall from the source's own update rhythm", () => {
    const w = new TickWatch();
    expect(w.stalledFor(1000)).toBe(0);
    for (let t = 0; t <= 2500; t += 250) w.tick(t);
    expect(w.threshold()).toBe(625);
    expect(w.stalledFor(2900)).toBe(0);
    expect(w.stalledFor(3200)).toBe(700);
    w.reset();
    expect(w.started).toBe(false);
  });
  beforeEach(() => localStorage.clear());
  it("records time to first frame per source", () => {
    recordTtff("cinesrc", 1800); recordTtff("cinesrc", 2200); recordTtff("cinesrc", 1400); recordTtff("cinesrc", -5);
    expect(ttffStats().cinesrc).toEqual({ median: 1800, samples: 3 });
    expect(median([])).toBeNull();
    expect(ttffLabel(1800)).toBe("Starts in 1.8 s");
  });
});

describe("clean trailers", () => {
  it("uses only current, hardened embed parameters", () => {
    const u = new URL(trailerEmbedUrl("abc", "https://panda.example"));
    expect(u.hostname).toBe("www.youtube-nocookie.com");
    for (const [k, v] of Object.entries({ enablejsapi: "1", controls: "0", disablekb: "1", fs: "0", iv_load_policy: "3", cc_load_policy: "0", rel: "0", playsinline: "1" })) expect(u.searchParams.get(k)).toBe(v);
    expect(u.searchParams.get("origin")).toBe("https://panda.example");
    expect(u.searchParams.has("modestbranding")).toBe(false);
    expect(u.searchParams.has("showinfo")).toBe(false);
    expect(TRAILER_SANDBOX).toBe("allow-scripts allow-same-origin");
    expect(TRAILER_ALLOW).toBe("autoplay; encrypted-media");
  });
});
