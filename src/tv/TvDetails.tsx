import { useEffect, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { ErrorState, Img, Skeleton, TitleArt, toast } from "../components/ui";
import { Trailer, rankTrailers } from "../components/Trailer";
import { RatePopover } from "../components/RatePopover";
import { VideoOverlay } from "../components/VideoOverlay";
import { useLiteMotion, useSeason, useTitle, useTrailerStage } from "../lib/hooks";
import { actions, useHistoryEntry, useInWatchlist, usePrefs, useRating } from "../lib/store";
import { detailsMeta, languageName, pluralEps, runtime, shortDate, watchPath, airsLater } from "../lib/format";
import { detailsCtas } from "../lib/watch";
import { focusEl, focusFirst, useBackHandler } from "../lib/focus";
import { useNav } from "../lib/nav";
import type { MediaType, TitleDetails } from "../lib/types";
import { TvPoster } from "./TvCards";

type Tab = "episodes" | "more" | "trailers" | "cast";

export function TvDetails({ type, id, initialTab }: { type: MediaType; id: number; initialTab?: Tab }) {
  const { data, error, mutate } = useTitle(type, id);
  if (error && !data) return <div className="tv-page tv-page--center"><ErrorState message={error.message} onRetry={() => mutate()} /></div>;
  if (!data) return <TvDetailsSkeleton />;
  return <TvDetailsView key={data.id} d={data} initialTab={initialTab} />;
}

function TvDetailsSkeleton() {
  return (
    <div className="tv-page tv-det" aria-busy="true">
      <div className="tv-det-col">
        <Skeleton className="sk-logo" /><Skeleton className="sk-line" /><Skeleton className="sk-line" /><Skeleton className="sk-line sk-line--short" />
        <Skeleton className="sk-cta" />
      </div>
    </div>
  );
}

function TvDetailsView({ d, initialTab }: { d: TitleDetails; initialTab?: Tab }) {
  const prefs = usePrefs();
  const history = useHistoryEntry(d.id);
  const inList = useInWatchlist(d.id);
  const rating = useRating(d.id);
  const { go } = useNav();
  const [zone, setZone] = useState<"main" | "tabs">(initialTab ? "tabs" : "main");
  const tabs: { id: Tab; label: string }[] = [
    ...(d.type === "tv" && d.seasons.some((s) => s.number > 0) ? [{ id: "episodes" as Tab, label: "Episodes" }] : []),
    ...(d.moreLikeThis.length ? [{ id: "more" as Tab, label: "More Like This" }] : []),
    ...(d.videos.length ? [{ id: "trailers" as Tab, label: "Trailers & More" }] : []),
    ...(d.cast.length ? [{ id: "cast" as Tab, label: "Cast" }] : [])
  ];
  const [tab, setTab] = useState<Tab | null>(tabs.find((t) => t.id === initialTab)?.id ?? tabs[0]?.id ?? null);
  const [rateOpen, setRateOpen] = useState(false);
  const [video, setVideo] = useState<{ key: string; name: string } | null>(null);
  const [trailerOn, setTrailerOn] = useState(false);
  const [trailerDone, setTrailerDone] = useState(false);
  const lite = useLiteMotion();
  const trailerKeys = rankTrailers(d.videos);
  const stage = useTrailerStage(!video && zone === "main" && prefs.trailerAutoplay && !lite && trailerKeys.length > 0 && !trailerDone, prefs.trailerDelay, d.id);
  const root = useRef<HTMLDivElement>(null);
  const cta = useRef<HTMLAnchorElement>(null);
  const { primary, secondary } = detailsCtas(d, history);

  useEffect(() => {
    const panel = initialTab ? document.getElementById("tab-panel") : null;
    if (panel) focusFirst(panel); else focusEl(cta.current);
    // focus once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (stage === "idle") setTrailerOn(false); }, [stage]);

  useBackHandler(() => { setZone("main"); focusEl(cta.current); }, zone === "tabs");

  const meta = detailsMeta(d);
  const langs = d.languages.length ? d.languages : [d.originalLanguage ?? languageName(d.language) ?? "English"];

  const toggleList = () => {
    const added = actions.toggleWatchlist(d);
    toast(added ? "Added to Watchlist" : "Removed from Watchlist");
  };

  return (
    <div ref={root} className={`tv-page tv-det ${zone === "tabs" ? "is-tabs" : ""} ${trailerOn ? "is-trailer" : ""}`}>
      <div className={`tv-det-bg ${lite ? "is-kenburns" : ""}`} aria-hidden="true">
        <Img src={d.backdropLarge ?? d.backdrop} alt="" title="" eager className={trailerOn ? "is-hidden" : ""} />
        {stage !== "idle" && trailerKeys.length > 0 && (
          <Trailer keys={trailerKeys} play={stage === "play"} sound={prefs.trailerSound} volume={prefs.trailerVolume} className="tv-det-trailer"
            onPlaying={() => setTrailerOn(true)} onFail={() => { setTrailerOn(false); setTrailerDone(true); }} />
        )}
        <span className="tv-det-scrim" />
      </div>
      <div className="tv-det-slider">
        <section className="tv-det-main" onFocus={() => setZone("main")}>
          <div className="tv-det-col">
            <TitleArt logo={d.logo} title={d.title} className="tv-det-logo" />
            {d.rating ? <p className="tv-det-rating"><Icon name="star" /> {d.rating.toFixed(1)} <span>TMDB</span></p> : null}
            <p className="tv-meta">
              {meta.slice(0, 1).map((m) => <span key={m}>{m}</span>)}
              {d.certification && <span className="cert">{d.certification}</span>}
              {meta.slice(1).map((m) => <span key={m}>{m}</span>)}
            </p>
            {d.overview && <p className="tv-det-overview">{d.overview}</p>}
            {d.genres.length > 0 && <p className="tv-det-genres">{d.genres.map((g) => <span key={g}>{g}</span>)}</p>}
            <p className="tv-det-langs">
              {langs.slice(0, 5).map((l, i) => i === 0 ? <span key={l} className="lang-chip"><Icon name="check" /> {l} Original</span> : <span key={l}>{l}</span>)}
            </p>
            <div className="tv-det-actions lrud-container">
              <div className="tv-det-ctas">
                {secondary && (
                  <a href={secondary.href} id="det-secondary" className="tv-cta tv-cta--secondary" data-hover-focus onClick={(e) => { e.preventDefault(); go(secondary.href); }}>
                    <Icon name="play" /> {secondary.label} <span className="tv-cta-sub">{secondary.sub}</span>
                  </a>
                )}
                <a ref={cta} href={primary.href} id="det-primary" className="tv-cta" data-hover-focus onClick={(e) => { e.preventDefault(); go(primary.href); }}>
                  <Icon name="play" /> {primary.label} {primary.sub && <span className="tv-cta-sub">{primary.sub}</span>}
                </a>
              </div>
              <button id="det-list" className={`tv-square ${inList ? "is-on" : ""}`} onClick={toggleList} aria-pressed={inList} aria-label={inList ? "Remove from Watchlist" : "Add to Watchlist"} data-hover-focus>
                <Icon name={inList ? "check" : "plus"} />
              </button>
              <div className="tv-rate-wrap">
                <button id="det-rate" className={`tv-square ${rating ? "is-on" : ""}`} onClick={() => setRateOpen(true)} aria-label="Rate" aria-haspopup="menu" data-hover-focus>
                  <Icon name={rating === "dislike" ? "thumbDown" : rating === "like" ? "thumbUp" : "heart"} filled={Boolean(rating)} />
                </button>
                {rateOpen && <RatePopover itemId={d.id} current={rating} onClose={() => { setRateOpen(false); focusEl(document.getElementById("det-rate")); }} />}
              </div>
            </div>
          </div>
        </section>
        {tabs.length > 0 && (
          <section className="tv-det-tabbar" aria-label="Sections" onFocus={() => setZone("tabs")}>
            <div role="tablist" className="tv-tabs">
              {tabs.map((t) => (
                <button key={t.id} id={`tab-${t.id}`} role="tab" aria-selected={tab === t.id} className={`tv-tab ${tab === t.id ? "is-selected" : ""}`} data-hover-focus
                  onFocus={() => setTab(t.id)} onClick={() => { setTab(t.id); setZone("tabs"); const c = document.getElementById("tab-panel"); if (c) focusFirst(c); }}>
                  {t.label}
                </button>
              ))}
            </div>
          </section>
        )}
        <section id="tab-panel" className="tv-det-panel" role="tabpanel" onFocus={() => setZone("tabs")}>
          {tab === "episodes" && <EpisodesTab d={d} />}
          {tab === "more" && <div className="tv-grid-row" data-scroll-x>{d.moreLikeThis.map((it, i) => <TvPoster key={it.id} item={it} id={`more-${i}`} expand={false} />)}</div>}
          {tab === "trailers" && (
            <div className="tv-grid-row" data-scroll-x>
              {d.videos.map((v, i) => (
                <button key={v.key} id={`vid-${i}`} className="tv-card tv-video" onClick={() => setVideo({ key: v.key, name: v.name })} data-hover-focus>
                  <span className="tv-land-media"><Img src={v.thumbnail} alt="" title={v.name} /><span className="vid-type">{v.type}</span><Icon name="play" className="tv-land-play" /></span>
                  <span className="tv-land-title">{v.name}</span>
                </button>
              ))}
            </div>
          )}
          {tab === "cast" && (
            <div className="tv-grid-row" data-scroll-x>
              {d.cast.map((c, i) => (
                <div key={c.id} id={`cast-${i}`} tabIndex={0} className="tv-cast" data-hover-focus>
                  <Img src={c.profile} alt="" title={c.name} className="tv-cast-img" />
                  <span className="tv-cast-name">{c.name}</span>
                  {c.character && <span className="tv-cast-role">{c.character}</span>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      {video && <VideoOverlay videoKey={video.key} title={video.name} onClose={() => setVideo(null)} />}
    </div>
  );
}

function EpisodesTab({ d }: { d: TitleDetails }) {
  const history = useHistoryEntry(d.id);
  const seasons = d.seasons.filter((s) => s.number > 0);
  const [season, setSeason] = useState(history?.season ?? seasons[0]?.number ?? 1);
  const { data, error, mutate } = useSeason(d.tmdbId, season);
  const { go } = useNav();
  return (
    <div className="tv-eps">
      <nav className="tv-seasons" aria-label="Seasons" data-scroll-y="item">
        {seasons.map((s) => (
          <button key={s.number} id={`season-${s.number}`} className={`tv-season ${s.number === season ? "is-selected" : ""}`} onFocus={() => setSeason(s.number)} onClick={() => setSeason(s.number)} data-hover-focus>
            <span>{s.name || `Season ${s.number}`}</span><span className="tv-season-eps">{pluralEps(s.episodeCount)}</span>
          </button>
        ))}
      </nav>
      <section className="tv-ep-list" data-scroll-y="item" data-scroll-offset="0.1" aria-live="polite">
        {error && !data && <ErrorState compact message={error.message} onRetry={() => mutate()} />}
        {!data && !error && Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="tv-ep"><Skeleton className="tv-ep-still" /><div className="tv-ep-text"><Skeleton className="sk-line" /><Skeleton className="sk-line sk-line--short" /></div></div>
        ))}
        {data?.number === season && data.episodes.map((ep) => {
          const isCur = history?.season === ep.season && history.episode === ep.number;
          const href = watchPath("tv", d.tmdbId, ep.season, ep.number) + (isCur && !history.completed ? `&t=${history.position}` : "");
          const soon = airsLater(ep.airDate);
          const pct = isCur && history.duration ? Math.min(100, (history.position / history.duration) * 100) : 0;
          return (
            <a key={ep.id} id={`ep-${ep.season}-${ep.number}`} href={href} className={`tv-ep ${soon ? "is-upcoming" : ""}`} aria-disabled={soon || undefined} data-hover-focus
              onClick={(e) => { e.preventDefault(); if (soon) toast(`Episode ${ep.number} arrives ${shortDate(ep.airDate)}`); else go(href); }}>
              <span className="tv-ep-still"><Img src={ep.still} alt="" title={`Episode ${ep.number}`} />{!soon && <Icon name="play" className="tv-ep-play" />}{pct > 0 && <span className="progress"><span style={{ width: `${pct}%` }} /></span>}</span>
              <span className="tv-ep-text">
                <span className="tv-ep-title">{ep.number}. {ep.title}</span>
                <span className="tv-ep-meta">{soon ? `Coming ${shortDate(ep.airDate)}` : [`S${ep.season} E${ep.number}`, shortDate(ep.airDate), runtime(ep.runtime)].filter(Boolean).join(" • ")}</span>
                {ep.overview && <span className="tv-ep-overview">{ep.overview}</span>}
              </span>
            </a>
          );
        })}
      </section>
    </div>
  );
}
