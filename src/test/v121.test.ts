import { describe, expect, it, vi } from "vitest";
import { autoTrack, clockAt, cuesAt, loadCues, offsetLabel, parseVtt, subLangName, SUB_LANGS } from "../lib/captions";
import { subtitles } from "../lib/validateLazy";
import { ADAPTERS, capabilityLabels } from "../lib/player";
import type { SubtitleTrack } from "../lib/types";

const t = (over: Partial<SubtitleTrack>): SubtitleTrack => ({ id: "en-1", language: "en", label: "English", hearingImpaired: false, downloads: 1, release: "", file: "/api/v1/panda/subtitles/file?f=x", ...over });

describe("WebVTT / SRT parsing (v1.2.1)", () => {
  it("reads VTT and SRT stamps, keeps i/b/u markup only and sorts cues", () => {
    const cues = parseVtt("WEBVTT\n\n2\n00:00:05,500 --> 00:00:07,000\n<font color=red><i>Second</i></font>\n\n00:01.000 --> 00:02.000 align:start\nFirst\nline two\n\n00:00:09.000 --> 00:00:08.000\nbroken");
    expect(cues).toEqual([{ start: 1, end: 2, lines: ["First", "line two"] }, { start: 5.5, end: 7, lines: ["<i>Second</i>"] }]);
  });
  it("finds the cues showing at a time, including overlaps", () => {
    const cues = parseVtt("WEBVTT\n\n00:00:01.000 --> 00:00:10.000\nA\n\n00:00:02.000 --> 00:00:03.000\nB\n\n00:00:20.000 --> 00:00:21.000\nC");
    expect(cuesAt(cues, 2.5).map((c) => c.lines[0])).toEqual(["A", "B"]);
    expect(cuesAt(cues, 15)).toEqual([]);
    expect(cuesAt(cues, 0)).toEqual([]);
  });
});

describe("caption clock and timing", () => {
  it("interpolates between sparse time updates and caps the gap", () => {
    expect(clockAt({ position: 10, at: 1000, playing: true, rate: 1 }, 1500)).toBeCloseTo(10.5);
    expect(clockAt({ position: 10, at: 1000, playing: true, rate: 2 }, 1500)).toBeCloseTo(11);
    expect(clockAt({ position: 10, at: 1000, playing: true, rate: 1 }, 60_000)).toBe(15);
    expect(clockAt({ position: 10, at: 1000, playing: false, rate: 1 }, 9000)).toBe(10);
  });
  it("labels the offset", () => {
    expect(offsetLabel(0)).toBe("In sync");
    expect(offsetLabel(1.5)).toBe("+1.5 s later");
    expect(offsetLabel(-0.5)).toBe("−0.5 s earlier");
  });
});

describe("automatic track per profile", () => {
  const tracks = [t({ id: "en-sdh", hearingImpaired: true }), t({ id: "en-1" }), t({ id: "hi-1", language: "hi", label: "Hindi" })];
  it("turns on for foreign audio only in foreign mode", () => {
    expect(autoTrack(tracks, { mode: "foreign", lang: "en", lang2: null, sdh: false, original: "en" })).toBeNull();
    expect(autoTrack(tracks, { mode: "foreign", lang: "en", lang2: null, sdh: false, original: "ko" })?.id).toBe("en-1");
    expect(autoTrack(tracks, { mode: "always", lang: "en", lang2: null, sdh: false, original: "en" })?.id).toBe("en-1");
    expect(autoTrack(tracks, { mode: "off", lang: "en", lang2: null, sdh: false, original: "ko" })).toBeNull();
  });
  it("prefers SDH when asked and falls back to the second language", () => {
    expect(autoTrack(tracks, { mode: "always", lang: "en", lang2: null, sdh: true, original: null })?.id).toBe("en-sdh");
    expect(autoTrack(tracks, { mode: "always", lang: "ta", lang2: "hi", sdh: false, original: null })?.id).toBe("hi-1");
    expect(autoTrack([], { mode: "always", lang: "en", lang2: null, sdh: false, original: null })).toBeNull();
  });
});

describe("subtitle list validation and loading", () => {
  it("drops tracks whose file is not served by the Panda API", () => {
    const out = subtitles("/panda/subtitles/tt1", { imdbId: "tt1", season: null, episode: null, tracks: [
      { id: "a", language: "en", label: "English", file: "/api/v1/panda/subtitles/file?f=a", hearingImpaired: true, downloads: 3 },
      { id: "b", language: "en", label: "English", file: "https://evil.example/x.srt" },
      { id: "c", language: "en", label: "", file: "/api/v1/panda/subtitles/file?f=c" },
    ] });
    expect(out.tracks.map((x) => x.id)).toEqual(["a"]);
    expect(out.tracks[0]).toMatchObject({ hearingImpaired: true, downloads: 3, release: "" });
    expect(() => subtitles("/panda/subtitles/tt1", null)).toThrow();
  });
  it("loads cues once per file and reports empty files", async () => {
    const f = vi.fn(async () => new Response("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi"));
    const tr = t({ file: "/api/v1/panda/subtitles/file?f=once" });
    expect((await loadCues(tr, f as unknown as typeof fetch))[0]!.lines).toEqual(["Hi"]);
    await loadCues(tr, f as unknown as typeof fetch);
    expect(f).toHaveBeenCalledTimes(1);
    const empty = vi.fn(async () => new Response("WEBVTT\n"));
    await expect(loadCues(t({ file: "/api/v1/panda/subtitles/file?f=empty" }), empty as unknown as typeof fetch)).rejects.toThrow(/empty/);
  });
  it("knows its languages and which sources take Panda subtitles", () => {
    expect(SUB_LANGS.length).toBeGreaterThanOrEqual(30);
    expect(subLangName("hi")).toBe("Hindi");
    expect(ADAPTERS.cinesrc!.captions && ADAPTERS.vidy!.captions).toBe(true);
    expect(ADAPTERS.vidyanime!.captions).toBe(false);
    expect(capabilityLabels("cinesrc")).toContain("Panda subtitles");
  });
});
