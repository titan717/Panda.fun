import "./collection.css";
import { useEffect, useMemo, useRef } from "react";
import { useParams } from "wouter";
import { PageHeader } from "../components/PageHeader";
import { Icon } from "../components/Icon";
import { ErrorState, Img, Skeleton, toast } from "../components/ui";
import { useIsTv } from "../lib/layout";
import { useCollection } from "../lib/hooks";
import { actions, useHistoryMap, useProfile, useWatchlist } from "../lib/store";
import { isKidsSafe } from "../lib/rows";
import { focusFirst } from "../lib/focus";
import { useNav } from "../lib/nav";
import { watchPath } from "../lib/format";
import { TvPoster } from "../tv/TvCards";
import { MPoster } from "../mobile/MCards";
import { NotFoundPage } from "./Lists";
import type { Collection, PandaItem } from "../lib/types";

/** "3 movies • 2005–2012" from the parts that have a year. */
export function collectionFacts(c: Pick<Collection, "parts">) {
  const years = c.parts.map((p) => p.year).filter((y): y is number => typeof y === "number" && y > 0);
  const out = [`${c.parts.length} movies`];
  if (years.length) { const a = Math.min(...years), b = Math.max(...years); out.push(a === b ? String(a) : `${a}–${b}`); }
  return out.join(" • ");
}

/** First part the profile has not finished, in release order; the first part when none are started. */
export function nextPart(parts: PandaItem[], history: Record<string, { completed: boolean } | undefined>) {
  return parts.find((p) => !history[p.id]?.completed) ?? parts[0] ?? null;
}

/** Collection page (v1.1.8): artwork, overview and every part in release order, from Details › Collection. */
export function CollectionPage() {
  const { id } = useParams<{ id: string }>();
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return <NotFoundPage />;
  return <CollectionView key={n} id={n} />;
}

function CollectionView({ id }: { id: number }) {
  const tv = useIsTv();
  const { go } = useNav();
  const profile = useProfile();
  const history = useHistoryMap();
  const watchlist = useWatchlist();
  const { data: c, error, mutate } = useCollection(id);
  const root = useRef<HTMLDivElement>(null);
  const parts = useMemo(() => (c?.parts ?? []).filter((p) => !profile?.kids || isKidsSafe(p)), [c, profile?.kids]);
  const next = nextPart(parts, history);
  const started = next ? Boolean(history[next.id]) && !history[next.id]?.completed : false;
  const missing = parts.filter((p) => !watchlist.some((w) => w.id === p.id));
  const done = parts.filter((p) => history[p.id]?.completed).length;

  useEffect(() => { if (tv && c && root.current && !root.current.contains(document.activeElement)) focusFirst(root.current); }, [tv, c]);

  if (error && !c) {
    const gone = /404|not found/i.test(error.message);
    return gone ? <NotFoundPage /> : <div className={tv ? "tv-page" : "m-page"}><PageHeader title="Collection" /><ErrorState message={error.message} onRetry={() => mutate()} /></div>;
  }
  if (!c) {
    return (
      <div className={tv ? "tv-page tv-collection" : "m-page m-collection"} aria-busy="true">
        {!tv && <PageHeader title="" />}
        <Skeleton className="coll-hero-sk" />
      </div>
    );
  }

  const addAll = () => {
    if (!missing.length) { toast("Already in your Watchlist"); return; }
    for (const p of [...missing].reverse()) actions.toggleWatchlist(p);
    toast(`Added ${missing.length} ${missing.length === 1 ? "movie" : "movies"} to your Watchlist`);
  };

  return (
    <div ref={root} className={tv ? "tv-page tv-collection" : "m-page m-collection"} data-scroll-y={tv ? "item" : undefined} data-scroll-offset="0.3">
      {!tv && <PageHeader title="" />}
      <section className="coll-hero">
        {c.backdrop && <Img src={c.backdrop} alt="" className="coll-backdrop" eager />}
        <div className="coll-scrim" aria-hidden="true" />
        <div className="coll-text">
          <p className="coll-kicker">Collection</p>
          <h1 className="coll-name">{c.name}</h1>
          <p className="coll-facts">{collectionFacts({ parts })}{done > 0 && <span className="coll-done"> • Watched {done} of {parts.length}</span>}</p>
          {c.overview && <p className="coll-overview">{c.overview}</p>}
          <div className="coll-actions">
            {next && (
              <button id="coll-play" className={tv ? "tv-btn tv-btn--primary coll-btn" : "btn btn--primary coll-btn"} data-autofocus data-hover-focus onClick={() => go(watchPath("movie", next.tmdbId))}>
                <Icon name="play" /> {started ? "Resume" : done > 0 ? "Play next" : "Play"} {next.title}
              </button>
            )}
            <button id="coll-add" className={tv ? "tv-btn coll-btn" : "btn coll-btn"} data-hover-focus onClick={addAll} aria-label={missing.length ? `Add all ${missing.length} to Watchlist` : "All in Watchlist"}>
              <Icon name={missing.length ? "plus" : "check"} /> {missing.length ? "Add all to Watchlist" : "In your Watchlist"}
            </button>
          </div>
        </div>
      </section>
      <section aria-label="Movies in this collection">
        <h2 className={tv ? "tv-row-title" : "m-row-title"}>Movies</h2>
        <div className={tv ? "tv-grid" : "m-grid"}>
          {parts.map((it, i) => {
            const h = history[it.id];
            return (
              <div key={it.id} className="coll-part">
                {tv ? <TvPoster item={it} id={`coll-${i}`} expand={false} /> : <MPoster item={it} />}
                <span className="coll-part-label">Part {i + 1}{it.year ? ` • ${it.year}` : ""}{h?.completed ? " • Watched" : ""}</span>
                {h && !h.completed && h.duration > 0 && <span className="coll-progress" aria-label={`${Math.round((h.position / h.duration) * 100)} % watched`}><span style={{ width: `${Math.min(100, (h.position / h.duration) * 100)}%` }} /></span>}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
