import { useCallback, useEffect, useMemo, type RefObject } from "react";
import useSWRInfinite from "swr/infinite";
import { preload } from "swr";
import { apiGet } from "../api";
import { useHistoryMap, usePrefs, useProfile, useRatings } from "../store";
import { useTaste } from "../tasteProfile";
import { useHiddenRecoIds } from "../reco/useHidden";
import { canonicalGenres } from "../reco/genres";
import { isKidsSafe } from "../kids";
import { affinities, type LearnerState } from "../intel/learner";
import { intelState, intelStatus, noteCategory, useIntelVersion } from "../intel/runtime";
import { CATEGORY_BY_ID, categoryPath, eligible, type CategoryDef } from "./catalog";
import { dayKey, rankCategories, type RankContext } from "./rank";
import type { ListPayload, PageKind, PandaItem } from "../types";

/**
 * v1.5.0 infinite Home feed: after the page's own rows, Home keeps going with categories ranked for the profile
 * (src/lib/feed/rank.ts). Categories load in batches (cursor = position in the ranked list), each batch is one SWR
 * entry (persisted, so a warm start and Back from Details paint the same rows at once), a rail needs at least
 * MIN_ITEMS titles that no earlier row already showed, and the next batch is prefetched while the current one is
 * on screen. The order is frozen for the visit (per profile, page and day) so rows never move under the D-pad focus;
 * what the profile does today changes tomorrow's order.
 */
export const BATCH = 4;
export const MIN_ITEMS = 6;
export const MAX_ITEMS = 20;

export interface FeedRow { id: string; kind: "poster"; title: string; items: PandaItem[]; link: string | null; cat: string }
interface BatchResult { id: string; items: PandaItem[] }

const orders = new Map<string, string[]>();
const sizes = new Map<string, number>();
const seenCats = new Set<string>();

export function feedKind(kind: PageKind): "home" | "movies" | "tv" | null {
  return kind === "home" || kind === "movies" || kind === "tv" ? kind : null;
}

/** Learned affinities from the on-device model, squashed to −1..1, by canonical genre and language code. */
export function contextFromModel(s: LearnerState | null) {
  const genreAffinity = new Map<string, number>();
  const langAffinity = new Map<string, number>();
  if (s) {
    for (const a of affinities(s)) {
      if (a.key.startsWith("g:")) genreAffinity.set(a.key.slice(2), Math.tanh(a.score));
      else if (a.key.startsWith("l:")) langAffinity.set(a.key.slice(2), Math.tanh(a.score));
    }
  }
  return { genreAffinity, langAffinity, stats: s?.categories ?? {} };
}

export function categoryLink(c: CategoryDef): string | null {
  const s = c.source;
  if (s.kind === "trending") return "/browse/trending";
  const p = new URLSearchParams();
  if (s.genre !== undefined) p.set("genre", String(s.genre));
  if (s.lang) p.set("lang", s.lang);
  if (s.sort) p.set("sort", s.sort);
  const q = p.toString();
  return `/browse/${s.type}${q ? `?${q}` : ""}`;
}

async function fetchBatch(key: string): Promise<BatchResult[]> {
  const ids = (new URL(key, "https://x").searchParams.get("c") ?? "").split(",").filter(Boolean);
  const res = await Promise.allSettled(ids.map((id) => {
    const c = CATEGORY_BY_ID.get(id);
    return c ? apiGet<ListPayload>(categoryPath(c), { retries: 1 }) : Promise.reject(new Error("unknown category"));
  }));
  // a category whose request failed contributes no rail (and is not retried within this batch)
  return ids.map((id, i) => { const r = res[i]!; return { id, items: r.status === "fulfilled" ? r.value.results ?? [] : [] }; });
}

/**
 * Turn loaded batches into rails: drop titles an earlier row (or rail) already showed, titles hidden or disliked
 * by the profile, finished titles and, on kids profiles, anything not kid-safe. A category with fewer than
 * MIN_ITEMS left is skipped, never shown half-empty.
 */
export function buildFeedRows(batches: readonly BatchResult[][], taken: Iterable<string>, ok: (i: PandaItem) => boolean): FeedRow[] {
  const seen = new Set<string>(taken);
  const out: FeedRow[] = [];
  for (const batch of batches) {
    for (const b of batch) {
      const c = CATEGORY_BY_ID.get(b.id);
      if (!c) continue;
      const items: PandaItem[] = [];
      for (const it of b.items) {
        if (items.length >= MAX_ITEMS) break;
        if (!it?.id || seen.has(it.id) || !ok(it)) continue;
        items.push(it);
      }
      if (items.length < MIN_ITEMS) continue;
      for (const it of items) seen.add(it.id);
      out.push({ id: `feed-${c.id}`, kind: "poster", title: c.title, items, link: categoryLink(c), cat: c.id });
    }
  }
  return out;
}

export function useCategoryFeed(kind: PageKind, taken: readonly { items?: readonly PandaItem[]; entries?: readonly { item: PandaItem }[] }[], ready: boolean) {
  const fk = feedKind(kind);
  const profile = useProfile();
  const prefs = usePrefs();
  const taste = useTaste();
  const history = useHistoryMap();
  const ratings = useRatings();
  const hidden = useHiddenRecoIds();
  useIntelVersion();
  const kids = Boolean(profile?.kids);
  const pid = profile?.id ?? "none";
  const orderKey = `${pid}|${fk}|${kids ? "k" : "a"}|${dayKey(Date.now())}`;
  // wait for this profile's model to load from IndexedDB (a few ms) so the frozen order includes what it learned
  const modelReady = intelStatus() !== "loading";

  const order = useMemo<string[]>(() => {
    if (!fk || !ready || !modelReady) return [];
    const have = orders.get(orderKey);
    if (have) return have;
    const m = contextFromModel(intelState());
    const langs = new Map<string, number>();
    for (const h of Object.values(history)) if (h.item.language) langs.set(h.item.language, (langs.get(h.item.language) ?? 0) + 1);
    const topLang = [...langs].sort((a, b) => b[1] - a[1])[0]?.[0];
    const ctx: RankContext = {
      tasteGenres: canonicalGenres(taste?.genres ?? []),
      genreAffinity: m.genreAffinity,
      langAffinity: m.langAffinity,
      preferredLangs: [prefs.top10Lang, topLang].filter((x): x is string => Boolean(x)),
      stats: m.stats,
      seed: `${pid}|${dayKey(Date.now())}`,
      contentType: taste?.contentType
    };
    const ids = rankCategories(eligible(fk, kids), ctx).map((c) => c.id);
    orders.set(orderKey, ids);
    return ids;
    // frozen per orderKey: history / taste changes apply on the next visit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderKey, ready, modelReady]);

  const getKey = useCallback((i: number) => {
    const ids = order.slice(i * BATCH, i * BATCH + BATCH);
    return ids.length ? `/panda/feed/${fk}?c=${ids.join(",")}` : null;
  }, [order, fk]);
  const swr = useSWRInfinite<BatchResult[]>(getKey, fetchBatch, { initialSize: sizes.get(orderKey) ?? 1, revalidateFirstPage: false, revalidateOnFocus: false, revalidateAll: false });
  const batches = useMemo(() => (swr.data ?? []).filter(Boolean), [swr.data]);
  const total = Math.ceil(order.length / BATCH);
  const done = order.length > 0 && batches.length >= total;
  const loading = order.length > 0 && !done && (swr.isLoading || batches.length < swr.size);

  const takenIds = useMemo(() => {
    const s: string[] = [];
    for (const r of taken) { for (const i of r.items ?? []) s.push(i.id); for (const e of r.entries ?? []) s.push(e.item.id); }
    return s;
  }, [taken]);
  const rows = useMemo(() => {
    const ok = (i: PandaItem) => !hidden.has(i.id) && ratings[i.id] !== "dislike" && !(i.type === "movie" && history[i.id]?.completed) && (!kids || isKidsSafe(i));
    return buildFeedRows(batches, takenIds, ok);
  }, [batches, takenIds, hidden, ratings, history, kids]);

  const size = swr.size, setSize = swr.setSize;
  const loadMore = useCallback(() => {
    if (!order.length || loading || size >= total) return;
    sizes.set(orderKey, size + 1);
    void setSize(size + 1);
  }, [order.length, loading, size, total, orderKey, setSize]);

  // a batch that produced no rail (every category short or failed) pulls the next one, so the feed never stalls
  const lastBatch = batches[batches.length - 1];
  useEffect(() => {
    if (!lastBatch || loading) return;
    const gave = rows.filter((r) => lastBatch.some((b) => `feed-${b.id}` === r.id)).length;
    if (gave === 0) loadMore();
  }, [lastBatch, rows, loading, loadMore]);

  // prefetch the next batch in the background once the current one is in
  useEffect(() => {
    if (loading || done || !batches.length) return;
    const key = getKey(batches.length);
    if (!key) return;
    const t = setTimeout(() => { void preload(key, fetchBatch); }, 600);
    return () => clearTimeout(t);
  }, [batches.length, loading, done, getKey]);

  return { rows, loadMore, done, loading, enabled: Boolean(fk) };
}

/** Category impressions: a rail counts as seen once per visit when half of it is on screen. */
export function useFeedImpressions(root: RefObject<HTMLElement | null>, deps: unknown) {
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const cat = (e.target as HTMLElement).dataset.feedCat;
        if (cat && !seenCats.has(cat)) { seenCats.add(cat); noteCategory(cat, "shown"); }
        io.unobserve(e.target);
      }
    }, { threshold: 0.5 });
    el.querySelectorAll("[data-feed-cat]").forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [root, deps]);
}

/** Click/OK on a title inside a feed rail: the category learns it was useful. */
export function feedOpenFrom(target: EventTarget | null) {
  const cat = (target as HTMLElement | null)?.closest?.<HTMLElement>("[data-feed-cat]")?.dataset.feedCat;
  if (cat) noteCategory(cat, "opened");
}

/** Near the end of the feed (mobile scroll, mouse wheel on TV): load the next batch. */
export function useFeedSentinel(ref: RefObject<HTMLElement | null>, onNear: () => void, deps: unknown) {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) onNear(); }, { rootMargin: "1200px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, onNear, deps]);
}

export function resetFeedForTest() { orders.clear(); sizes.clear(); seenCats.clear(); }
