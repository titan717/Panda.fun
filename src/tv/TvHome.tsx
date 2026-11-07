import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { Img, Skeleton, TitleArt, ErrorState } from "../components/ui";
import { Trailer, pickTrailer } from "../components/Trailer";
import { useDwell, useTitle } from "../lib/hooks";
import { useHomeRows, type HomeRow } from "../lib/rows";
import { usePrefs } from "../lib/store";
import { detailsMeta, isNew, titlePath } from "../lib/format";
import { focusFirst } from "../lib/focus";
import { useNav } from "../lib/nav";
import type { PageKind, PandaItem } from "../lib/types";
import { TvContinue, TvLandscape, TvPoster } from "./TvCards";

/* ---------------- Hero (spec 5) ---------------- */
function TvHero({ items, kind, onFocusHero }: { items: PandaItem[]; kind: PageKind; onFocusHero: () => void }) {
  const [index, setIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const [trailerOn, setTrailerOn] = useState(false);
  const [trailerFailed, setTrailerFailed] = useState<string | null>(null);
  const prefs = usePrefs();
  const { go } = useNav();
  const item = items[index % Math.max(1, items.length)];
  const details = useTitle(item?.type ?? null, item?.tmdbId ?? null).data;
  const trailerKey = details && details.tmdbId === item?.tmdbId ? pickTrailer(details.videos) : null;
  const canTrailer = Boolean(prefs.trailerAutoplay && trailerKey && trailerFailed !== trailerKey);
  const showTrailer = useDwell(focused && canTrailer, 2500);

  useEffect(() => { setTrailerOn(false); }, [index, showTrailer]);

  // auto-advance every 8 s while no trailer plays (spec 5.10)
  useEffect(() => {
    if (items.length < 2 || (showTrailer && canTrailer)) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % items.length), 8000);
    return () => clearTimeout(t);
  }, [index, items.length, showTrailer, canTrailer]);

  if (!item) return null;
  const peeks = [1, 2].map((o) => items[(index + o) % items.length]).filter((p): p is PandaItem => Boolean(p) && p !== item);
  const meta = details && details.tmdbId === item.tmdbId ? detailsMeta(details) : [item.year].filter(Boolean).map(String);
  const cert = details?.tmdbId === item.tmdbId ? details.certification : null;
  const genres = item.genres.slice(0, 2);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (items.length < 2) return;
    if (e.key === "ArrowRight") { e.preventDefault(); setIndex((i) => (i + 1) % items.length); }
    else if (e.key === "ArrowLeft" && index > 0) { e.preventDefault(); setIndex((i) => i - 1); }
  };

  return (
    <section className={`tv-hero ${focused ? "is-focused" : ""}`} data-row aria-roledescription="carousel" aria-label="Featured">
      <div className="tv-hero-peeks" aria-hidden="true">
        {peeks.map((p, i) => <div key={p.id + i} className={`tv-hero-peek tv-hero-peek--${i + 1}`}><Img src={p.backdrop} alt="" title={p.title} /></div>)}
      </div>
      <a href={titlePath(item)} id="hero-card" className="tv-hero-card" data-hover-focus
        onClick={(e) => { e.preventDefault(); go(titlePath(item)); }}
        onFocus={() => { setFocused(true); onFocusHero(); }} onBlur={() => setFocused(false)} onKeyDown={onKeyDown}
        aria-label={`${item.title}. ${index + 1} of ${items.length}`}>
        <Img key={item.id} src={item.backdropLarge ?? item.backdrop} alt="" title={item.title} eager className={`tv-hero-bg ${trailerOn ? "is-hidden" : ""}`} />
        {showTrailer && canTrailer && trailerKey && (
          <Trailer key={trailerKey} videoKey={trailerKey} className="tv-hero-trailer" onPlaying={() => setTrailerOn(true)}
            onEnd={() => { setTrailerOn(false); setIndex((i) => (i + 1) % items.length); }}
            onError={() => { setTrailerOn(false); setTrailerFailed(trailerKey); }} />
        )}
        <span className="tv-hero-scrim" />
        <span className="tv-hero-badges">
          {kind === "home" && <span className="glass-badge"><Icon name="trend" /> #{index + 1} in Trending Today</span>}
          {isNew(item) && <span className="glass-badge"><Icon name="sparkle" /> Newly Added</span>}
          {kind !== "home" && item.rating ? <span className="glass-badge"><Icon name="star" /> {item.rating.toFixed(1)}</span> : null}
        </span>
        {trailerOn && <span className="tv-hero-sound" aria-hidden="true"><Icon name="volume" /></span>}
        <span className="tv-hero-info">
          <TitleArt logo={item.logo} title={item.title} className="tv-hero-logo" />
          <span className="tv-meta">
            {meta.slice(0, 2).map((m) => <span key={m}>{m}</span>)}
            {cert && <span className="cert">{cert}</span>}
            {genres.map((g) => <span key={g}>{g}</span>)}
            {meta.slice(2).map((m) => <span key={m}>{m}</span>)}
          </span>
          {item.overview && <span className="tv-hero-overview">{item.overview}</span>}
        </span>
      </a>
      <div className="tv-hero-dots" aria-hidden="true">
        {items.map((it, i) => <span key={it.id} className={i === index ? "is-active" : ""} />)}
      </div>
    </section>
  );
}

function TvHeroSkeleton() {
  return (
    <section className="tv-hero" data-row aria-busy="true">
      <div className="tv-hero-card tv-hero-card--loading">
        <Skeleton className="sk-fill" />
        <span className="tv-hero-info"><Skeleton className="sk-logo" /><Skeleton className="sk-line" /><Skeleton className="sk-line sk-line--short" /></span>
      </div>
    </section>
  );
}

/* ---------------- Rows (spec 6) ---------------- */
function TvRow({ row, index, active, onFocusRow }: { row: HomeRow; index: number; active: number; onFocusRow: (index: number, item: PandaItem) => void }) {
  const focus = useCallback((item: PandaItem) => onFocusRow(index, item), [index, onFocusRow]);
  const state = active < 0 ? "" : index < active ? "is-above" : index === active ? "is-active" : "is-below";
  return (
    <section className={`tv-row tv-row--${row.kind} ${state}`} data-row aria-label={row.title} id={`row-${row.id}`}>
      <h2 className="tv-row-title">{row.title}</h2>
      <div className="tv-row-track" data-scroll-x>
        {row.kind === "continue" && row.entries.map((h, i) => <TvContinue key={h.item.id} entry={h} id={`${row.id}-${i}`} onFocusItem={focus} />)}
        {row.kind === "landscape" && row.items.map((it, i) => <TvLandscape key={it.id} item={it} id={`${row.id}-${i}`} onFocusItem={focus} />)}
        {row.kind === "poster" && row.items.map((it, i) => <TvPoster key={it.id} item={it} id={`${row.id}-${i}`} onFocusItem={focus} />)}
        {row.kind === "top10" && row.items.map((it, i) => <TvPoster key={it.id} item={it} id={`${row.id}-${i}`} rank={i + 1} onFocusItem={focus} />)}
      </div>
    </section>
  );
}

export function TvHome({ kind }: { kind: PageKind }) {
  const { rows, hero, page } = useHomeRows(kind);
  const [active, setActive] = useState(-1);
  const [backdrop, setBackdrop] = useState<PandaItem | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const onFocusRow = useCallback((i: number, item: PandaItem) => { setActive(i); setBackdrop(item); }, []);
  const onFocusHero = useCallback(() => setActive(-1), []);

  // initial focus: hero, once content exists
  const ready = Boolean(page.data);
  useEffect(() => {
    if (!ready) return;
    const el = root.current;
    if (el && !el.contains(document.activeElement)) focusFirst(el);
  }, [ready, kind]);

  if (page.error && !page.data) return <div className="tv-page tv-page--center"><ErrorState message={page.error.message} onRetry={() => page.mutate()} /></div>;

  return (
    <div ref={root} className={`tv-page tv-home ${active >= 0 ? "is-rows" : ""}`} data-scroll-y="row" data-scroll-offset="0.4">
      <div className={`tv-backdrop ${active >= 0 && backdrop ? "is-visible" : ""}`} aria-hidden="true">
        {backdrop && <Img key={backdrop.id} src={backdrop.backdropLarge ?? backdrop.backdrop} alt="" title="" />}
      </div>
      {page.data ? <TvHero items={hero} kind={kind} onFocusHero={onFocusHero} /> : <TvHeroSkeleton />}
      <div className="tv-rows">
        {page.data
          ? rows.map((r, i) => <TvRow key={r.id} row={r} index={i} active={active} onFocusRow={onFocusRow} />)
          : <section className="tv-row"><Skeleton className="sk-row-title" /><div className="tv-row-track">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="sk-poster" />)}</div></section>}
      </div>
    </div>
  );
}
