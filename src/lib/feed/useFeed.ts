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
import { personalOrder as blendOrder } from "../intel/personalize";
import { categoryById, categoryPaths, eligible, hasRounds, railVariant, registerCategories, type CategoryDef, type RailVariant } from "./catalog";
import { interleave, personalCategories } from "./personal";
import { daypart, sessionMoods } from "../intel/moods";
import { dayKey, rankCategories, type RankContext } from "./rank";
import type { Collection, ListPayload, PageKind, PandaItem, PersonDetails } from "../types";

/**
 * v1.5.0 infinite Home feed: after the page's own rows, Home keeps going with categories ranked for the profile
 * (src/lib/feed/rank.ts), with the profile's personal rails (src/lib/feed/personal.ts) interleaved. Categories load
 * in batches (cursor = position in the ranked list), each batch is one SWR entry (persisted, so a warm start and Back
 * from Details paint the same rows at once; keyed by day so rails stay fresh), a rail needs at least MIN_ITEMS titles
 * that no earlier row already showed, and the next batch is prefetched while the current one is on screen.
 *
 * After the first pass, the best-ranked rails come back once more with their next pages ("More Hidden Gems"); then
 * the feed ends with an end-of-feed card instead of a spinner. A batch whose every request failed is an error (not
 * cached, shown with Retry); a single failed category in a batch just contributes no rail.
 *
 * Within a rail, titles are ordered by the on-device model blended with the catalogue's order (the model's share
 * grows with what it has learned, up to RERANK_MAX); franchises keep release order. Orders are frozen for the visit
 * (per profile, page, day and time of day) so rows and cards never move under the D-pad focus.
 */
export const BATCH = 4;
export const MIN_ITEMS = 6;
export const MAX_ITEMS = 20;
/** first-pass rails that come back with their next pages */
export const SECOND_PASS = 24;
/** the model's largest share of a rail's order (the rest is the catalogue's own order) */
export const RERANK_MAX = 0.6;

export interface FeedRow { id: string; kind: "poster" | "landscape"; variant: RailVariant; title: string; note?: string; items: PandaItem[]; link: string | null; cat: string }
export interface BatchResult { id: string; items: PandaItem[]; failed?: true }

const orders = new Map<string, string[]>();
const sizes = new Map<string, number>();
const arranged = new Map<string, string[]>();
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
  if (s.kind === "person") return `/person/${s.person}`;
  if (s.kind === "collection") return `/collection/${s.collection}`;
  const p = new URLSearchParams();
  if (s.genre !== undefined) p.set("genre", String(s.genre));
  if (s.lang) p.set("lang", s.lang);
  if (s.sort) p.set("sort", s.sort);
  const q = p.toString();
  return `/browse/${s.type}${q ? `?${q}` : ""}`;
}

/** Crew jobs in a person's credits; anything else in `role` is a character, i.e. an acting credit. */
const CREW = /^(director|co-director|producer|executive producer|co-producer|associate producer|line producer|screenplay|writer|story|novel|characters|thanks|editor|director of photography|original music composer|music|creator|teleplay|author|book|comic book|idea|original story|dialogue|additional dialogue|casting|self|himself|herself)$/i;

async function fetchCategory(c: CategoryDef): Promise<PandaItem[]> {
  const s = c.source;
  if (s.kind === "person") {
    const p = await apiGet<PersonDetails>(categoryPaths(c)[0]!, { retries: 1 });
    const mine = (p.knownFor ?? []).filter((k) => (s.role === "director" ? k.role === "Director" : Boolean(k.role) && !CREW.test(k.role!.trim())));
    return mine.map(({ role: _role, ...item }) => item as PandaItem);
  }
  if (s.kind === "collection") {
    const col = await apiGet<Collection>(categoryPaths(c)[0]!, { retries: 1 });
    // release order: by release date, undated (unreleased) parts last, ties in the catalogue's order
    const t = (i: PandaItem) => (i.releaseDate ? Date.parse(i.releaseDate) || Infinity : Infinity);
    return (col.parts ?? []).map((it, k) => ({ it, k })).sort((a, b) => t(a.it) - t(b.it) || a.k - b.k).map((x) => x.it);
  }
  const pages = await Promise.all(categoryPaths(c).map((path) => apiGet<ListPayload>(path, { retries: 1 })));
  return pages.flatMap((p) => p.results ?? []);
}

/** One batch of categories. Throws only when every category failed, so a dead connection is an error, not "empty". */
export async function fetchBatch(key: string): Promise<BatchResult[]> {
  const ids = (new URL(key, "https://x").searchParams.get("c") ?? "").split(",").filter(Boolean);
  const res = await Promise.allSettled(ids.map((id) => {
    const c = categoryById(id);
    return c ? fetchCategory(c) : Promise.reject(new Error("unknown category"));
  }));
  if (ids.length && res.every((r) => r.status === "rejected")) throw (res[0] as PromiseRejectedResult).reason;
  return ids.map((id, i) => { const r = res[i]!; return r.status === "fulfilled" ? { id, items: r.value } : { id, items: [], failed: true }; });
}

/** Order a rail's titles: the model's prediction blended with the catalogue's order (pure; exported for tests). */
export function personalOrder(items: readonly PandaItem[], s: LearnerState | null, strength = RERANK_MAX, now = Date.now()): PandaItem[] {
  return blendOrder(items, s, strength, now);
}

type Arrange = (c: CategoryDef, items: readonly PandaItem[]) => readonly PandaItem[];

/**
 * Turn loaded batches into rails: drop titles an earlier row (or rail) already showed, titles hidden or disliked
 * by the profile, finished titles and, on kids profiles, anything not kid-safe. A category with fewer than its
 * minimum left is skipped, never shown half-empty. Franchise rails keep every part (they are a list in order), but
 * still drop hidden and kids-unsafe parts via `okAll`.
 */
export function buildFeedRows(batches: readonly BatchResult[][], taken: Iterable<string>, ok: (i: PandaItem) => boolean, arrange: Arrange = (_c, i) => i, okAll: (i: PandaItem) => boolean = ok): FeedRow[] {
  const seen = new Set<string>(taken);
  const out: FeedRow[] = [];
  for (const batch of batches) {
    for (const b of batch) {
      const c = categoryById(b.id);
      if (!c || b.failed) continue;
      const items: PandaItem[] = [];
      const min = c.source.kind === "discover" ? c.source.minRating : undefined;
      const franchise = Boolean(c.keepOrder);
      const unique = new Set<string>();
      for (const it of arrange(c, b.items)) {
        if (items.length >= MAX_ITEMS) break;
        if (!it?.id || unique.has(it.id)) continue;
        if (franchise ? !okAll(it) : seen.has(it.id) || !ok(it)) continue;
        if (min !== undefined && (it.rating ?? 0) < min) continue;
        unique.add(it.id);
        items.push(it);
      }
      // a franchise is worth a rail while something in it is still to watch
      if (items.length < (c.minItems ?? MIN_ITEMS) || (franchise && !items.some(ok))) continue;
      for (const it of items) seen.add(it.id);
      const variant = railVariant(c);
      out.push({ id: `feed-${c.id}`, kind: variant === "landscape" || variant === "spotlight" ? "landscape" : "poster", variant, title: c.title, note: c.note, items, link: categoryLink(c), cat: c.id });
    }
  }
  return out;
}

/** The full feed order: ranked categories with personal rails interleaved, then the second pass (pure). */
export function feedOrder(ranked: readonly CategoryDef[], personal: readonly CategoryDef[]): string[] {
  const first = interleave(ranked.map((c) => c.id), personal.map((c) => c.id));
  const again = ranked.filter(hasRounds).slice(0, SECOND_PASS).map((c) => `${c.id}@2`);
  return [...first, ...again];
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
  const part = daypart();
  const day = dayKey(Date.now());
  const orderKey = `${pid}|${fk}|${kids ? "k" : "a"}|${day}|${part}`;
  // wait for this profile's model to load from IndexedDB (a few ms) so the frozen order includes what it learned
  const modelReady = intelStatus() !== "loading";

  const order = useMemo<string[]>(() => {
    if (!fk || !ready || !modelReady) return [];
    const have = orders.get(orderKey);
    if (have) return have;
    const state = intelState();
    const m = contextFromModel(state);
    const langs = new Map<string, number>();
    for (const h of Object.values(history)) if (h.item.language) langs.set(h.item.language, (langs.get(h.item.language) ?? 0) + 1);
    const topLang = [...langs].sort((a, b) => b[1] - a[1])[0]?.[0];
    const ctx: RankContext = {
      tasteGenres: canonicalGenres(taste?.genres ?? []),
      genreAffinity: m.genreAffinity,
      langAffinity: m.langAffinity,
      preferredLangs: [prefs.top10Lang, topLang].filter((x): x is string => Boolean(x)),
      stats: m.stats,
      seed: `${pid}|${day}`,
      contentType: taste?.contentType,
      sessionMoods: sessionMoods(new Date(), kids)
    };
    const personal = personalCategories(state, { kids, kind: fk });
    registerCategories(personal);
    const ids = feedOrder(rankCategories(eligible(fk, kids), ctx), personal);
    orders.set(orderKey, ids);
    return ids;
    // frozen per orderKey: history / taste changes apply on the next visit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderKey, ready, modelReady]);

  const getKey = useCallback((i: number) => {
    const ids = order.slice(i * BATCH, i * BATCH + BATCH);
    return ids.length ? `/panda/feed/${fk}?d=${day}&c=${ids.join(",")}` : null;
  }, [order, fk, day]);
  const swr = useSWRInfinite<BatchResult[]>(getKey, fetchBatch, { initialSize: sizes.get(orderKey) ?? 1, revalidateFirstPage: false, revalidateOnFocus: false, revalidateAll: false, shouldRetryOnError: false });
  const batches = useMemo(() => (swr.data ?? []).filter(Boolean), [swr.data]);
  const total = Math.ceil(order.length / BATCH);
  const done = order.length > 0 && batches.length >= total;
  const error = order.length > 0 && !done && Boolean(swr.error) && !swr.isValidating;
  // never an endless spinner: an errored batch shows Retry instead
  const loading = order.length > 0 && !done && !error && (swr.isLoading || batches.length < swr.size);

  const takenIds = useMemo(() => {
    const s: string[] = [];
    for (const r of taken) { for (const i of r.items ?? []) s.push(i.id); for (const e of r.entries ?? []) s.push(e.item.id); }
    return s;
  }, [taken]);
  const arrange = useCallback<Arrange>((c, items) => {
    if (c.keepOrder) return items;
    const k = `${orderKey}|${c.id}`;
    let ids = arranged.get(k);
    if (!ids) {
      ids = personalOrder(items, intelState(), c.id === "p-trending" ? 1 : RERANK_MAX).map((i) => i.id);
      arranged.set(k, ids);
      if (arranged.size > 600) arranged.delete(arranged.keys().next().value!);
    }
    const at = new Map(ids.map((id, i) => [id, i]));
    return [...items].sort((a, b) => (at.get(a.id) ?? 1e9) - (at.get(b.id) ?? 1e9));
  }, [orderKey]);
  const rows = useMemo(() => {
    const okAll = (i: PandaItem) => !hidden.has(i.id) && ratings[i.id] !== "dislike" && (!kids || isKidsSafe(i));
    const ok = (i: PandaItem) => okAll(i) && !(i.type === "movie" && history[i.id]?.completed);
    return buildFeedRows(batches, takenIds, ok, arrange, okAll);
  }, [batches, takenIds, hidden, ratings, history, kids, arrange]);

  const size = swr.size, setSize = swr.setSize, mutate = swr.mutate;
  const loadMore = useCallback(() => {
    if (!order.length || loading || error || size >= total) return;
    sizes.set(orderKey, size + 1);
    void setSize(size + 1);
  }, [order.length, loading, error, size, total, orderKey, setSize]);
  const retry = useCallback(() => { void mutate(); }, [mutate]);

  // a batch that produced no rail (every category short or failed) pulls the next one, so the feed never stalls
  const lastBatch = batches[batches.length - 1];
  useEffect(() => {
    if (!lastBatch || loading) return;
    const gave = rows.filter((r) => lastBatch.some((b) => `feed-${b.id}` === r.id)).length;
    if (gave === 0) loadMore();
  }, [lastBatch, rows, loading, loadMore]);

  // prefetch the next batch in the background once the current one is in
  useEffect(() => {
    if (loading || done || error || !batches.length) return;
    const key = getKey(batches.length);
    if (!key) return;
    const t = setTimeout(() => { void preload(key, fetchBatch).catch(() => undefined); }, 600);
    return () => clearTimeout(t);
  }, [batches.length, loading, done, error, getKey]);

  return { rows, loadMore, done, loading, error, retry, enabled: Boolean(fk) };
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

export function resetFeedForTest() { orders.clear(); sizes.clear(); seenCats.clear(); arranged.clear(); }
