import { beforeEach, describe, expect, it } from "vitest";
import { clearRecoMetrics, logOpened, logShown, recoFunnel, resetRecoMetricsCacheForTest } from "../lib/reco/metrics";

describe("v1.4.0 on-device recommendation metrics", () => {
  beforeEach(() => { localStorage.clear(); resetRecoMetricsCacheForTest(); });

  it("computes impression → open → start → completion per row and in total", () => {
    for (const id of ["a", "b", "c", "d"]) logShown(id, "top-picks", "p1", 1000);
    logShown("e", "trending", "p1", 1000);
    logShown("a", "top-picks", "p1", 5000); // same title, same row: not a new impression
    logOpened("a", "p1", 2000);
    logOpened("b", "p1", 2000);
    logOpened("e", "p1", 2000);
    const history = {
      a: { position: 0, completed: true, updatedAt: 3000 },  // opened, then finished
      b: { position: 300, completed: false, updatedAt: 3000 }, // opened, then started
      e: { position: 500, completed: false, updatedAt: 1500 }, // watched before the open: not credited
    };
    const f = recoFunnel("p1", history);
    const all = f.find((x) => x.surface === "all")!;
    const top = f.find((x) => x.surface === "top-picks")!;
    expect(f[0]!.surface).toBe("all");
    expect(all).toMatchObject({ shown: 5, opened: 3, started: 2, completed: 1 });
    expect(top).toMatchObject({ shown: 4, opened: 2, started: 2, completed: 1, ctr: 0.5, startRate: 1, completionRate: 0.5 });
    expect(f.find((x) => x.surface === "trending")).toMatchObject({ shown: 1, opened: 1, started: 0 });
  });

  it("is kept per profile, persisted and clearable", () => {
    logShown("a", "top-picks", "p1");
    logShown("a", "top-picks", "p2");
    resetRecoMetricsCacheForTest();
    expect(recoFunnel("p1", {})[0]!.shown).toBe(1);
    clearRecoMetrics("p1");
    expect(recoFunnel("p1", {})).toEqual([]);
    expect(recoFunnel("p2", {})[0]!.shown).toBe(1);
  });
});
