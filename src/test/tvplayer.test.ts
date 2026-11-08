import { describe, expect, it } from "vitest";
import { clock, seekStep, QUALITIES } from "../tv/TvPlayerChrome";
import { embedUrl } from "../lib/player";
import type { PlaybackSource } from "../lib/types";

const cine = { id: "cinesrc", url: "https://cinesrc.st/embed/movie/550?autoplay=true", events: "cinesrc" } as unknown as PlaybackSource;
const vidy = { id: "vidy", url: "https://vidy.st/movie/550", events: "vidy" } as unknown as PlaybackSource;

describe("TV player chrome helpers", () => {
  it("formats HH:MM:SS clocks", () => {
    expect(clock(0)).toBe("00:00:00");
    expect(clock(3725.9)).toBe("01:02:05");
    expect(clock(-4)).toBe("00:00:00");
  });
  it("accelerates the seek step while held", () => {
    expect(seekStep(0)).toBe(10);
    expect(seekStep(8)).toBe(30);
    expect(seekStep(20)).toBe(60);
  });
  it("lists the blueprint quality options in order", () => {
    expect(QUALITIES.map((q) => q.id)).toEqual(["auto", "2160", "1080", "720", "480"]);
  });
});

describe("embedUrl", () => {
  it("hides CineSrc controls for the custom chrome and applies quality and resume", () => {
    const u = new URL(embedUrl(cine, { customChrome: true, start: 125.4, quality: "1080" }));
    expect(u.searchParams.get("controls")).toBe("false");
    expect(u.searchParams.get("quality")).toBe("1080");
    expect(u.searchParams.get("t")).toBe("125");
    expect(u.searchParams.get("continueprompt")).toBe("false");
    expect(u.searchParams.get("autonext")).toBe("false");
    expect(u.searchParams.get("back")).toBe("close");
    expect(u.searchParams.get("autoplay")).toBe("true");
  });
  it("keeps native controls and auto quality untouched", () => {
    const u = new URL(embedUrl(cine, { customChrome: false, quality: "auto" }));
    expect(u.searchParams.has("controls")).toBe(false);
    expect(u.searchParams.has("quality")).toBe(false);
    expect(u.searchParams.has("t")).toBe(false);
  });
  it("passes resume to Vidy via progress", () => {
    const u = new URL(embedUrl(vidy, { customChrome: true, start: 90 }));
    expect(u.searchParams.get("progress")).toBe("90");
    expect(embedUrl(vidy, { customChrome: true })).toBe(vidy.url);
  });
});
