import type { HistoryEntry, Rating } from "../store";
import type { MediaType, PandaItem } from "../types";
import type { FeedbackEvent } from "./feedback";
import { canonicalGenres } from "./genres";

/**
 * Local per-profile preference model. Built on the device from what the profile told onboarding (cold start) and
 * what it did since (history, ratings, Watchlist, lists, feedback). Every weight below is a plain, documented
 * number — this is a transparent weighted model, not machine learning (docs/RECOMMENDATIONS.md).
 */

/** The parts of the onboarding taste profile the engine reads (src/lib/tasteProfile.ts owns the full type). */
export interface TasteLike {
  genres: readonly string[];
  contentType: "movie" | "tv" | "both";
  popularity: "popular" | "gems" | "mix";
  era: "new" | "classic" | "mix";
  length?: "short" | "long" | "mix";
  pace?: "fast" | "slow" | "mix";
  skipped?: boolean;
}

export interface ProfileSignals {
  taste: TasteLike | null;
  history: Record<string, HistoryEntry>;
  watchlist: readonly PandaItem[];
  lists?: readonly { items: readonly PandaItem[] }[];
  ratings: Record<string, Rating>;
  feedback?: readonly FeedbackEvent[];
}

/** Where a genre's weight came from, so explanations can say it honestly. */
export type GenreWhy = "picked" | "watched" | "rated" | "saved" | "feedback";

export interface PreferenceModel {
  /** Genre affinity in [-1, 1]. */
  genres: Map<string, number>;
  /** The largest single contributor per genre. */
  genreWhy: Map<string, GenreWhy>;
  /** Preference for each type in [0, 1] (0.5 = no preference). */
  type: Record<MediaType, number>;
  popularity: TasteLike["popularity"];
  era: TasteLike["era"];
  /** Share of watched titles per original language. */
  languages: Map<string, number>;
  /** Titles that must never be recommended (finished, disliked, hidden, not interested, already watched). */
  exclude: Set<string>;
  /** Titles in progress (they belong in Continue Watching, not in recommendations). */
  inProgress: Set<string>;
  saved: Set<string>;
  /** Number of behavioural signals (0 = pure cold start from onboarding, or nothing at all). */
  signals: number;
  /** Seeds for "similar title" candidates, strongest first. */
  seeds: { item: PandaItem; why: "watched" | "loved" | "saved" | "more"; weight: number }[];
}

/** Signal weights (documented in docs/RECOMMENDATIONS.md). */
export const MODEL_WEIGHTS = {
  picked: 1.0,          // a genre chosen in onboarding
  completed: 1.0,       // a finished title, per genre
  progress: 0.5,        // a started title
  love: 1.6, like: 0.9, dislike: -1.6,
  saved: 0.5,           // Watchlist / a list
  more: 1.2, notInterested: -0.8, watchedFeedback: 0.4, open: 0.15, play: 0.3,
  /** Onboarding picks fade as real behaviour accumulates: picked × 1 / (1 + signals / taper). */
  taper: 12
} as const;

export const MAX_MODEL_SEEDS = 6;

export function buildModel(p: ProfileSignals): PreferenceModel {
  const W = MODEL_WEIGHTS;
  const raw = new Map<string, number>();
  const why = new Map<string, { k: GenreWhy; v: number }>();
  const add = (genres: readonly string[], v: number, k: GenreWhy) => {
    for (const g of canonicalGenres(genres)) {
      raw.set(g, (raw.get(g) ?? 0) + v);
      const w = why.get(g);
      if (v > 0 && (!w || v > w.v)) why.set(g, { k, v });
    }
  };
  const exclude = new Set<string>();
  const inProgress = new Set<string>();
  const saved = new Set<string>();
  const typeCount: Record<MediaType, number> = { movie: 0, tv: 0 };
  const langs = new Map<string, number>();
  let signals = 0;

  const hist = Object.values(p.history).sort((a, b) => b.updatedAt - a.updatedAt);
  for (const h of hist) {
    const done = h.completed;
    // a show is "in progress" until the profile finishes it; finished movies and shows are never re-recommended
    if (done) exclude.add(h.item.id); else inProgress.add(h.item.id);
    add(h.item.genres, done ? W.completed : W.progress, "watched");
    typeCount[h.item.type] += done ? 1 : 0.6;
    if (h.item.language) langs.set(h.item.language, (langs.get(h.item.language) ?? 0) + 1);
    signals++;
  }
  const known = new Map<string, PandaItem>();
  for (const h of hist) known.set(h.item.id, h.item);
  for (const i of p.watchlist) { known.set(i.id, i); saved.add(i.id); add(i.genres, W.saved, "saved"); typeCount[i.type] += 0.3; signals++; }
  for (const l of p.lists ?? []) for (const i of l.items) { if (saved.has(i.id)) continue; known.set(i.id, i); saved.add(i.id); add(i.genres, W.saved, "saved"); signals++; }
  for (const [id, r] of Object.entries(p.ratings)) {
    const it = known.get(id);
    if (r === "dislike") exclude.add(id);
    if (!it) continue;
    add(it.genres, r === "love" ? W.love : r === "like" ? W.like : W.dislike, "rated");
    if (r !== "dislike") typeCount[it.type] += 0.5;
    signals++;
  }
  const moreSeeds: PandaItem[] = [];
  for (const e of p.feedback ?? []) {
    const g = e.genres ?? known.get(e.id)?.genres ?? [];
    switch (e.kind) {
      case "more": add(g, W.more, "feedback"); exclude.delete(e.id); moreSeeds.push(known.get(e.id) ?? stub(e)); signals++; break;
      case "not-interested": add(g, W.notInterested, "feedback"); exclude.add(e.id); signals++; break;
      case "hide": exclude.add(e.id); break;
      case "watched": add(g, W.watchedFeedback, "watched"); exclude.add(e.id); signals++; break;
      case "open": add(g, W.open, "watched"); break;
      case "play": add(g, W.play, "watched"); break;
    }
  }
  // cold start: onboarding picks, fading as behaviour accumulates
  const t = p.taste && !p.taste.skipped ? p.taste : null;
  if (t) {
    const f = W.picked / (1 + signals / W.taper);
    for (const g of canonicalGenres(t.genres)) {
      raw.set(g, (raw.get(g) ?? 0) + f * 2);
      const w = why.get(g);
      if (!w || f * 2 >= w.v) why.set(g, { k: "picked", v: f * 2 });
    }
  }
  const max = Math.max(1e-9, ...[...raw.values()].map(Math.abs));
  const genres = new Map([...raw].map(([g, v]) => [g, Math.max(-1, Math.min(1, v / max))] as const));

  const tc = typeCount.movie + typeCount.tv;
  let movie = tc > 0 ? 0.5 + 0.5 * ((typeCount.movie - typeCount.tv) / (tc + 2)) : 0.5;
  if (t?.contentType === "movie") movie = Math.min(1, movie + 0.3 / (1 + signals / W.taper));
  if (t?.contentType === "tv") movie = Math.max(0, movie - 0.3 / (1 + signals / W.taper));
  const lt = [...langs.values()].reduce((a, b) => a + b, 0);
  const languages = new Map([...langs].map(([k, v]) => [k, v / Math.max(1, lt)] as const));

  // seeds: "more like this" first, then loved, then recent watching, then saved — each title once
  const seeds: PreferenceModel["seeds"] = [];
  const seen = new Set<string>();
  const seed = (item: PandaItem, w: PreferenceModel["seeds"][number]["why"], weight: number) => {
    if (seen.has(item.id) || p.ratings[item.id] === "dislike" || seeds.length >= MAX_MODEL_SEEDS) return;
    seen.add(item.id); seeds.push({ item, why: w, weight });
  };
  for (const i of moreSeeds.reverse()) seed(i, "more", 1.6);
  for (const [id, r] of Object.entries(p.ratings)) if (r === "love" && known.has(id)) seed(known.get(id)!, "loved", 1.5);
  for (const h of hist.slice(0, 3)) seed(h.item, "watched", 1.2);
  for (const [id, r] of Object.entries(p.ratings)) if (r === "like" && known.has(id)) seed(known.get(id)!, "loved", 1.2);
  for (const i of p.watchlist) seed(i, "saved", 1);
  for (const h of hist.slice(3)) seed(h.item, "watched", 1);

  return {
    genres, genreWhy: new Map([...why].map(([g, w]) => [g, w.k] as const)),
    type: { movie, tv: 1 - movie }, popularity: t?.popularity ?? "mix", era: t?.era ?? "mix",
    languages, exclude, inProgress, saved, signals, seeds
  };
}

function stub(e: FeedbackEvent): PandaItem {
  const [, n] = e.id.split(":");
  return { id: e.id, tmdbId: Number(n) || 0, type: e.type, title: e.title ?? "", year: null, rating: null, poster: null, posterLarge: null, backdrop: null, backdropLarge: null, overview: null, genres: e.genres ?? [], language: null, releaseDate: null };
}
