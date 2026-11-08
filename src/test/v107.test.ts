import { describe, expect, it, vi, afterEach } from "vitest";
import { airsLater } from "../lib/format";

describe("airsLater", () => {
  const now = new Date(2026, 10, 8, 12);
  it("treats future air dates as upcoming", () => { expect(airsLater("2026-11-09", now)).toBe(true); });
  it("treats today and past as available", () => {
    expect(airsLater("2026-11-08", now)).toBe(false);
    expect(airsLater("2020-01-01", now)).toBe(false);
  });
  it("ignores missing or malformed dates", () => {
    expect(airsLater(null, now)).toBe(false);
    expect(airsLater("soon", now)).toBe(false);
  });
});

describe("native voice fallback", () => {
  afterEach(() => { delete (window as { KinomaNative?: unknown }).KinomaNative; vi.resetModules(); });
  it("uses the Android recogniser when the bridge offers it", async () => {
    const start = vi.fn();
    (window as unknown as { KinomaNative: object }).KinomaNative = { hasVoiceSearch: () => true, startVoiceSearch: start };
    vi.resetModules();
    const v = await import("../lib/voice");
    expect(v.voiceSupported).toBe(true);
    const onText = vi.fn(), onState = vi.fn(), onErr = vi.fn();
    v.listen(onText, onState, onErr);
    expect(start).toHaveBeenCalled();
    expect(onState).toHaveBeenLastCalledWith(true);
    window.__pandaVoice?.("  the bear ");
    expect(onText).toHaveBeenCalledWith("the bear");
    expect(onState).toHaveBeenLastCalledWith(false);
  });
  it("reports an error on an empty result", async () => {
    (window as unknown as { KinomaNative: object }).KinomaNative = { hasVoiceSearch: () => true, startVoiceSearch: () => {} };
    vi.resetModules();
    const v = await import("../lib/voice");
    const onErr = vi.fn();
    v.listen(() => {}, () => {}, onErr);
    window.__pandaVoice?.("");
    expect(onErr).toHaveBeenCalled();
  });
});
