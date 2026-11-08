import { afterEach, describe, expect, it } from "vitest";
import { setBigScreenForTest, sizedImage } from "../lib/imageTier";
import swSource from "../../public/sw.js?raw";

describe("4K artwork tier", () => {
  afterEach(() => setBigScreenForTest(null));
  it("keeps sizes on normal screens", () => {
    setBigScreenForTest(false);
    expect(sizedImage("https://image.tmdb.org/t/p/w342/a.jpg")).toBe("https://image.tmdb.org/t/p/w342/a.jpg");
  });
  it("steps TMDB sizes up one level on 4K", () => {
    setBigScreenForTest(true);
    expect(sizedImage("https://image.tmdb.org/t/p/w342/a.jpg")).toBe("https://image.tmdb.org/t/p/w500/a.jpg");
    expect(sizedImage("https://image.tmdb.org/t/p/w780/b.jpg")).toBe("https://image.tmdb.org/t/p/w1280/b.jpg");
    expect(sizedImage("https://image.tmdb.org/t/p/original/c.jpg")).toBe("https://image.tmdb.org/t/p/original/c.jpg");
  });
  it("leaves other hosts and empty values alone", () => {
    setBigScreenForTest(true);
    expect(sizedImage("https://example.org/t/p/w342/a.jpg")).toBe("https://example.org/t/p/w342/a.jpg");
    expect(sizedImage(null)).toBeNull();
    expect(sizedImage(undefined)).toBeUndefined();
  });
});

describe("service worker", () => {
  const sw = swSource;
  it("never caches the API or the update feed", () => {
    expect(sw).not.toMatch(/caches\.open[^\n]*api/i);
    expect(sw).toContain("image.tmdb.org");
  });
  it("is not registered outside production https", async () => {
    const { registerServiceWorker } = await import("../lib/sw");
    expect(() => registerServiceWorker()).not.toThrow();
  });
});
