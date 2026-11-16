import "./details.css";
import { warmSourceHint } from "../lib/playback/registry";
import { native } from "../lib/native";
import { titleLink } from "../lib/remote";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Icon } from "../components/Icon";
import { ExtraIcon } from "../components/ExtraIcons";
import "../styles/spoilers.css";
import { ErrorState, Img, Skeleton, TitleArt, toast } from "../components/ui";
import { Trailer, pickTrailer, rankTrailers } from "../components/Trailer";
import { RatePopover, rateLabel } from "../components/RatePopover";
import { RateEmoji } from "../components/RateEmoji";
import { VideoOverlay } from "../components/VideoOverlay";
import { warmPlayback } from "../lib/prefetch";
import { whenIdle } from "../lib/lazy";
import { useSeason, useTitle } from "../lib/hooks";
import { useSurfaceTrailer } from "../lib/useTrailer";
import { useMostlyVisible } from "../lib/trailerAutoplay";
import { episodeCountLabel, episodeLabel, initialSeason, isUnaired, lastWatched, missingEpisodes, seasonEpisodes, seasonLabel, seasonOptions } from "../lib/seasons";
import { actions, useHasReminder, useHasLists, useHistoryEntry, useInWatchlist, useListCount, usePrefs, useRating } from "../lib/store";
import { toggleReminder } from "../components/Remind";
import { SaveToSheet } from "../components/QuickActions";
import { Sheet, SheetItem } from "../components/Sheet";
import { castAndCrew, detailsMeta, voteLabel, runtime, shortDate } from "../lib/format";
import { detailsCtas, episodeRow, hideSpoiler, nextEpisodeOf, SPOILER_NOTE } from "../lib/watch";
import { useNav } from "../lib/nav";
import type { MediaType, TitleDetails } from "../lib/types";
import { MPoster } from "./MCards";
import { usePersonalList } from "../lib/intel/personalize";
import type { PandaItem } from "../lib/types";

/** "More Like This": the catalogue's similar titles, ordered with this profile's taste (membership unchanged). */
function MoreLikeThis({ items }: { items: readonly PandaItem[] }) {
  const ordered = usePersonalList(items);
  return <div className="m-grid">{ordered.slice(0, 12).map((it) => <MPoster key={it.id} item={it} />)}</div>;
}

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

/**
 * Seasons & episodes (v1.3.2): horizontal season chips ("Season 1"… "Specials"; never the backend's arc names),
 * a season header with the episode count and a Resume shortcut, and uniform episode cards.
 */
export function EpisodeList({ d, limit, onSeason }: { d: TitleDetails; limit?: number; onSeason?: (n: number) => void }) {
  const history = useHistoryEntry(d.id);
  const prefs = usePrefs();
  const options = useMemo(() => seasonOptions(d.seasons), [d.seasons]);
  const [season, setSeason] = useState(() => initialSeason(options, history) ?? 1);
  const opt = options.find((o) => o.number === season);
  const [expanded, setExpanded] = useState(false);
  const { data, error, mutate } = useSeason(d.tmdbId, season);
  const { go } = useNav();
  const eps = useMemo(() => (data?.number === season ? seasonEpisodes(season, data.episodes) : []), [data, season]);
  const loaded = data?.number === season;
  const last = lastWatched(history);
  const gaps = loaded ? missingEpisodes(eps) : [];
  // the collapsed list starts at the last-watched episode when it is further down the season
  const lastAt = last && last.season === season ? eps.findIndex((e) => e.number === last.episode) : -1;
  const from = limit && !expanded && lastAt >= limit ? Math.min(lastAt, Math.max(0, eps.length - limit)) : 0;
  const shown = limit && !expanded ? eps.slice(from, from + limit) : eps;
  const chips = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ season: number; number: number; title: string; done: boolean } | null>(null);
  // keep the selected chip in view (20+ seasons scroll sideways)
  useEffect(() => {
    const c = chips.current, el = c?.querySelector<HTMLElement>(".is-selected");
    if (c && el) c.scrollLeft = Math.max(0, el.offsetLeft - c.offsetLeft - 16);
  }, [season]);
  const mark = (upTo: number, done: boolean, only?: boolean) => {
    if (!menu) return;
    const list = only ? [{ season: menu.season, episode: menu.number }] : eps.filter((e) => e.number <= upTo && !isUnaired(e)).map((e) => ({ season: e.season, episode: e.number }));
    actions.markEpisodes(d, list, done, done ? nextEpisodeOf(d.seasons, menu.season, upTo) : null);
    toast(done ? (only ? `Marked episode ${menu.number} as watched` : `Marked episodes 1–${upTo} as watched`) : `Marked episode ${menu.number} as unwatched`);
    setMenu(null);
  };
  const resume = last?.action ? episodeRow(history, d.tmdbId, last.season, last.episode) : null;
  const label = opt?.label ?? seasonLabel(season);
  return (
    <section className="m-eps" aria-label="Episodes">
      {options.length > 1 && (
        <div ref={chips} className="m-season-chips" role="tablist" aria-label="Seasons">
          {options.map((s) => (
            <button key={s.number} role="tab" aria-selected={s.number === season} className={`m-season-chip ${s.number === season ? "is-selected" : ""}`} onClick={() => { setSeason(s.number); setExpanded(false); onSeason?.(s.number); }}>
              {s.label}{last?.season === s.number && <span className="m-season-dot" aria-label="Last watched" />}
            </button>
          ))}
        </div>
      )}
      <header className="m-ep-head">
        <div className="m-ep-head-text">
          <h3 className="m-ep-head-title">{label}</h3>
          <p className="m-ep-head-meta">
            {[loaded ? episodeCountLabel(eps.length) : opt ? episodeCountLabel(opt.episodeCount) : null, opt?.airDate?.slice(0, 4)].filter(Boolean).join(" · ")}
            {gaps.length > 0 && <span> · {gaps.length === 1 ? `Episode ${gaps[0]} isn't listed` : `${gaps.length} episodes aren't listed`}</span>}
          </p>
        </div>
        {last && resume && <button className="m-ep-resume" onClick={() => go(resume.href)}><Icon name="play" /> {last.action}</button>}
        {last && !resume && <span className="m-ep-last">{last.label}</span>}
      </header>
      {error && !data && <ErrorState compact message={error.message} onRetry={() => mutate()} />}
      {!loaded && !error && [0, 1, 2].map((i) => <div key={i} className="m-ep"><span className="m-ep-row"><Skeleton className="m-ep-still" /><span className="m-ep-text"><Skeleton className="sk-line" /><Skeleton className="sk-line sk-line--short" /></span></span></div>)}
      {loaded && eps.length === 0 && (
        <p className="m-ep-empty">{opt?.upcoming ? `${label} hasn't aired yet${opt.airDate ? `. It premieres ${shortDate(opt.airDate)}.` : "."}` : `Episodes for ${label} aren't available yet.`}</p>
      )}
      {shown.map((ep) => {
        const row = episodeRow(history, d.tmdbId, ep.season, ep.number);
        const href = row.href;
        const soon = isUnaired(ep);
        const pct = row.pct;
        const spoil = hideSpoiler(prefs.hideSpoilers, row.done, pct);
        const isLast = !!last && last.season === ep.season && last.episode === ep.number;
        const badge = row.badge === "next" ? "Up next" : row.badge === "current" ? "Continue" : isLast ? "Last watched" : null;
        const meta = soon ? [`Coming ${shortDate(ep.airDate) ?? "soon"}`] : [row.left ? `${row.left}m left` : runtime(ep.runtime), row.done ? null : shortDate(ep.airDate)];
        return (
          <button key={ep.id} id={`m-ep-${ep.season}-${ep.number}`} className={`m-ep ${soon ? "is-upcoming" : ""} ${row.done ? "is-watched" : ""} ${row.badge || isLast ? "is-current" : ""}`} aria-current={isLast ? "step" : undefined} aria-disabled={soon || undefined} onClick={() => { if (soon) toast(`Episode ${ep.number} arrives ${shortDate(ep.airDate)}`); else go(href); }}
            onContextMenu={(e) => { e.preventDefault(); if (!soon) setMenu({ season: ep.season, number: ep.number, title: ep.title, done: row.done }); }}>
            <span className="m-ep-row">
              <span className={`m-ep-still ${spoil ? "is-spoiler" : ""}`}><Img src={ep.still} alt="" title={`E${ep.number}`} />{spoil && <ExtraIcon name="eyeOff" className="spoiler-mark" />}{!soon && <Icon name="play" className="m-ep-play" />}{badge && <span className={`ep-badge ep-badge--${row.badge ?? "last"}`}>{badge}</span>}{row.done && <span className="ep-done" aria-label="Watched"><Icon name="check" /></span>}{pct > 0 && <span className="progress"><span style={{ width: `${pct}%` }} /></span>}</span>
              <span className="m-ep-text">
                <span className="m-ep-title">{episodeLabel(ep)}</span>
                <span className="m-ep-meta">{meta.filter(Boolean).join(" · ")}{row.done && <span className="ep-watched"><Icon name="check" /> Watched</span>}</span>
              </span>
            </span>
            {ep.overview && <span className={`m-ep-overview ${spoil ? "is-spoiler-note" : ""}`}>{spoil ? SPOILER_NOTE : ep.overview}</span>}
          </button>
        );
      })}
      {menu && (
        <Sheet title={episodeLabel({ number: menu.number, title: menu.title })} onClose={() => setMenu(null)}>
          <SheetItem icon={<Icon name="play" />} label="Play" onClick={() => { const r = episodeRow(history, d.tmdbId, menu.season, menu.number); setMenu(null); go(r.href); }} />
          {menu.done
            ? <SheetItem icon={<Icon name="close" />} label="Mark as unwatched" onClick={() => mark(menu.number, false, true)} />
            : <SheetItem icon={<Icon name="check" />} label="Mark as watched" onClick={() => mark(menu.number, true, true)} />}
          {menu.number > 1 && <SheetItem icon={<Icon name="check" />} label={`Mark episodes 1–${menu.number} as watched`} onClick={() => mark(menu.number, true)} />}
        </Sheet>
      )}
      {limit && eps.length > limit && <button className="m-view-more" onClick={() => setExpanded((x) => !x)}>{expanded ? "View Less" : `View all ${eps.length} episodes`} <Icon name={expanded ? "chevronUp" : "chevronDown"} /></button>}
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
  useEffect(() => { whenIdle(() => warmPlayback({ type: d.type, tmdbId: d.tmdbId, imdbId: d.imdbId, season: history?.season, episode: history?.episode }, warmSourceHint()), 1500); }, [d.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const { go, back } = useNav();
  const [rateOpen, setRateOpen] = useState(false);
  const [video, setVideo] = useState<{ key: string; name: string } | null>(null);
  const [solid, setSolid] = useState(false);
  const trailerKey = pickTrailer(d.videos);
  const media = useRef<HTMLDivElement>(null);
  // Trailer Autoplay Manager: plays once after the profile's delay while the media is on screen and no video is open
  const mediaVisible = useMostlyVisible(media, 0.5);
  const trailer = useSurfaceTrailer("m-details", trailerKey ? d.id : null, !video && mediaVisible);
  const trailerOn = trailer.shown;
  const epsRef = useRef<HTMLDivElement>(null);
  const trailersRef = useRef<HTMLDivElement>(null);
  const { primary } = detailsCtas(d, history);
  const reminded = useHasReminder(d.id);
  const meta = detailsMeta(d);
  const people = castAndCrew(d);

  useEffect(() => { window.scrollTo(0, 0); }, []);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > window.innerWidth * 0.5);
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // a real web link (the app's own address is unreachable outside the APK), opening Panda when installed (v1.2.4)
  const share = async () => {
    const url = titleLink(d.type, d.tmdbId);
    if (native?.shareText) { native.shareText(d.title, `Watch ${d.title} on Panda.fun ${url}`); return; }
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
      <div ref={media} className="m-det-media">
        <Img src={d.backdropLarge ?? d.backdrop} alt="" title={d.title} eager className={trailerOn ? "is-hidden" : ""} />
        {trailer.stage !== "idle" && trailerKey && <Trailer keys={rankTrailers(d.videos)} play={trailer.stage === "play"} sound={prefs.trailerSound} volume={prefs.trailerVolume} loop={false} className="m-det-trailer" onPlaying={trailer.onPlaying} onEnd={trailer.onEnd} onFail={trailer.onFail} />}
        {trailerKey && (
          <button className="m-det-watch-trailer" onClick={() => setVideo({ key: trailerKey, name: `${d.title} — Trailer` })} aria-label="Watch trailer">
            <Icon name="movie" size={16} /><span>Trailer</span>
          </button>
        )}
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
        {primary.kind === "remind"
          ? <button className={`m-cta ${reminded ? "is-reminded" : ""}`} aria-pressed={reminded} onClick={() => toggleReminder(d)}><Icon name={reminded ? "check" : "bell"} /> {reminded ? "Reminder Set" : primary.label} · {primary.sub}</button>
          : <button className="m-cta" onClick={() => go(primary.href)}><Icon name="play" /> {primary.label}{primary.sub ? ` ${primary.sub}` : ""}</button>}
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
              {rating ? <RateEmoji kind={rating} size={22} /> : <Icon name="heart" size={22} />}<span>{rating ? "Rated" : "Rate"}</span>
            </button>
            {rateOpen && <RatePopover itemId={d.id} current={rating} onClose={() => setRateOpen(false)} variant="m" />}
          </div>
        </div>
        {rating && <p className="sr-only">{rateLabel(rating)}</p>}
        {d.type === "tv" && seasonOptions(d.seasons).length > 0 && (
          <div ref={epsRef} className="m-det-section">
            <div className="m-row-head"><h2 className="m-row-title">Episodes</h2><button className="m-link" onClick={() => go(`/title/tv/${d.tmdbId}/episodes`)}>All Episodes</button></div>
            <EpisodeList d={d} limit={4} />
          </div>
        )}
        {d.moreLikeThis.length > 0 && (
          <div className="m-det-section">
            <h2 className="m-row-title">More Like This</h2>
            <MoreLikeThis items={d.moreLikeThis} />
          </div>
        )}
        {d.collection && (
          <div className="m-det-section">
            <Link href={`/collection/${d.collection.id}`} className="m-row-title m-row-link" id="det-collection">{d.collection.name} <Icon name="chevronRight" /></Link>
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
