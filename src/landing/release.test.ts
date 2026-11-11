import { describe, expect, it } from "vitest";
import { formatSize, releaseInfo } from "./release";

describe("welcome release info (v1.2.9)", () => {
  const apk = { name: "Panda.fun-Android-TV.apk", size: 4586086, browser_download_url: "https://github.com/titan717/Panda.fun/releases/download/v1.2.8/Panda.fun-Android-TV.apk" };
  it("formats the real APK size in MB", () => {
    expect(formatSize(4586086)).toBe("4.4 MB");
  });
  it("reads version, size, date and links from the release", () => {
    const info = releaseInfo({ tag_name: "v1.2.8", published_at: "2026-11-10T10:00:00Z", assets: [apk, { name: "Panda.fun-Android-TV.apk.sha256", size: 99, browser_download_url: "https://x/sha" }] });
    expect(info.version).toBe("1.2.8");
    expect(info.size).toBe("4.4 MB");
    expect(info.date).toBeTruthy();
    expect(info.url).toBe(apk.browser_download_url);
    expect(info.sha).toBe("https://x/sha");
  });
  it("never invents values that the release does not have", () => {
    const info = releaseInfo({ tag_name: "v2.0.0", assets: [{ name: "other.zip", size: 10, browser_download_url: "https://x/o" }] });
    expect(info.size).toBeNull();
    expect(info.url).toBeNull();
    expect(info.date).toBeNull();
    expect(info.sha).toBeNull();
  });
});
