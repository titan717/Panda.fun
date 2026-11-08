import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { Img, Skeleton, TitleArt, ErrorState } from "../components/ui";
import { Trailer, rankTrailers } from "../components/Trailer";
import { useLiteMotion, useTitle, useTrailerStage } from "../lib/hooks";
import { useHomeRows, type HomeRow } from "../lib/rows";
import { actions, usePrefs } from "../lib/store";
import { detailsMeta, isNew, titlePath } from "../lib/format";
import { focusFirst } from "../lib/focus";
import { whenIdle } from "../lib/lazy";
import { preloadImages } from "../lib/preload";
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
  const lite = useLiteMotion();
  const { go } = useNav();
  const item = items[index % Math.max(1, items.length)];
  const details = useTitle(item?.type ?? null, item?.tmdbId ?? null).data;
  const trailerKeys = details && details.tmdbId === item?.tmdbId ? rankTrailers(details.videos) : [];
  const canTrailer = Boolean(prefs.trailerAutoplay && !lite && trailerKeys.length && trailerFailed !== item?.id);
  const stage = useTrailerStage(focused && canTrailer, prefs.trailerDelay, item?.id ?? "");

  useEffect(() => { setTrailerOn(false); }, [index, stage]);

  // auto-advance every 8 s while no trailer is loading or playing (spec 5.10)
  useEffect(() => {
    if (items.length < 2 || stage !== "idle") return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % items.length), 8000);
    return () => clearTimeout(t);
  }, [index, items.length, stage]);

  // warm the next hero backdrop so auto-advance crossfades onto a decoded image
  const next = items.length > 1 ? items[(index + 1) % items.length] : null;
  useEffect(() => { if (next) preloadImages([next.backdropLarge ?? next.backdrop, next.logo], 2); }, [next]);

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
    <section className={`tv-hero ${focused ? "is-focused" : ""} ${trailerOn ? "is-trailer" : ""}`} data-row aria-roledescription="carousel" aria-label="Featured">
      <div className="tv-hero-peeks" aria-hidden="true">
        {peeks.map((p, i) => <div key={p.id + i} className={`tv-hero-peek tv-hero-peek--${i + 1}`}><Img src={p.backdrop} alt="" title={p.title} /></div>)}
      </div>
      <a href={titlePath(item)} id="hero-card" className="tv-hero-card" data-hover-focus
        onClick={(e) => { e.preventDefault(); go(titlePath(item)); }}
        onFocus={() => { setFocused(true); onFocusHero(); }} onBlur={() => setFocused(false)} onKeyDown={onKeyDown}
        aria-label={`${item.title}. ${index + 1} of ${items.length}`}>
        <span className={`tv-hero-bgwrap ${lite && focused ? "is-kenburns" : ""}`}>
          <Img key={item.id} src={item.backdropLarge ?? item.backdrop} alt="" title={item.title} eager className={`tv-hero-bg ${trailerOn ? "is-hidden" : ""}`} />
        </span>
        {stage !== "idle" && canTrailer && (
          <Trailer key={item.id} keys={trailerKeys} play={stage === "play"} sound={prefs.trailerSound} volume={prefs.trailerVolume} className="tv-hero-trailer"
            onPlaying={() => setTrailerOn(true)}
            onFail={() => { setTrailerOn(false); setTrailerFailed(item.id); }} />
        )}
        <span className="tv-hero-scrim" />
        <span className="tv-hero-badges">
          {kind === "home" && <span className="glass-badge"><Icon name="trend" /> #{index + 1} in Trending Today</span>}
          {isNew(item) && <span className="glass-badge"><Icon name="sparkle" /> Newly Added</span>}
          {item.rating ? <span className="glass-badge"><Icon name="star" /> {item.rating.toFixed(1)}</span> : null}
        </span>
        {trailerOn && (
          <span className="tv-hero-sound" role="button" aria-label={prefs.trailerSound ? "Mute trailers" : "Unmute trailers"}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); actions.setPrefs({ trailerSound: !prefs.trailerSound }); }}>
            <Icon name={prefs.trailerSound ? "volume" : "volumeOff"} />
          </span>
        )}
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
    <section className="tv-hero" data-row aria-busy="true" aria-label="Loading featured titles">
      <div className="tv-hero-card tv-hero-card--loading">
        <Skeleton className="sk-fill" />
        <span className="tv-hero-info"><Skeleton className="sk-logo" /><Skeleton className="sk-line" /><Skeleton className="sk-line sk-line--short" /></span>
      </div>
    </section>
  );
}

/** Loading layout mirrors the real page: a poster row, a landscape row and another poster row (spec 18.1). */
function TvRowsSkeleton() {
  const shapes = ["sk-poster", "sk-land", "sk-poster"] as const;
  return (
    <>
      {shapes.map((shape, r) => (
        <section key={r} className="tv-row tv-row--skeleton" aria-hidden="true">
          <Skeleton className="sk-row-title" />
          <div className="tv-row-track">{Array.from({ length: shape === "sk-land" ? 5 : 8 }, (_, i) => <Skeleton key={i} className={shape} />)}</div>
        </section>
      ))}
    </>
  );
}

/* ---------------- Rows (spec 6) ---------------- */
function TvRow({ row, index, active, onFocusRow }: { row: HomeRow; index: number; active: number; onFocusRow: (index: number, item: PandaItem) => void }) {
  const focus = useCallback((item: PandaItem) => onFocusRow(index, item), [index, onFocusRow]);
  const state = active < 0 ? "" : index < active ? "is-above" : index === active ? "is-active" : "is-below";
  return (
    <section className={`tv-row tv-row--${row.kind} ${state}`} data-row aria-labelledby={`row-${row.id}-title`} id={`row-${row.id}`}>
      <h2 className="tv-row-title" id={`row-${row.id}-title`}>{row.title}</h2>
      <div className="tv-row-track" data-scroll-x>
        {row.kind === "continue" && row.entries.map((h, i) => <TvContinue key={h.item.id} entry={h} id={`${row.id}-${i}`} onFocusItem={focus} />)}
        {row.kind === "landscape" && row.items.map((it, i) => <TvLandscape key={it.id} item={it} id={`${row.id}-${i}`} pos={[i + 1, row.items.length]} onFocusItem={focus} />)}
        {row.kind === "poster" && row.items.map((it, i) => <TvPoster key={it.id} item={it} id={`${row.id}-${i}`} pos={[i + 1, row.items.length]} onFocusItem={focus} />)}
        {row.kind === "top10" && row.items.map((it, i) => <TvPoster key={it.id} item={it} id={`${row.id}-${i}`} rank={i + 1} pos={[i + 1, row.items.length]} onFocusItem={focus} />)}
      </div>
    </section>
  );
}

export function TvHome({ kind }: { kind: PageKind }) {
  const { rows, hero, page } = useHomeRows(kind);
  const [active, setActive] = useState(-1);
  const [layers, setLayers] = useState<PandaItem[]>([]);
  const backdrop = layers[layers.length - 1] ?? null;
  const root = useRef<HTMLDivElement>(null);
  const prefs = usePrefs();
  const lite = useLiteMotion();
  const [rowTrailerOn, setRowTrailerOn] = useState(false);
  const [rowFailed, setRowFailed] = useState<string | null>(null);
  // keep the previous backdrop underneath so the new one crossfades over it (300 ms, §4.A)
  const onFocusRow = useCallback((i: number, item: PandaItem) => {
    setActive(i);
    setLayers((l) => (l[l.length - 1]?.id === item.id ? l : [...l.slice(-1), item]));
  }, []);
  const rowsActive = active >= 0 && Boolean(backdrop);
  const rowStage = useTrailerStage(rowsActive && prefs.trailerAutoplay && prefs.rowTrailers && !lite && rowFailed !== backdrop?.id, prefs.trailerDelay, backdrop?.id ?? "");
  const rowDetails = useTitle(rowStage !== "idle" && backdrop ? backdrop.type : null, rowStage !== "idle" && backdrop ? backdrop.tmdbId : null).data;
  const rowKeys = rowDetails && backdrop && rowDetails.tmdbId === backdrop.tmdbId ? rankTrailers(rowDetails.videos) : [];
  useEffect(() => { setRowTrailerOn(false); }, [backdrop?.id, rowStage]);
  const onFocusHero = useCallback(() => setActive(-1), []);

  // warm the posters/stills of the rows just below focus (and the first rows on load)
  useEffect(() => {
    if (!rows.length) return;
    const from = Math.max(0, active);
    const urls = rows.slice(from, from + 3).flatMap((r) => (r.kind === "continue" ? r.entries.map((e) => e.item.backdrop) : r.items.slice(0, 10).map((it) => (r.kind === "landscape" ? it.backdrop : it.poster))));
    whenIdle(() => preloadImages(urls, 30), 800);
  }, [rows, active]);

  // warm the large backdrops either side of the focused card, so the page backdrop swaps without a gap
  useEffect(() => {
    if (active < 0 || !backdrop) return;
    const r = rows[active];
    const list = !r ? [] : r.kind === "continue" ? r.entries.map((e) => e.item) : r.items;
    const at = list.findIndex((it) => it.id === backdrop.id);
    if (at < 0) return;
    const near = [list[at + 1], list[at - 1], list[at + 2]].filter(Boolean) as PandaItem[];
    const t = setTimeout(() => preloadImages(near.map((it) => it.backdropLarge ?? it.backdrop), 3), 200);
    return () => clearTimeout(t);
  }, [active, backdrop, rows]);

  // initial focus: hero, once content exists
  const ready = Boolean(page.data);
  useEffect(() => {
    if (!ready) return;
    const el = root.current;
    if (el && !el.contains(document.activeElement)) focusFirst(el);
  }, [ready, kind]);

  if (page.error && !page.data) return <div className="tv-page tv-page--center"><ErrorState message={page.error.message} onRetry={() => page.mutate()} /></div>;

  return (
    <div ref={root} className={`tv-page tv-home ${active >= 0 ? "is-rows" : ""} ${rowTrailerOn ? "is-row-trailer" : ""}`} data-scroll-y="row" data-scroll-offset="0.4">
      <div className={`tv-backdrop ${rowsActive ? "is-visible" : ""} ${lite && rowsActive ? "is-kenburns" : ""}`} aria-hidden="true">
        {layers.map((b) => <div key={b.id} className="tv-backdrop-layer"><Img src={b.backdropLarge ?? b.backdrop} alt="" title="" /></div>)}
        {rowsActive && rowStage !== "idle" && rowKeys.length > 0 && backdrop && (
          <Trailer key={backdrop.id} keys={rowKeys} play={rowStage === "play"} sound={prefs.trailerSound} volume={prefs.trailerVolume}
            onPlaying={() => setRowTrailerOn(true)} onFail={() => { setRowTrailerOn(false); setRowFailed(backdrop.id); }} />
        )}
      </div>
      {page.data ? <TvHero items={hero} kind={kind} onFocusHero={onFocusHero} /> : <TvHeroSkeleton />}
      <div className="tv-rows">
        {page.data
          ? rows.map((r, i) => <TvRow key={r.id} row={r} index={i} active={active} onFocusRow={onFocusRow} />)
          : <TvRowsSkeleton />}
      </div>
    </div>
  );
}
