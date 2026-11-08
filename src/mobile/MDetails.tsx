import { useEffect, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { ErrorState, Img, Skeleton, TitleArt, toast } from "../components/ui";
import { Trailer, pickTrailer, rankTrailers } from "../components/Trailer";
import { RatePopover, rateLabel } from "../components/RatePopover";
import { VideoOverlay } from "../components/VideoOverlay";
import { warmPlayback } from "../lib/prefetch";
import { whenIdle } from "../lib/lazy";
import { useDwell, useSeason, useTitle } from "../lib/hooks";
import { actions, useHasLists, useHistoryEntry, useInWatchlist, useListCount, usePrefs, useRating } from "../lib/store";
import { SaveToSheet } from "../components/QuickActions";
import { Sheet, SheetItem } from "../components/Sheet";
import { castAndCrew, detailsMeta, voteLabel, runtime, shortDate, airsLater } from "../lib/format";
import { detailsCtas, episodeRow, nextEpisodeOf } from "../lib/watch";
import { useNav } from "../lib/nav";
import type { MediaType, TitleDetails } from "../lib/types";
import { MPoster } from "./MCards";

export function MDetails({ type, id }: { type: MediaType; id: number }) {
  const { data, error, mutate } = useTitle(type, id);
  const { back } = useNav();
  if (error && !data) return <div className="m-page"><button className="m-close" onClick={() => back("/")} aria-label="Close"><Icon name="close" /></button><ErrorState message={error.message} onRetry={() => mutate()} /></div>;
  if (!data) {
    return (
      <div className="m-page m-det" aria-busy="true">
        <Skeleton className="m-det-media" />
        <div className="m-det-body"><Skeleton className="sk-logo-m" /><Skeleton className="sk-line" /><Skeleton className="sk-cta-m" /><Skeleton className="sk-line" /><Skeleton className="sk-line sk-line--short" /></div>
      </div>
    );
  }
  return <MDetailsView key={data.id} d={data} />;
}

export function EpisodeList({ d, limit, onSeason }: { d: TitleDetails; limit?: number; onSeason?: (n: number) => void }) {
  const history = useHistoryEntry(d.id);
  const seasons = d.seasons.filter((s) => s.number > 0);
  const [season, setSeason] = useState(history?.season ?? seasons[0]?.number ?? 1);
  const [expanded, setExpanded] = useState(false);
  const { data, error, mutate } = useSeason(d.tmdbId, season);
  const { go } = useNav();
  const eps = data?.number === season ? data.episodes : [];
  const shown = limit && !expanded ? eps.slice(0, limit) : eps;
  const [menu, setMenu] = useState<{ season: number; number: number; title: string; done: boolean } | null>(null);
  const mark = (upTo: number, done: boolean, only?: boolean) => {
    if (!menu) return;
    const list = only ? [{ season: menu.season, episode: menu.number }] : eps.filter((e) => e.number <= upTo && !airsLater(e.airDate)).map((e) => ({ season: e.season, episode: e.number }));
    actions.markEpisodes(d, list, done, done ? nextEpisodeOf(d.seasons, menu.season, upTo) : null);
    toast(done ? (only ? `Marked episode ${menu.number} as watched` : `Marked episodes 1–${upTo} as watched`) : `Marked episode ${menu.number} as unwatched`);
    setMenu(null);
  };
  return (
    <section className="m-eps" aria-label="Episodes">
      <div className="m-season-tabs" role="tablist">
        {seasons.map((s) => (
          <button key={s.number} role="tab" aria-selected={s.number === season} className={`m-season-tab ${s.number === season ? "is-selected" : ""}`} onClick={() => { setSeason(s.number); setExpanded(false); onSeason?.(s.number); }}>
            Season {s.number}
          </button>
        ))}
      </div>
      {error && !data && <ErrorState compact message={error.message} onRetry={() => mutate()} />}
      {!data && !error && [0, 1, 2].map((i) => <div key={i} className="m-ep"><Skeleton className="m-ep-still" /><div className="m-ep-text"><Skeleton className="sk-line" /><Skeleton className="sk-line sk-line--short" /></div></div>)}
      {shown.map((ep) => {
        const row = episodeRow(history, d.tmdbId, ep.season, ep.number);
          const href = row.href;
          const soon = airsLater(ep.airDate);
          const pct = row.pct;
        return (
          <button key={ep.id} className={`m-ep ${soon ? "is-upcoming" : ""} ${row.done ? "is-watched" : ""}`} aria-disabled={soon || undefined} onClick={() => { if (soon) toast(`Episode ${ep.number} arrives ${shortDate(ep.airDate)}`); else go(href); }}
            onContextMenu={(e) => { e.preventDefault(); if (!soon) setMenu({ season: ep.season, number: ep.number, title: ep.title, done: row.done }); }}>
            <span className="m-ep-row">
              <span className="m-ep-still"><Img src={ep.still} alt="" title={`E${ep.number}`} />{!soon && <Icon name="play" className="m-ep-play" />}{pct > 0 && <span className="progress"><span style={{ width: `${pct}%` }} /></span>}</span>
              <span className="m-ep-text">
                <span className="m-ep-title">{ep.number}. {ep.title}</span>
                <span className="m-ep-meta">{soon ? `Coming ${shortDate(ep.airDate)}` : [`S${ep.season} E${ep.number}`, row.done ? null : shortDate(ep.airDate), row.left ? `${row.left}m left` : runtime(ep.runtime)].filter(Boolean).join(" • ")}{row.done && <span className="ep-watched"><Icon name="check" /> Watched</span>}</span>
              </span>
            </span>
            {ep.overview && <span className="m-ep-overview">{ep.overview}</span>}
          </button>
        );
      })}
      {menu && (
        <Sheet title={`${menu.number}. ${menu.title}`} onClose={() => setMenu(null)}>
          <SheetItem icon={<Icon name="play" />} label="Play" onClick={() => { const r = episodeRow(history, d.tmdbId, menu.season, menu.number); setMenu(null); go(r.href); }} />
          {menu.done
            ? <SheetItem icon={<Icon name="close" />} label="Mark as unwatched" onClick={() => mark(menu.number, false, true)} />
            : <SheetItem icon={<Icon name="check" />} label="Mark as watched" onClick={() => mark(menu.number, true, true)} />}
          {menu.number > 1 && <SheetItem icon={<Icon name="check" />} label={`Mark episodes 1–${menu.number} as watched`} onClick={() => mark(menu.number, true)} />}
        </Sheet>
      )}
      {limit && eps.length > limit && <button className="m-view-more" onClick={() => setExpanded((x) => !x)}>{expanded ? "View Less" : "View More"} <Icon name={expanded ? "chevronUp" : "chevronDown"} /></button>}
    </section>
  );
}

function MDetailsView({ d }: { d: TitleDetails }) {
  const prefs = usePrefs();
  const history = useHistoryEntry(d.id);
  const hasLists = useHasLists();
  const [saveTo, setSaveTo] = useState(false);
  const inWatchlist = useInWatchlist(d.id);
  const listCount = useListCount(d.id);
  const inList = inWatchlist || listCount > 0;
  const rating = useRating(d.id);
  // v1.1.6: warm the source connection, skip markers and season for the next Play press
  useEffect(() => { whenIdle(() => warmPlayback({ type: d.type, tmdbId: d.tmdbId, imdbId: d.imdbId, season: history?.season, episode: history?.episode }, prefs.preferredSource), 1500); }, [d.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const { go, back } = useNav();
  const [rateOpen, setRateOpen] = useState(false);
  const [video, setVideo] = useState<{ key: string; name: string } | null>(null);
  const [trailerOn, setTrailerOn] = useState(false);
  const [trailerDone, setTrailerDone] = useState(false);
  const [solid, setSolid] = useState(false);
  const trailerKey = pickTrailer(d.videos);
  const play = useDwell(prefs.trailerAutoplay && Boolean(trailerKey) && !trailerDone && !video, 1200);
  const epsRef = useRef<HTMLDivElement>(null);
  const trailersRef = useRef<HTMLDivElement>(null);
  const { primary } = detailsCtas(d, history);
  const meta = detailsMeta(d);
  const people = castAndCrew(d);

  useEffect(() => { window.scrollTo(0, 0); }, []);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > window.innerWidth * 0.5);
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: d.title, text: `Watch ${d.title} on Panda.fun`, url });
      else { await navigator.clipboard.writeText(url); toast("Link copied"); }
    } catch (e) { if ((e as Error).name !== "AbortError") toast("Couldn't share this title"); }
  };

  return (
    <div className="m-page m-det">
      <header className={`m-det-head ${solid ? "is-solid" : ""}`}>
        <span className="m-det-head-title">{solid ? d.title : ""}</span>
        <button className="m-close" onClick={() => back("/")} aria-label="Close"><Icon name="close" /></button>
      </header>
      <div className="m-det-media">
        <Img src={d.backdropLarge ?? d.backdrop} alt="" title={d.title} eager className={trailerOn ? "is-hidden" : ""} />
        {play && trailerKey && <Trailer keys={rankTrailers(d.videos)} play sound={prefs.trailerSound} volume={prefs.trailerVolume} loop={false} className="m-det-trailer" onPlaying={() => setTrailerOn(true)} onEnd={() => { setTrailerOn(false); setTrailerDone(true); }} onFail={() => { setTrailerOn(false); setTrailerDone(true); }} />}
        {trailerOn && (
          <button className="m-det-mute" onClick={() => actions.setPrefs({ trailerSound: !prefs.trailerSound })} aria-label={prefs.trailerSound ? "Mute trailer" : "Unmute trailer"}>
            <Icon name={prefs.trailerSound ? "volume" : "volumeOff"} size={20} />
          </button>
        )}
        {!trailerKey && <span className="m-trailer-na">TRAILER UNAVAILABLE</span>}
      </div>
      <div className="m-det-body">
        <TitleArt logo={d.logo} title={d.title} className="m-det-logo" />
        <p className="m-det-meta">
          {meta.slice(0, 1).map((m) => <span key={m}>{m}</span>)}
          {d.certification && <span className="cert">{d.certification}</span>}
          {meta.slice(1).map((m) => <span key={m}>{m}</span>)}
        </p>
        {d.rating ? <p className="m-det-rating"><Icon name="star" size={14} /> {d.rating.toFixed(1)} <span>TMDB</span>{voteLabel(d.voteCount) && <span className="m-det-votes">{voteLabel(d.voteCount)}</span>}</p> : null}
        <button className="m-cta" onClick={() => go(primary.href)}><Icon name="play" /> {primary.label}{primary.sub ? ` ${primary.sub}` : ""}</button>
        {d.genres.length > 0 && <p className="m-det-genres">{d.genres.map((g) => <span key={g}>{g}</span>)}</p>}
        {d.overview && <p className="m-det-overview">{d.overview}</p>}
        <div className="m-det-actions">
          <button className={inList ? "is-on" : ""} aria-pressed={inList} onClick={() => { if (hasLists) { setSaveTo(true); return; } const added = actions.toggleWatchlist(d); toast(added ? "Added to Watchlist" : "Removed from Watchlist"); }}>
            <Icon name={inList ? "check" : "plus"} size={22} /><span>{inList ? (hasLists ? "Saved" : "Added") : hasLists ? "Save" : "Watchlist"}</span>
          </button>
          <button onClick={() => void share()}><Icon name="share" size={22} /><span>Share</span></button>
          {d.type === "tv"
            ? <button onClick={() => epsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}><Icon name="episodes" size={22} /><span>Episodes</span></button>
            : <button disabled={!trailerKey} onClick={() => trailerKey && setVideo({ key: trailerKey, name: `${d.title} — Trailer` })}><Icon name="movie" size={22} /><span>Trailer</span></button>}
          <div className="m-rate-wrap">
            <button className={rating ? "is-on" : ""} onClick={() => setRateOpen((o) => !o)} aria-haspopup="menu" aria-expanded={rateOpen}>
              <Icon name={rating === "dislike" ? "thumbDown" : rating === "like" ? "thumbUp" : "heart"} filled={Boolean(rating)} size={22} /><span>{rating ? "Rated" : "Rate"}</span>
            </button>
            {rateOpen && <RatePopover itemId={d.id} current={rating} onClose={() => setRateOpen(false)} className="rate-pop--m" />}
          </div>
        </div>
        {rating && <p className="sr-only">{rateLabel(rating)}</p>}
        {d.type === "tv" && d.seasons.some((s) => s.number > 0) && (
          <div ref={epsRef} className="m-det-section">
            <div className="m-row-head"><h2 className="m-row-title">Episodes</h2><button className="m-link" onClick={() => go(`/title/tv/${d.tmdbId}/episodes`)}>All Episodes</button></div>
            <EpisodeList d={d} limit={4} />
          </div>
        )}
        {d.moreLikeThis.length > 0 && (
          <div className="m-det-section">
            <h2 className="m-row-title">More Like This</h2>
            <div className="m-grid">{d.moreLikeThis.slice(0, 12).map((it) => <MPoster key={it.id} item={it} />)}</div>
          </div>
        )}
        {d.collection && (
          <div className="m-det-section">
            <h2 className="m-row-title">{d.collection.name}</h2>
            <div className="m-row-track">
              {d.collection.parts.map((it, i) => (
                <div key={it.id} className={`m-part ${it.id === d.id ? "is-current" : ""}`}>
                  <MPoster item={it} />
                  <span className="m-part-label">{it.id === d.id ? "Now viewing" : `Part ${i + 1}${it.year ? ` • ${it.year}` : ""}`}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {d.videos.length > 0 && (
          <div ref={trailersRef} className="m-det-section">
            <h2 className="m-row-title">Trailers & More</h2>
            <div className="m-row-track">
              {d.videos.map((v) => (
                <button key={v.key} className="m-land m-video" onClick={() => setVideo({ key: v.key, name: v.name })}>
                  <span className="m-land-media"><Img src={v.thumbnail} alt="" title={v.name} /><Icon name="play" className="m-land-play" /><span className="vid-type">{v.type}</span></span>
                  <span className="m-land-title">{v.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {people.length > 0 && (
          <div className="m-det-section">
            <h2 className="m-row-title">Cast</h2>
            <div className="m-row-track">
              {people.map((c) => (
                <a key={c.id} href={`/person/${c.id}`} className="m-cast" onClick={(e) => { e.preventDefault(); go(`/person/${c.id}`); }}>
                  <Img src={c.profile} alt="" title={c.name} /><span className="m-cast-name">{c.name}</span>{c.role && <span className="m-cast-role">{c.role}</span>}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
      {video && <VideoOverlay videoKey={video.key} title={video.name} onClose={() => setVideo(null)} />}
      {saveTo && <SaveToSheet item={d} onClose={() => setSaveTo(false)} />}
    </div>
  );
}

export function MAllEpisodes({ id }: { id: number }) {
  const { data, error, mutate } = useTitle("tv", id);
  const { back } = useNav();
  return (
    <div className="m-page">
      <header className="m-bar">
        <button className="m-bar-back" onClick={() => back(`/title/tv/${id}`)} aria-label="Back"><Icon name="back" /></button>
        <h1 className="m-bar-title">{data?.title ?? "Episodes"}</h1>
      </header>
      {error && !data && <ErrorState message={error.message} onRetry={() => mutate()} />}
      {data && <EpisodeList d={data} />}
    </div>
  );
}
