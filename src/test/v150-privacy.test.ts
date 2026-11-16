import { beforeEach, describe, expect, it } from "vitest";
import { clearFeedback, getFeedback, recordFeedback, resetFeedbackCacheForTest } from "../lib/reco/feedback";
import { logShown, recoFunnel, resetRecoMetricsCacheForTest } from "../lib/reco/metrics";
import { getTaste, resetTasteCache, saveTaste } from "../lib/tasteProfile";
import { forgetProfile } from "../lib/intel/runtime";

describe("v1.5.0 privacy: deleting a profile forgets its local learning", () => {
  beforeEach(() => { localStorage.clear(); resetFeedbackCacheForTest(); resetRecoMetricsCacheForTest(); resetTasteCache(); });

  it("removes feedback, metrics and taste for that profile only", () => {
    recordFeedback("a", { id: "movie:1", type: "movie", kind: "less" } as never);
    recordFeedback("b", { id: "movie:2", type: "movie", kind: "less" } as never);
    logShown("movie:1", "home", "a");
    logShown("movie:2", "home", "b");
    saveTaste("a", { genres: ["Drama"] } as never);
    saveTaste("b", { genres: ["Comedy"] } as never);
    forgetProfile("a");
    expect(getFeedback("a")).toEqual([]);
    expect(getFeedback("b")).toHaveLength(1);
    expect(recoFunnel("a", {})[0]?.shown ?? 0).toBe(0);
    expect(recoFunnel("b", {})[0]?.shown ?? 0).toBe(1);
    expect(getTaste("a")).toBeNull();
    expect(getTaste("b")).not.toBeNull();
    const raw = Object.values(localStorage).join(" ");
    expect(raw.includes("movie:1")).toBe(false);
    clearFeedback();
  });

  it("the opt-in encrypted sync payload carries no model, feedback, metrics or taste vectors", async () => {
    const { flatten } = await import("../lib/sync");
    const { getState } = await import("../lib/store");
    recordFeedback(getState().profiles[0]?.id ?? "_", { id: "movie:9", type: "movie", kind: "less" } as never);
    const out = flatten(getState(), {}, Date.now());
    for (const k of Object.keys(out)) expect(k).toMatch(/^(g|p|pp|w|m|l|h|r|s|a):/);
    const text = JSON.stringify(out);
    for (const word of ["weights", "dense", "affinity", "recofeedback", "recometrics"]) expect(text.includes(word)).toBe(false);
  });
});
