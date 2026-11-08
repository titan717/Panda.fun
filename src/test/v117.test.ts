import { describe, expect, it } from "vitest";
import shellSrc from "../tv/TvShell.tsx?raw";
import tokensSrc from "../styles/tokens.css?raw";
import tvCssSrc from "../styles/tv.css?raw";
import { getCalendarBadge, setCalendarBadges } from "../lib/badges";
import { buildCalendar, calendarBadges, dayLabel, followedIds, groupByDay, localDay, unseen } from "../lib/calendar";
import { actions, getState, selectData } from "../lib/store";
import { detailsCtas } from "../lib/watch";
import { lazyValidatorFor as validatorFor } from "../lib/validateLazy";
import type { CalendarEntry, PandaItem, TitleDetails } from "../lib/types";

const NOW = new Date(2026, 10, 8, 12).getTime();
const day = (n: number) => localDay(NOW + n * 86_400_000);
const show = { id: "tv:1399", tmdbId: 1399, type: "tv", title: "Show", backdrop: "b.jpg", releaseDate: "2011-04-17" } as unknown as PandaItem;
const film = { id: "movie:9", tmdbId: 9, type: "movie", title: "Film", backdrop: "f.jpg", releaseDate: day(5) } as unknown as PandaItem;
const empty = { watchlist: [] as PandaItem[], reminders: [] as PandaItem[], history: {} };

const entries: CalendarEntry[] = [
  { item: show, status: "Returning Series", lastEpisode: null, nextEpisode: null, episodes: [
    { season: 2, episode: 1, name: "Old", airDate: day(-40), still: null, runtime: 50 },
    { season: 2, episode: 2, name: "Fresh", airDate: day(-1), still: "s.jpg", runtime: 50 },
    { season: 2, episode: 3, name: "Episode 3", airDate: day(2), still: null, runtime: 50 }
  ] } as unknown as CalendarEntry,
  { item: film, status: "Post Production", lastEpisode: null, nextEpisode: null, episodes: [] } as unknown as CalendarEntry
];

describe("v1.1.7 Coming Up", () => {
  it("follows reminders first, then Watchlist shows, with valid ids only", () => {
    expect(followedIds({ ...empty, watchlist: [show, { ...film, id: "bad" }], reminders: [film] }, NOW)).toEqual(["movie:9", "tv:1399"]);
  });
  it("splits aired episodes from upcoming ones and drops old episodes", () => {
    const v = buildCalendar(entries, { ...empty, watchlist: [show], reminders: [film] }, NOW);
    expect(v.fresh.map((a) => a.key)).toEqual(["tv:1399:2:2"]);
    expect(v.fresh[0]!.href).toBe("/watch/tv/1399?s=2&e=2");
    expect(v.upcoming.map((a) => a.key)).toEqual(["tv:1399:2:3", "movie:9:release"]);
    expect(unseen(v.fresh, NOW)).toHaveLength(0);
    expect(unseen(v.fresh, NOW - 5 * 86_400_000)).toHaveLength(1);
  });
  it("labels and groups days", () => {
    expect(dayLabel(day(0), NOW)).toBe("Today");
    expect(dayLabel(day(1), NOW)).toBe("Tomorrow");
    expect(groupByDay(buildCalendar(entries, { ...empty, watchlist: [show] }, NOW).upcoming, NOW).map((g) => g.label)).toEqual(["Tue 10 Nov", "Fri 13 Nov"]);
  });
  it("validates calendar payloads", () => {
    const v = validatorFor("/panda/calendar?ids=tv:1399")!;
    expect(v("/panda/calendar", { entries: [{ item: { tmdbId: 1, type: "tv", title: "A" }, episodes: [{ season: 1, episode: 1, airDate: "2026-11-09" }, { season: "x" }] }, { item: null }] })).toMatchObject({ entries: [{ episodes: [{ season: 1 }] }] });
  });
  it("offers Remind Me instead of play for unreleased titles", () => {
    const d = { ...film, seasons: [], videos: [] } as unknown as TitleDetails;
    expect(detailsCtas(d, null).primary).toMatchObject({ kind: "remind", label: "Remind Me", href: "/title/movie/9" });
  });
  it("stores reminders and alert state per profile", () => {
    const p = actions.addProfile("Rem", "panda", false); actions.selectProfile(p.id);
    expect(actions.toggleReminder(film)).toBe(true);
    actions.markAlerted(["a", "b"]); actions.markAlertsSeen(NOW);
    const d = selectData(getState());
    expect(d.reminders.map((i) => i.id)).toEqual(["movie:9"]);
    expect(d.alerted).toEqual(expect.arrayContaining(["a", "b"]));
    expect(d.alertsSeenAt).toBe(NOW);
    expect(actions.toggleReminder(film)).toBe(false);
  });
});

describe("ad shield parity", () => {
  it("Android bundled app uses the same CSP as vercel.json", async () => {
    const v = JSON.parse((await import("../../vercel.json?raw")).default) as { headers: { headers: { key: string; value: string }[] }[] };
    const csp = v.headers.flatMap((h) => h.headers).find((h) => h.key === "Content-Security-Policy")!.value;
    const kt = (await import("../../android/app/src/main/java/com/kinoma/tv/ui/MainActivity.kt?raw")).default;
    expect(kt).toContain(`"Content-Security-Policy" to ${JSON.stringify(csp)}`);
  });
  it("blocklist script keeps provider hosts and adds observed ad hosts", async () => {
    const { parseHosts } = await import("../../scripts/update-blocklist.mjs");
    const out = parseHosts("0.0.0.0 ads.example.com\n0.0.0.0 cinesrc.st\n0.0.0.0 x.vidy.st\n# c\n127.0.0.1 localhost\n");
    expect(out).toContain("ads.example.com");
    expect(out).toContain("roadster24.com");
    expect(out).not.toContain("cinesrc.st");
    expect(out).not.toContain("x.vidy.st");
  });
});

describe("v1.1.7 calendar badges", () => {
  it("labels shows with fresh episodes and reminded films that came out", () => {
    const v = buildCalendar(entries, { ...empty, watchlist: [show], reminders: [film] }, NOW);
    const two = [...v.fresh, { ...v.fresh[0]!, key: "tv:1399:2:9" }];
    expect(calendarBadges(v.fresh).get("tv:1399")).toBe("NEW EPISODE");
    expect(calendarBadges(two).get("tv:1399")).toBe("2 NEW EPISODES");
    expect(calendarBadges([{ ...v.fresh[0]!, kind: "release", item: film }]).get("movie:9")).toBe("OUT NOW");
    expect(calendarBadges(v.fresh).has("movie:9")).toBe(false);
  });
  it("publishes badges to cards", () => {
    setCalendarBadges(new Map([["tv:1399", "NEW EPISODE"]]));
    expect(getCalendarBadge("tv:1399")).toBe("NEW EPISODE");
    expect(getCalendarBadge("movie:9")).toBeNull();
    setCalendarBadges(new Map());
  });
});

describe("v1.1.7 TV sidebar", () => {
  it("keeps the blueprint order, labels and geometry tokens", () => {
    const shell = shellSrc;
    const ids = [...shell.matchAll(/id: "(rail-[a-z]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(["rail-search", "rail-home", "rail-tv", "rail-movies", "rail-new", "rail-categories", "rail-myspace"]);
    expect(shell).toContain('label: "My Space"');
    const tokens = tokensSrc;
    expect(tokens).toContain("--rail-w-open: calc(400 * var(--tu))");
    expect(tokens).toContain("--rail-row: calc(94 * var(--tu))");
    const css = tvCssSrc;
    const rail = css.slice(css.indexOf("/* ---------- sidebar (4"), css.indexOf("/* ---------- home (5, 6)"));
    for (const m of rail.matchAll(/transition: ([^;]+);/g)) for (const part of m[1]!.split(",")) expect(["transform", "opacity", "color", "box-shadow"]).toContain(part.trim().split(" ")[0]);
    expect(rail).not.toMatch(/transition:[^;]*\b(width|left|margin|padding)\b/);
  });
});

describe("v1.1.7 Search refinement", () => {
  it("remembers titles opened from Search, newest first, without duplicates", async () => {
    const { actions: a, getState: g, selectData: sel } = await import("../lib/store");
    const one = { id: "movie:1", tmdbId: 1, type: "movie", title: "One" } as unknown as PandaItem;
    const two = { id: "tv:2", tmdbId: 2, type: "tv", title: "Two" } as unknown as PandaItem;
    a.clearRecentSearches();
    a.addRecentTitle(one); a.addRecentTitle(two); a.addRecentTitle(one);
    expect(sel(g()).recentTitles.map((i) => i.id)).toEqual(["movie:1", "tv:2"]);
    a.clearRecentSearches();
    expect(sel(g()).recentTitles).toEqual([]);
  });
  it("offers the blueprint's Popular Searches tabs in order", async () => {
    const { POPULAR_TABS } = await import("../lib/useSearchState");
    expect(POPULAR_TABS.map((t) => t.label)).toEqual(["India", "Hot & New", "Movies", "Shows"]);
  });
});
