import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import catalog from "./fixtures/reco-catalog.json";
import type { PandaItem } from "../lib/types";
import type { RecoSection } from "../lib/reco/sections";
import { getFeedback, resetFeedbackCacheForTest } from "../lib/reco/feedback";
import tvSearchSrc from "../tv/TvSearch.tsx?raw";
import mSearchSrc from "../mobile/MSearch.tsx?raw";

const items = (catalog as unknown as { rails: { items: PandaItem[] }[] }).rails[0]!.items.slice(0, 8);
const sections: RecoSection[] = [
  { id: "top-picks", title: "Panda Top Picks for Asha", items, reasons: { [items[0]!.id]: "You picked Thriller" }, note: "Picked for this profile from what it likes and watches" },
  { id: "trending", title: "Trending now", items: [...items].reverse() }
];
vi.mock("../lib/reco/useRecommendations", () => ({
  useRecommendations: () => ({ sections, ranked: [], model: { genres: new Map(), genreWhy: new Map(), seeds: [], signals: 0, type: { movie: 0.5, tv: 0.5 }, popularity: "mix", era: "mix" }, loading: false, error: null, retry: () => {} })
}));

const { TvDiscover } = await import("../tv/TvDiscover");
const { MDiscover } = await import("../mobile/MDiscover");

const wrap = (ui: React.ReactNode) => {
  const { hook } = memoryLocation({ path: "/search" });
  return render(<Router hook={hook}>{ui}</Router>);
};

describe("v1.4.0 Search discovery", () => {
  beforeEach(() => { localStorage.clear(); resetFeedbackCacheForTest(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("puts Panda Top Picks first and shows only the engine's real reasons", () => {
    const r = wrap(<TvDiscover onOpen={() => {}} />);
    const titles = [...r.container.querySelectorAll(".tv-row-title")].map((e) => e.textContent);
    expect(titles[0]).toBe("Panda Top Picks for Asha");
    expect(titles[1]).toBe("Trending now");
    const first = r.container.querySelector<HTMLElement>("#res-0")!;
    act(() => { first.focus(); });
    expect(r.container.querySelector(".tv-reco-why")!.textContent).toBe("You picked Thriller");
    // a title without a reason shows the row note, never an invented reason
    act(() => { r.container.querySelector<HTMLElement>("#reco-top-picks-1")!.focus(); });
    expect(r.container.querySelector(".tv-reco-why")!.textContent).toBe("Picked for this profile from what it likes and watches");
  });

  it("TV: a short OK opens the title, holding OK opens the feedback actions", () => {
    vi.useFakeTimers();
    const onOpen = vi.fn();
    const r = wrap(<TvDiscover onOpen={onOpen} />);
    const card = r.container.querySelector<HTMLElement>("#res-0")!;
    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyUp(card, { key: "Enter" });
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".qa-sheet")).toBeNull();
    fireEvent.keyDown(card, { key: "Enter" });
    act(() => { vi.advanceTimersByTime(600); });
    fireEvent.keyUp(card, { key: "Enter" });
    expect(onOpen).toHaveBeenCalledTimes(1);
    const labels = [...document.querySelectorAll(".qa-sheet .sheet-item")].map((e) => e.textContent);
    expect(labels).toEqual(expect.arrayContaining(["More like this", "Not interested", "Hide from recommendations", "Already watched"]));
  });

  it("feedback actions are recorded for the profile and opens are logged", () => {
    const onOpen = vi.fn();
    const r = wrap(<MDiscover onOpen={onOpen} />);
    const link = r.container.querySelector<HTMLElement>(".m-reco-top-link")!;
    fireEvent.click(link);
    expect(onOpen).toHaveBeenCalled();
    fireEvent.click(r.container.querySelector<HTMLElement>(".m-reco-more")!);
    const notInterested = [...document.querySelectorAll<HTMLElement>(".qa-sheet .sheet-item")].find((e) => e.textContent === "Not interested")!;
    fireEvent.click(notInterested);
    const kinds = getFeedback(null).map((e) => e.kind);
    expect(kinds).toEqual(["open", "not-interested"]);
  });

  it("Search no longer shows the old Popular Searches grid before typing", () => {
    expect(tvSearchSrc).toContain("<TvDiscover");
    expect(mSearchSrc).toContain("<MDiscover");
    expect(tvSearchSrc).not.toMatch(/Popular Searches"/);
    expect(mSearchSrc).not.toMatch(/Popular Searches in/);
  });
});
