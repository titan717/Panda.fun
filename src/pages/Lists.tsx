import { useEffect, useRef } from "react";
import { useParams, useSearch } from "wouter";
import { PageHeader } from "../components/PageHeader";
import { EmptyState, ErrorState, Skeleton } from "../components/ui";
import { useIsTv } from "../lib/layout";
import { useBrowse, type BrowseParams } from "../lib/useBrowse";
import { browseHref, browseTitle } from "../lib/format";
import { continueWatching, useHistoryMap, useProfile, useWatchlist } from "../lib/store";
import { isKidsSafe } from "../lib/rows";
import { focusFirst } from "../lib/focus";
import { useNav } from "../lib/nav";
import { TvContinue, TvPoster } from "../tv/TvCards";
import { MContinue, MPoster } from "../mobile/MCards";
import type { PandaItem } from "../lib/types";

function PosterGrid({ items, prefix }: { items: PandaItem[]; prefix: string }) {
  const tv = useIsTv();
  return (
    <div className={tv ? "tv-grid" : "m-grid"}>
      {items.map((it, i) => tv ? <TvPoster key={it.id} item={it} id={`${prefix}-${i}`} expand={false} /> : <MPoster key={it.id} item={it} />)}
    </div>
  );
}

function useAutoFocus(ready: boolean) {
  const tv = useIsTv();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (tv && ready && ref.current && !ref.current.contains(document.activeElement)) focusFirst(ref.current); }, [tv, ready]);
  return ref;
}

const SORTS = [{ id: "", label: "Popular" }, { id: "new", label: "Newest" }, { id: "vote_average.desc", label: "Top Rated" }];

/** Browse grid with type + sort filters and infinite loading (spec 9.3). */
export function BrowsePage() {
  const { kind = "movie" } = useParams<{ kind: string }>();
  const qs = new URLSearchParams(useSearch());
  const tv = useIsTv();
  const { go } = useNav();
  const profile = useProfile();
  const k = (kind === "tv" || kind === "trending" ? kind : "movie") as BrowseParams["kind"];
  const params: BrowseParams = { kind: k, genre: qs.get("genre") ?? undefined, lang: qs.get("lang") ?? undefined, country: qs.get("country") ?? undefined, sort: qs.get("sort") ?? undefined };
  const b = useBrowse(params);
  const items = profile?.kids ? b.items.filter(isKidsSafe) : b.items;
  const ref = useAutoFocus(items.length > 0);
  const sentinel = useRef<HTMLDivElement>(null);
  const title = browseTitle(k, qs);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => { if (e[0]?.isIntersecting) b.loadMore(); }, { rootMargin: "800px" });
    io.observe(el);
    return () => io.disconnect();
  }, [b]);

  const set = (patch: Record<string, string | undefined>, nextKind = k) => {
    const p: Record<string, string | undefined> = { title: nextKind === k ? qs.get("title") ?? undefined : undefined, genre: params.genre, lang: params.lang, country: params.country, sort: params.sort, ...patch };
    go(browseHref(nextKind, p), { replace: true });
  };
  // genre ids differ between movies and shows, so the type switch is only offered for language/country/sort browsing
  const canSwitchType = k !== "trending" && !params.genre;

  return (
    <div ref={ref} className={tv ? "tv-page tv-browse" : "m-page"} data-scroll-y={tv ? "item" : undefined} data-scroll-offset="0.3">
      <PageHeader title={title} />
      {k !== "trending" && (
        <section className={tv ? "tv-chips" : "m-chips"} aria-label="Filters">
          {canSwitchType && (["movie", "tv"] as const).map((t) => (
            <button key={t} id={`type-${t}`} className={`${tv ? "tv-chip" : "m-chip"} ${k === t ? "is-selected" : ""}`} aria-pressed={k === t} onClick={() => set({}, t)} data-hover-focus>{t === "movie" ? "Movies" : "Shows"}</button>
          ))}
          {SORTS.map((s) => (
            <button key={s.id || "pop"} id={`sort-${s.id || "pop"}`} className={`${tv ? "tv-chip" : "m-chip"} ${(params.sort ?? "") === s.id ? "is-selected" : ""}`} aria-pressed={(params.sort ?? "") === s.id} onClick={() => set({ sort: s.id || undefined })} data-hover-focus>{s.label}</button>
          ))}
        </section>
      )}
      {b.error && !items.length && <ErrorState message={b.error.message} onRetry={b.retry} />}
      {!b.error && !b.loading && items.length === 0 && <EmptyState title="Nothing here yet" sub="Try a different filter." />}
      <PosterGrid items={items} prefix="browse" />
      {b.loading && <div className={tv ? "tv-grid" : "m-grid"}>{Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="sk-poster" />)}</div>}
      <div ref={sentinel} className="sentinel" aria-hidden="true" />
      {tv && !b.done && items.length > 0 && <button id="browse-more" className="btn btn--secondary tv-more" onClick={b.loadMore} onFocus={b.loadMore} data-hover-focus>Load more</button>}
    </div>
  );
}

export function MyListPage() {
  const tv = useIsTv();
  const list = useWatchlist();
  const { go } = useNav();
  const ref = useAutoFocus(true);
  return (
    <div ref={ref} className={tv ? "tv-page tv-browse" : "m-page"} data-scroll-y={tv ? "item" : undefined}>
      <PageHeader title="Watchlist" fallback="/my-space" />
      {list.length === 0
        ? <EmptyState icon="plus" title="Your watchlist is empty" sub="Add movies and shows to watch them later." action={<button className="btn btn--primary" data-autofocus onClick={() => go("/movies")}>Browse Movies</button>} />
        : <PosterGrid items={list} prefix="list" />}
    </div>
  );
}

export function ContinueWatchingPage() {
  const tv = useIsTv();
  const history = useHistoryMap();
  const entries = continueWatching(history);
  const { go } = useNav();
  const ref = useAutoFocus(true);
  return (
    <div ref={ref} className={tv ? "tv-page tv-browse" : "m-page"} data-scroll-y={tv ? "item" : undefined}>
      <PageHeader title="Continue Watching" fallback="/my-space" />
      {entries.length === 0
        ? <EmptyState icon="play" title="Start watching to see it here" sub="Anything you don't finish shows up here so you can pick up where you left off." action={<button className="btn btn--primary" data-autofocus onClick={() => go("/")}>Go to Home</button>} />
        : <div className={tv ? "tv-land-grid" : "m-land-grid"}>{entries.map((h, i) => tv ? <TvContinue key={h.item.id} entry={h} id={`cw-${i}`} /> : <MContinue key={h.item.id} entry={h} />)}</div>}
    </div>
  );
}

export function NotFoundPage() {
  const { go } = useNav();
  const ref = useAutoFocus(true);
  return (
    <div ref={ref} className="page-center">
      <EmptyState icon="info" title="Page not found" sub="The link may be broken or the page may have moved." action={<button className="btn btn--primary" data-autofocus onClick={() => go("/", { replace: true })}>Go to Home</button>} />
    </div>
  );
}
