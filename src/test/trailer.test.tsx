import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { rankTrailers, pickTrailer } from "../components/Trailer";
import { useTrailerStage } from "../lib/hooks";
import { wall, validatorFor } from "../lib/validate";
import { isAudioUnlocked, registerTrailer, stopAllTrailers, unlockAudio } from "../lib/audio";

const v = (key: string, type: string, official = true) => ({ key, type, official });

describe("rankTrailers", () => {
  it("prefers official trailers, then teasers, then the rest", () => {
    expect(rankTrailers([v("c", "Clip"), v("t2", "Trailer", false), v("t", "Teaser"), v("a", "Trailer")])).toEqual(["a", "t2", "t"]);
    expect(pickTrailer([v("c", "Clip")])).toBe("c");
    expect(rankTrailers(undefined)).toEqual([]);
    expect(pickTrailer([])).toBeNull();
  });
});

describe("useTrailerStage", () => {
  afterEach(() => { vi.useRealTimers(); });
  it("preloads 3 s early, plays at the delay and resets when focus moves", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ on, k }) => useTrailerStage(on, 5, k), { initialProps: { on: true, k: "a" } });
    expect(result.current).toBe("idle");
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current).toBe("preload");
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current).toBe("play");
    rerender({ on: true, k: "b" });
    expect(result.current).toBe("idle");
    act(() => { vi.advanceTimersByTime(4900); });
    expect(result.current).toBe("preload");
    rerender({ on: false, k: "b" });
    expect(result.current).toBe("idle");
  });
});

describe("wall validator", () => {
  it("keeps unique https posters only", () => {
    const out = wall("/panda/wall", { posters: [
      { id: "movie:1", title: "A", poster: "https://image.tmdb.org/a.jpg" },
      { id: "movie:1", title: "A again", poster: "https://image.tmdb.org/a2.jpg" },
      { id: "tv:2", title: "B", poster: "http://insecure/b.jpg" },
      { id: "tv:3", title: "C", poster: "https://image.tmdb.org/a.jpg" },
      { id: "tv:4", poster: "https://image.tmdb.org/d.jpg" },
      "junk"
    ] });
    expect(out.posters.map((p) => p.id)).toEqual(["movie:1", "tv:4"]);
    expect(validatorFor("/panda/wall")).toBe(wall);
  });
});

describe("audio + one trailer at a time", () => {
  it("unlocks on a gesture and stops every registered trailer", () => {
    unlockAudio();
    expect(isAudioUnlocked()).toBe(true);
    const a = vi.fn(); const b = vi.fn();
    const offA = registerTrailer(a); registerTrailer(b);
    stopAllTrailers();
    expect(a).toHaveBeenCalled(); expect(b).toHaveBeenCalled();
    offA();
  });
});
