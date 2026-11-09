import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearch } from "wouter";
import { PageHeader } from "../components/PageHeader";
import { EmptyState, ErrorState, Skeleton, toast } from "../components/ui";
import { Icon } from "../components/Icon";
import { Sheet, SheetItem } from "../components/Sheet";
import { NewListSheet, QuickActions, type ActionContext } from "../components/QuickActions";
import { LIST_SORTS, sortList, type ListFilter, type ListSort } from "../lib/lists";
import { useIsTv } from "../lib/layout";
import { useBrowse, type BrowseParams } from "../lib/useBrowse";
import { browseHref, browseTitle } from "../lib/format";
import { actions, continueWatching, useHistoryMap, useList, useProfile, useWatchlist } from "../lib/store";
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
      {b.loading && <div className={tv ? "tv-grid" : "m-grid"}>{Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className={tv ? "sk-poster" : "sk-poster-m"} />)}</div>}
      <div ref={sentinel} className="sentinel" aria-hidden="true" />
      {tv && !b.done && items.length > 0 && <button id="browse-more" className="btn btn--secondary tv-more" onClick={b.loadMore} onFocus={b.loadMore} data-hover-focus>Load more</button>}
    </div>
  );
}

/** Watchlist, or a custom list with `?list=<id>` (Watchlist 2.0): filter, sort, edit, rename and delete. */
export function MyListPage() {
  const tv = useIsTv();
  const qs = new URLSearchParams(useSearch());
  const listId = qs.get("list");
  const custom = useList(listId);
  const watchlist = useWatchlist();
  const items = custom ? custom.items : watchlist;
  const { go } = useNav();
  const ref = useAutoFocus(true);
  const [filter, setFilter] = useState<ListFilter>("all");
  const [sort, setSort] = useState<ListSort>("recent");
  const [editing, setEditing] = useState(false);
  const [sheet, setSheet] = useState<PandaItem | null>(null);
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null);
  const shown = useMemo(() => sortList(items, filter, sort), [items, filter, sort]);
  const missing = !!listId && !custom;
  const context: ActionContext = custom ? { kind: "list", listId: custom.id } : { kind: "watchlist" };
  const chip = tv ? "tv-chip" : "m-chip";
  const sortLabel = LIST_SORTS.find((x) => x.id === sort)!.label;
  useEffect(() => { if (!items.length) setEditing(false); }, [items.length]);

  if (missing) {
    return (
      <div ref={ref} className={tv ? "tv-page tv-browse" : "m-page"}>
        <PageHeader title="List not found" fallback="/my-space" />
        <EmptyState icon="list" title="This list no longer exists" sub="It may have been deleted, or it belongs to another profile." action={<button className="btn btn--primary" data-autofocus onClick={() => go("/my-space", { replace: true })}>Go to My Space</button>} />
      </div>
    );
  }

  return (
    <div ref={ref} className={tv ? "tv-page tv-browse" : "m-page"} data-scroll-y={tv ? "item" : undefined}>
      <PageHeader title={custom ? custom.name : "Watchlist"} fallback="/my-space" />
      <section className={`${tv ? "tv-chips" : "m-chips"} list-tools`} aria-label="List options">
        {items.length > 0 && (["all", "movie", "tv"] as const).map((f) => (
          <button key={f} id={`lf-${f}`} className={`${chip} ${filter === f ? "is-selected" : ""}`} aria-pressed={filter === f} onClick={() => setFilter(f)} data-hover-focus>
            {f === "all" ? `All ${items.length}` : f === "movie" ? "Movies" : "Shows"}
          </button>
        ))}
        {items.length > 1 && (
          <button id="l-sort" className={chip} onClick={() => setSort(LIST_SORTS[(LIST_SORTS.findIndex((x) => x.id === sort) + 1) % LIST_SORTS.length]!.id)} data-hover-focus aria-label={`Sort: ${sortLabel}. Press to change.`}>
            <Icon name="sort" /> {sortLabel}
          </button>
        )}
        {tv && items.length > 0 && (
          <button id="l-edit" className={`${chip} ${editing ? "is-selected" : ""}`} aria-pressed={editing} onClick={() => setEditing((e) => !e)} data-hover-focus>
            {editing ? <><Icon name="check" /> Done</> : <><Icon name="more" /> Edit</>}
          </button>
        )}
        {custom && <button id="l-rename" className={chip} onClick={() => setDialog("rename")} data-hover-focus><Icon name="edit" /> Rename</button>}
        {custom && <button id="l-delete" className={chip} onClick={() => setDialog("delete")} data-hover-focus><Icon name="trash" /> Delete list</button>}
      </section>
      {items.length > 0 && (!tv || editing) && <p className="list-hint">{tv ? "Press OK on a title for lists, move to top and more" : "Press and hold a title for quick actions"}</p>}
      {items.length === 0
        ? custom
          ? <EmptyState icon="list" title={`${custom.name} is empty`} sub={tv ? "Open any title and press + to save it to this list." : "Open any title and tap + to save it to this list."} action={<button className="btn btn--primary" data-autofocus onClick={() => go("/movies")}>Browse Movies</button>} />
          : <EmptyState icon="plus" title="Your watchlist is empty" sub="Add movies and shows to watch them later." action={<button className="btn btn--primary" data-autofocus onClick={() => go("/movies")}>Browse Movies</button>} />
        : shown.length === 0
          ? <EmptyState icon="list" title={filter === "movie" ? "No movies here" : "No shows here"} sub="Switch the filter to see everything." />
          : (
            <div className={tv ? "tv-grid" : "m-grid"}>
              {shown.map((it, i) => tv
                ? <TvPoster key={it.id} item={it} id={`list-${i}`} expand={false} onOptions={editing ? () => setSheet(it) : undefined} />
                : <MPoster key={it.id} item={it} context={context} />)}
            </div>
          )}
      {sheet && <QuickActions item={sheet} context={context} onClose={() => setSheet(null)} />}
      {custom && dialog === "rename" && <NewListSheet rename={{ id: custom.id, name: custom.name }} onClose={() => setDialog(null)} />}
      {custom && dialog === "delete" && (
        <Sheet title={`Delete ${custom.name}?`} onClose={() => setDialog(null)} className="qa-sheet">
          <p className="sheet-note">The list is removed from this profile. The titles stay in your Watchlist and history.</p>
          <SheetItem icon={<Icon name="trash" />} label="Delete list" danger onClick={() => { actions.deleteList(custom.id); toast(`Deleted ${custom.name}`); setDialog(null); go("/my-space", { replace: true }); }} />
          <SheetItem icon={<Icon name="close" />} label="Keep list" onClick={() => setDialog(null)} />
        </Sheet>
      )}
    </div>
  );
}

export function ContinueWatchingPage() {
  const tv = useIsTv();
  const history = useHistoryMap();
  const all = continueWatching(history);
  const [filter, setFilter] = useState<ListFilter>("all");
  const entries = filter === "all" ? all : all.filter((h) => h.item.type === filter);
  const mixed = all.some((h) => h.item.type === "movie") && all.some((h) => h.item.type === "tv");
  const { go } = useNav();
  const ref = useAutoFocus(true);
  return (
    <div ref={ref} className={tv ? "tv-page tv-browse" : "m-page"} data-scroll-y={tv ? "item" : undefined}>
      <PageHeader title="Continue Watching" fallback="/my-space" />
      {mixed && (
        <section className={tv ? "tv-chips" : "m-chips"} aria-label="Filters">
          {(["all", "movie", "tv"] as const).map((f) => (
            <button key={f} id={`cwf-${f}`} className={`${tv ? "tv-chip" : "m-chip"} ${filter === f ? "is-selected" : ""}`} aria-pressed={filter === f} onClick={() => setFilter(f)} data-hover-focus>
              {f === "all" ? `All ${all.length}` : f === "movie" ? "Movies" : "Shows"}
            </button>
          ))}
        </section>
      )}
      {all.length === 0
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
