import { describe, expect, it } from "vitest";
import { DEFAULT_API_BASE, resolveApiBase } from "../lib/api";
import { item, playback, validatorFor, page } from "../lib/validate";
import { parseMessage } from "../lib/player";
import type { PlaybackSource } from "../lib/types";

describe("resolveApiBase", () => {
  it("falls back to apikinoma for empty, malformed or non-Vercel hosts", () => {
    expect(resolveApiBase(undefined)).toBe(DEFAULT_API_BASE);
    expect(resolveApiBase("not a url")).toBe(DEFAULT_API_BASE);
    expect(resolveApiBase("https://movieapi.example.com/api/v1")).toBe(DEFAULT_API_BASE);
  });
  it("accepts Vercel and local hosts and trims the trailing slash", () => {
    expect(resolveApiBase("https://other.vercel.app/api/v1/")).toBe("https://other.vercel.app/api/v1");
    expect(resolveApiBase("http://localhost:3000/api/v1")).toBe("http://localhost:3000/api/v1");
    expect(resolveApiBase("http://evil.vercel.app/api/v1")).toBe(DEFAULT_API_BASE);
  });
});

describe("validate", () => {
  it("drops malformed items instead of failing", () => {
    expect(item({ tmdbId: 550, type: "movie", title: "Fight Club" })?.id).toBe("movie:550");
    expect(item({ tmdbId: 550, type: "book", title: "x" })).toBeNull();
    expect(item(null)).toBeNull();
  });
  it("keeps only known https sources", () => {
    const p = playback("/panda/play/movie/550", {
      type: "movie", tmdbId: 550,
      sources: [
        { id: "cinesrc", url: "https://cinesrc.st/embed/movie/550", origin: "https://cinesrc.st", events: "cinesrc" },
        { id: "vidsrc", url: "https://vidsrc.xyz/embed/movie/550", origin: "https://vidsrc.xyz" },
        { id: "vidy", url: "http://www.vidy.st/movie/550", origin: "https://www.vidy.st" }
      ]
    });
    expect(p.sources.map((s) => s.id)).toEqual(["cinesrc"]);
  });
  it("picks validators by path", () => {
    expect(validatorFor("/panda/page/home")).toBe(page);
    expect(validatorFor("/panda/play/tv/1399?s=1&e=1")).toBe(playback);
  });
});

describe("Vidy events", () => {
  const vidy: PlaybackSource = { id: "vidy", provider: "vidy", label: "Vidy", url: "https://www.vidy.st/movie/550", origin: "https://www.vidy.st", events: "vidy", supportsStart: true };
  it("reads the live PLAYER_EVENT shape (timestamp field)", () => {
    const msg = JSON.stringify({ type: "PLAYER_EVENT", data: { event: "timeupdate", timestamp: 42, duration: 8348 } });
    expect(parseMessage(vidy, "https://www.vidy.st", msg)).toEqual({ kind: "time", position: 42, duration: 8348 });
  });
});
