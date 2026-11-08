import { afterEach, describe, expect, it, vi } from "vitest";

const TV_UA = "Mozilla/5.0 (Linux; Android 14) Chrome/120 PandaFun/1.0.6 (Android TV; Leanback; SmartTV)";
const setUa = (ua: string) => Object.defineProperty(navigator, "userAgent", { value: ua, configurable: true });
const bridge = (tv: boolean) => ({ getAppVersion: () => "1.0.6", isTV: () => tv, checkForUpdatesManual() {}, downloadUpdate() {} });

afterEach(() => { delete (window as { KinomaNative?: unknown }).KinomaNative; vi.resetModules(); });

describe("layout detection", () => {
  it("inside the Android app, a phone gets mobile even with a TV-looking user agent", async () => {
    setUa(TV_UA);
    window.KinomaNative = bridge(false);
    const { detectLayout, isTvDevice } = await import("../lib/device");
    expect(detectLayout()).toBe("mobile");
    expect(isTvDevice()).toBe(false);
  });
  it("inside the Android app, a TV gets the TV layout", async () => {
    setUa("Mozilla/5.0 (Linux; Android 14) Chrome/120");
    window.KinomaNative = bridge(true);
    const { detectLayout } = await import("../lib/device");
    expect(detectLayout()).toBe("tv");
  });
  it("browsers on smart TVs are still detected by user agent", async () => {
    setUa("Mozilla/5.0 (Web0S; Linux/SmartTV) Chrome/108");
    const { detectLayout } = await import("../lib/device");
    expect(detectLayout()).toBe("tv");
  });
});
