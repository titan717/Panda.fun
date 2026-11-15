import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanProfiles, load } from "../lib/store";
import appSrc from "../App.tsx?raw";
import launchSrc from "../lib/launch.ts?raw";

const prof = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: id.toUpperCase(), avatar: "smile", kids: false, createdAt: 1, ...extra });
const saved = (o: Record<string, unknown>) => JSON.stringify({ profiles: [prof("a"), prof("b")], activeProfileId: "a", prefs: {}, data: {}, profilePrefs: {}, ...o });

describe("v1.4.0 profile restore on a cold start", () => {
  afterEach(() => { localStorage.clear(); sessionStorage.clear(); vi.resetModules(); });

  it("restores the last selected profile from localStorage (no Who's watching)", () => {
    const s = load(saved({}));
    expect(s.activeProfileId).toBe("a");
    expect(s.profiles.map((p) => p.id)).toEqual(["a", "b"]);
  });
  it("asks again when the saved profile was deleted (unknown activeProfileId → null)", () => {
    expect(load(saved({ activeProfileId: "gone" })).activeProfileId).toBeNull();
    expect(load(saved({ activeProfileId: 42 })).activeProfileId).toBeNull();
  });
  it("Switch profile and deleting the active profile both clear the saved profile", async () => {
    localStorage.setItem("panda:v1:state", saved({}));
    const { actions, getState, flushStore } = await import("../lib/store");
    expect(getState().activeProfileId).toBe("a");
    actions.signOut(); flushStore();
    expect(JSON.parse(localStorage.getItem("panda:v1:state")!).activeProfileId).toBeNull();
    actions.selectProfile("b");
    actions.deleteProfile("b");
    expect(getState().activeProfileId).toBeNull();
    actions.selectProfile("does-not-exist");
    expect(getState().activeProfileId).toBeNull();
  });
  it("is the same rule after a module reload (simulated cold start): no session mark", async () => {
    localStorage.setItem("panda:v1:state", saved({ activeProfileId: "b" }));
    sessionStorage.clear();
    const { getState } = await import("../lib/store");
    expect(getState().activeProfileId).toBe("b");
    expect(launchSrc).not.toContain("sessionStorage");
  });

  it("recovers from corrupted state instead of crashing", () => {
    for (const raw of ["{not json", "null", "[]", "42", JSON.stringify({ profiles: "x" }), JSON.stringify({ profiles: [null, 3, { name: "no id" }] })]) {
      const s = load(raw);
      expect(s.profiles.length).toBeGreaterThan(0);
      expect(s.activeProfileId).toBeNull();
    }
  });
  it("repairs broken parts and keeps the good ones", () => {
    const s = load(saved({
      profiles: [prof("a", { avatar: "dragon", kids: "yes", name: "" }), prof("a"), prof("c")],
      activeProfileId: "c",
      prefs: "bad",
      profilePrefs: { a: 5, c: { preferredSource: "nope", volume: 0.5 } },
      data: { a: { watchlist: [{ id: "movie-1", tmdbId: 1 }, null, { id: 3 }], history: { x: null, "movie-1": { item: { id: "movie-1", tmdbId: 1 }, position: 5 } }, ratings: [], recentSearches: ["ok", 7] }, c: "garbage" }
    }));
    expect(s.profiles.map((p) => p.id)).toEqual(["a", "c"]); // duplicate id dropped
    expect(s.profiles[0]).toMatchObject({ avatar: "smile", kids: false, name: "Viewer" });
    expect(s.activeProfileId).toBe("c");
    expect(s.data.a!.watchlist).toHaveLength(1);
    expect(Object.keys(s.data.a!.history)).toEqual(["movie-1"]);
    expect(s.data.a!.ratings).toEqual({});
    expect(s.data.a!.recentSearches).toEqual(["ok"]);
    expect(s.data.c!.watchlist).toEqual([]);
    expect(s.profilePrefs.a).toEqual({});
    expect(s.profilePrefs.c).toEqual({ volume: 0.5 });
  });
  it("keeps profile data isolated: data only for surviving profiles, never shared", () => {
    const s = load(saved({ data: { a: { watchlist: [{ id: "movie-1", tmdbId: 1 }] }, zombie: { watchlist: [{ id: "movie-2", tmdbId: 2 }] } } }));
    expect(Object.keys(s.data).sort()).toEqual(["a", "b"]);
    expect(s.data.b!.watchlist).toEqual([]);
    expect(s.data.a!.watchlist).not.toBe(s.data.b!.watchlist);
    expect(cleanProfiles([prof("x"), prof("x")])).toHaveLength(1);
  });

  it("App: onboarding → (no profile) Who's watching → Home, intro on top", () => {
    const iOn = appSrc.indexOf("if (onboard && open");
    const iWho = appSrc.indexOf("if (!profile && open)");
    expect(iOn).toBeGreaterThan(0);
    expect(iWho).toBeGreaterThan(iOn);
    expect(appSrc).not.toContain("askWho");
    expect(appSrc).toContain('lazyNamed(loadOnboarding, "Onboarding")');
  });
});
