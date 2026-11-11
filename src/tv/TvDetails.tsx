import "./details.css";
import { setRemoteTitle } from "../lib/remote";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { ExtraIcon } from "../components/ExtraIcons";
import "../styles/spoilers.css";
import { Link } from "wouter";
import { ErrorState, Img, Skeleton, TitleArt, toast } from "../components/ui";
import { Trailer, rankTrailers } from "../components/Trailer";
import { RatePopover, rateLabel } from "../components/RatePopover";
import { RateEmoji } from "../components/RateEmoji";
import { VideoOverlay } from "../components/VideoOverlay";
import { warmPlayback } from "../lib/prefetch";
import { whenIdle } from "../lib/lazy";
import { useLiteMotion, useSeason, useTitle, useTrailerStage } from "../lib/hooks";
import { actions, useHasReminder, useHasLists, useHistoryEntry, useInWatchlist, useListCount, usePrefs, useRating } from "../lib/store";
import { SaveToSheet } from "../components/QuickActions";
import { toggleReminder } from "../components/Remind";
import { castAndCrew, detailsMeta, languageName, voteLabel, pluralEps, runtime, shortDate, airsLater } from "../lib/format";
import { detailsCtas, episodeRow, hideSpoiler, SPOILER_NOTE } from "../lib/watch";
import { focusEl, focusFirst, useBackHandler } from "../lib/focus";
import { useNav } from "../lib/nav";
import type { MediaType, TitleDetails } from "../lib/types";
import { TvPoster } from "./TvCards";

type Tab = "episodes" | "more" | "collection" | "trailers" | "cast";

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
  useEffect(() => { setRemoteTitle({ type: d.type, id: d.tmdbId, title: d.title, poster: d.poster }); return () => setRemoteTitle(null); }, [d]);
  const history = useHistoryEntry(d.id);
  const hasLists = useHasLists();
  const [saveTo, setSaveTo] = useState(false);
  const inWatchlist = useInWatchlist(d.id);
  const listCount = useListCount(d.id);
  const inList = inWatchlist || listCount > 0;
  const rating = useRating(d.id);
  const { go } = useNav();
  const [zone, setZone] = useState<"main" | "tabs">(initialTab ? "tabs" : "main");
  const people = castAndCrew(d);
  const tabs: { id: Tab; label: string }[] = [
    ...(d.type === "tv" && d.seasons.some((s) => s.number > 0) ? [{ id: "episodes" as Tab, label: "Episodes" }] : []),
    ...(d.moreLikeThis.length ? [{ id: "more" as Tab, label: "More Like This" }] : []),
    ...(d.collection ? [{ id: "collection" as Tab, label: "Collection" }] : []),
    ...(d.videos.length ? [{ id: "trailers" as Tab, label: "Trailers & More" }] : []),
    ...(people.length ? [{ id: "cast" as Tab, label: "Cast" }] : [])
  ];
  // v1.1.6: warm the source connection, skip markers and season for the next Play press
  useEffect(() => { whenIdle(() => warmPlayback({ type: d.type, tmdbId: d.tmdbId, imdbId: d.imdbId, season: history?.season, episode: history?.episode }, prefs.preferredSource), 1500); }, [d.id]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const reminded = useHasReminder(d.id);
  const remind = primary.kind === "remind";

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
    // with custom lists the + opens "Save to" (Watchlist 2.0); otherwise it stays a one-press Watchlist toggle
    if (hasLists) { setSaveTo(true); return; }
    const added = actions.toggleWatchlist(d);
    toast(added ? "Added to Watchlist" : "Removed from Watchlist");
  };

  return (
    <div ref={root} className={`tv-page tv-det ${lite ? "is-lite" : ""} ${zone === "tabs" ? "is-tabs" : ""} ${trailerOn ? "is-trailer" : ""}`}>
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
            {d.rating ? <p className="tv-det-rating"><Icon name="star" /> {d.rating.toFixed(1)} <span>TMDB</span>{voteLabel(d.voteCount) && <span className="tv-det-votes">{voteLabel(d.voteCount)}</span>}</p> : null}
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
                <a ref={cta} href={primary.href} id="det-primary" className={`tv-cta ${remind && reminded ? "is-reminded" : ""}`} data-hover-focus aria-pressed={remind ? reminded : undefined}
                  onClick={(e) => { e.preventDefault(); if (remind) toggleReminder(d); else go(primary.href); }}>
                  <Icon name={remind ? (reminded ? "check" : "bell") : "play"} /> {remind && reminded ? "Reminder Set" : primary.label} {primary.sub && <span className="tv-cta-sub">{primary.sub}</span>}
                </a>
              </div>
              <button id="det-list" className={`tv-square ${inList ? "is-on" : ""}`} onClick={toggleList} aria-pressed={inList} aria-label={hasLists ? `Save to a list${inList ? ", saved" : ""}` : inList ? "Remove from Watchlist" : "Add to Watchlist"} data-hover-focus>
                <Icon name={inList ? "check" : "plus"} />
              </button>
              <div className="tv-rate-wrap">
                <button id="det-rate" className={`tv-square ${rating ? "is-on" : ""}`} onClick={() => setRateOpen(true)} aria-label={rating ? `Rated ${rateLabel(rating)}` : "Rate"} aria-haspopup="menu" aria-expanded={rateOpen} data-hover-focus>
                  {rating ? <RateEmoji kind={rating} /> : <Icon name="heart" />}
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
          {tab === "collection" && d.collection && (
            <div className="tv-grid-row" data-scroll-x aria-label={d.collection.name}>
              {d.collection.parts.map((it, i) => (
                <div key={it.id} className={`tv-part ${it.id === d.id ? "is-current" : ""}`}>
                  <TvPoster item={it} id={`part-${i}`} expand={false} />
                  <span className="tv-part-label">{it.id === d.id ? "Now viewing" : `Part ${i + 1}${it.year ? ` • ${it.year}` : ""}`}</span>
                </div>
              ))}
              <Link href={`/collection/${d.collection.id}`} id="part-all" className="tv-part-all" data-hover-focus aria-label={`Open ${d.collection.name}`}>
                <Icon name="grid" /><span>View collection</span><small>{d.collection.parts.length} movies</small>
              </Link>
            </div>
          )}
          {tab === "cast" && (
            <div className="tv-grid-row" data-scroll-x>
              {people.map((c, i) => (
                <a key={c.id} id={`cast-${i}`} href={`/person/${c.id}`} className="tv-cast" data-hover-focus onClick={(e) => { e.preventDefault(); go(`/person/${c.id}`); }}>
                  <Img src={c.profile} alt="" title={c.name} className="tv-cast-img" />
                  <span className="tv-cast-name">{c.name}</span>
                  {c.role && <span className="tv-cast-role">{c.role}</span>}
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
      {video && <VideoOverlay videoKey={video.key} title={video.name} onClose={() => setVideo(null)} />}
      {saveTo && <SaveToSheet item={d} onClose={() => setSaveTo(false)} />}
    </div>
  );
}

function EpisodesTab({ d }: { d: TitleDetails }) {
  const history = useHistoryEntry(d.id);
  const prefs = usePrefs();
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
          const row = episodeRow(history, d.tmdbId, ep.season, ep.number);
          const href = row.href;
          const soon = airsLater(ep.airDate);
          const pct = row.pct;
          const spoil = hideSpoiler(prefs.hideSpoilers, row.done, pct);
          return (
            <a key={ep.id} id={`ep-${ep.season}-${ep.number}`} href={href} className={`tv-ep ${soon ? "is-upcoming" : ""} ${row.done ? "is-watched" : ""} ${row.badge ? "is-current" : ""}`} aria-current={row.badge ? "step" : undefined} aria-disabled={soon || undefined} data-hover-focus
              onClick={(e) => { e.preventDefault(); if (soon) toast(`Episode ${ep.number} arrives ${shortDate(ep.airDate)}`); else go(href); }}>
              <span className={`tv-ep-still ${spoil ? "is-spoiler" : ""}`}><Img src={ep.still} alt="" title={`Episode ${ep.number}`} />{spoil && <ExtraIcon name="eyeOff" className="spoiler-mark" />}{!soon && <Icon name="play" className="tv-ep-play" />}
                {row.badge && <span className={`ep-badge ep-badge--${row.badge}`}>{row.badge === "next" ? "Up next" : "Continue"}</span>}
                {row.done && <span className="ep-done" aria-label="Watched"><Icon name="check" /></span>}
                {!soon && ep.runtime ? <span className="ep-runtime">{runtime(ep.runtime)}</span> : null}
                {pct > 0 && <span className="progress"><span style={{ width: `${pct}%` }} /></span>}</span>
              <span className="tv-ep-text">
                <span className="tv-ep-title">{ep.number}. {ep.title}</span>
                <span className="tv-ep-meta">{soon ? `Coming ${shortDate(ep.airDate)}` : [`S${ep.season} E${ep.number}`, row.done ? null : shortDate(ep.airDate), row.left ? `${row.left}m left` : runtime(ep.runtime)].filter(Boolean).join(" • ")}{row.done && <span className="ep-watched"><Icon name="check" /> Watched</span>}</span>
                {ep.overview && <span className={`tv-ep-overview ${spoil ? "is-spoiler-note" : ""}`}>{spoil ? SPOILER_NOTE : ep.overview}</span>}
              </span>
            </a>
          );
        })}
      </section>
    </div>
  );
}
