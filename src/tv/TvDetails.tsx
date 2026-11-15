import "./details.css";
import { setRemoteTitle } from "../lib/remote";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { ExtraIcon } from "../components/ExtraIcons";
import "../styles/spoilers.css";
import { Link } from "wouter";
import { ErrorState, Img, Skeleton, TitleArt, toast } from "../components/ui";
import { Trailer, pickTrailer, rankTrailers } from "../components/Trailer";
import { RatePopover, rateLabel } from "../components/RatePopover";
import { RateEmoji } from "../components/RateEmoji";
import { VideoOverlay } from "../components/VideoOverlay";
import { warmPlayback } from "../lib/prefetch";
import { whenIdle } from "../lib/lazy";
import { useLiteMotion, useSeason, useTitle } from "../lib/hooks";
import { useSurfaceTrailer } from "../lib/useTrailer";
import { episodeCountLabel, episodeLabel, initialSeason, isUnaired, lastWatched, missingEpisodes, seasonEpisodes, seasonLabel, seasonOptions } from "../lib/seasons";
import { actions, useHasReminder, useHasLists, useHistoryEntry, useInWatchlist, useListCount, usePrefs, useRating } from "../lib/store";
import { SaveToSheet } from "../components/QuickActions";
import { toggleReminder } from "../components/Remind";
import { castAndCrew, detailsMeta, languageName, voteLabel, pluralEps, runtime, shortDate } from "../lib/format";
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
    ...(d.type === "tv" && seasonOptions(d.seasons).length > 0 ? [{ id: "episodes" as Tab, label: "Episodes" }] : []),
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
  const lite = useLiteMotion();
  const trailerKeys = rankTrailers(d.videos);
  const fullTrailer = pickTrailer(d.videos);
  // Trailer Autoplay Manager: starts after the profile's delay while the main zone is in view and no video is open
  const trailer = useSurfaceTrailer("tv-details", trailerKeys.length > 0 ? d.id : null, !video && zone === "main");
  const stage = trailer.stage;
  const trailerOn = trailer.shown;
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
            onPlaying={trailer.onPlaying} onFail={trailer.onFail} />
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
              {fullTrailer && (
                <button id="det-trailer" className="tv-square" onClick={() => setVideo({ key: fullTrailer, name: `${d.title} — Trailer` })} aria-label="Watch trailer" title="Watch trailer" data-hover-focus>
                  <Icon name="movie" />
                </button>
              )}
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

/** True right after a key press (D-pad), false for mouse hover focus on desktop. */
let lastKeyAt = 0;
if (typeof window !== "undefined") window.addEventListener("keydown", () => { lastKeyAt = performance.now(); }, { capture: true, passive: true });
const keyNav = () => performance.now() - lastKeyAt < 400;

/**
 * Seasons & episodes (v1.3.2): a D-pad season rail ("Season 1", "Season 2"… and "Specials"; never the backend's
 * arc names), a season header with the episode count and a Resume shortcut, and uniform episode cards.
 */
function EpisodesTab({ d }: { d: TitleDetails }) {
  const history = useHistoryEntry(d.id);
  const prefs = usePrefs();
  const options = useMemo(() => seasonOptions(d.seasons), [d.seasons]);
  const [season, setSeason] = useState(() => initialSeason(options, history) ?? 1);
  const opt = options.find((o) => o.number === season);
  const { data, error, mutate } = useSeason(d.tmdbId, season);
  const eps = useMemo(() => (data?.number === season ? seasonEpisodes(season, data.episodes) : null), [data, season]);
  const last = lastWatched(history);
  const gaps = eps ? missingEpisodes(eps) : [];
  const { go } = useNav();
  const list = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLElement>(null);

  // the rail opens scrolled to the selected season (long anime runs have 20+ seasons)
  useEffect(() => {
    const r = rail.current, el = document.getElementById(`season-${season}`);
    if (r && el) r.scrollTop = Math.max(0, el.offsetTop - r.offsetTop - r.clientHeight / 3);
    // once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // a new season starts at the top; the last-watched season opens at that episode (scroll only, focus stays)
  useEffect(() => {
    const l = list.current;
    if (!l || !eps) return;
    const el = last && last.season === season ? document.getElementById(`ep-${season}-${last.episode}`) : null;
    l.scrollTop = el ? Math.max(0, el.offsetTop - l.offsetTop - 12) : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eps, season]);

  const resume = last?.action ? episodeRow(history, d.tmdbId, last.season, last.episode) : null;
  const year = opt?.airDate?.slice(0, 4);
  return (
    <div className="tv-eps">
      <nav ref={rail} className="tv-seasons" aria-label="Seasons" data-scroll-y="item" onFocus={(e) => {
        // D-pad entry from the tab bar or episode list lands on the selected season, not the nearest one
        const from = e.relatedTarget as Node | null;
        if (!keyNav() || !from || rail.current?.contains(from)) return;
        const sel = document.getElementById(`season-${season}`);
        if (sel && e.target !== sel) { e.stopPropagation(); focusEl(sel); }
      }}>
        {options.map((s) => (
          <button key={s.number} id={`season-${s.number}`} className={`tv-season ${s.number === season ? "is-selected" : ""} ${s.upcoming ? "is-upcoming" : ""}`} aria-current={s.number === season ? "true" : undefined}
            data-autofocus={s.number === season ? "" : undefined} onFocus={() => setSeason(s.number)} onClick={() => setSeason(s.number)} data-hover-focus>
            <span className="tv-season-name">{s.label}</span>
            {last?.season === s.number && <span className="tv-season-dot" aria-label="Last watched" />}
            <span className="tv-season-eps">{s.upcoming && !s.episodeCount ? "Soon" : pluralEps(s.episodeCount)}</span>
          </button>
        ))}
      </nav>
      <section className="tv-ep-pane" aria-label={opt?.label ?? seasonLabel(season)}>
        <header className="tv-ep-head">
          <div className="tv-ep-head-text">
            <h3 className="tv-ep-head-title">{opt?.label ?? seasonLabel(season)}</h3>
            <p className="tv-ep-head-meta">
              {[eps ? episodeCountLabel(eps.length) : opt ? episodeCountLabel(opt.episodeCount) : null, year].filter(Boolean).join(" · ")}
              {gaps.length > 0 && <span className="tv-ep-gaps"> · {gaps.length === 1 ? `Episode ${gaps[0]} isn't listed` : `${gaps.length} episodes aren't listed`}</span>}
            </p>
          </div>
          {last && resume && (
            <a id="ep-resume" href={resume.href} className="tv-ep-resume" data-hover-focus onClick={(e) => { e.preventDefault(); go(resume.href); }}>
              <Icon name="play" /> {last.action}
            </a>
          )}
          {last && !resume && <span className="tv-ep-last">{last.label}</span>}
        </header>
        <div ref={list} className="tv-ep-list" data-scroll-y="item" data-scroll-offset="0.1" aria-live="polite">
          {error && !data && <ErrorState compact message={error.message} onRetry={() => mutate()} />}
          {!data && !error && Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="tv-ep"><Skeleton className="tv-ep-still" /><div className="tv-ep-text"><Skeleton className="sk-line" /><Skeleton className="sk-line sk-line--short" /></div></div>
          ))}
          {eps && eps.length === 0 && (
            <p className="tv-ep-empty">{opt?.upcoming ? `${opt.label} hasn't aired yet${opt.airDate ? `. It premieres ${shortDate(opt.airDate)}.` : "."}` : `Episodes for ${opt?.label ?? seasonLabel(season)} aren't available yet.`}</p>
          )}
          {eps?.map((ep) => {
            const row = episodeRow(history, d.tmdbId, ep.season, ep.number);
            const href = row.href;
            const soon = isUnaired(ep);
            const pct = row.pct;
            const spoil = hideSpoiler(prefs.hideSpoilers, row.done, pct);
            const isLast = !!last && last.season === ep.season && last.episode === ep.number;
            const badge = row.badge === "next" ? "Up next" : row.badge === "current" ? "Continue" : isLast ? "Last watched" : null;
            const meta = soon ? [`Coming ${shortDate(ep.airDate) ?? "soon"}`] : [row.left ? `${row.left}m left` : runtime(ep.runtime), row.done ? null : shortDate(ep.airDate)];
            return (
              <a key={ep.id} id={`ep-${ep.season}-${ep.number}`} href={href} className={`tv-ep ${soon ? "is-upcoming" : ""} ${row.done ? "is-watched" : ""} ${row.badge || isLast ? "is-current" : ""}`} aria-current={isLast ? "step" : undefined} aria-disabled={soon || undefined} data-hover-focus
                onClick={(e) => { e.preventDefault(); if (soon) toast(`Episode ${ep.number} arrives ${shortDate(ep.airDate)}`); else go(href); }}>
                <span className={`tv-ep-still ${spoil ? "is-spoiler" : ""}`}><Img src={ep.still} alt="" title={`E${ep.number}`} />{spoil && <ExtraIcon name="eyeOff" className="spoiler-mark" />}{!soon && <Icon name="play" className="tv-ep-play" />}
                  {badge && <span className={`ep-badge ep-badge--${row.badge ?? "last"}`}>{badge}</span>}
                  {row.done && <span className="ep-done" aria-label="Watched"><Icon name="check" /></span>}
                  {!soon && ep.runtime ? <span className="ep-runtime">{runtime(ep.runtime)}</span> : null}
                  {pct > 0 && <span className="progress"><span style={{ width: `${pct}%` }} /></span>}</span>
                <span className="tv-ep-text">
                  <span className="tv-ep-title">{episodeLabel(ep)}</span>
                  <span className="tv-ep-meta">{meta.filter(Boolean).join(" · ")}{row.done && <span className="ep-watched"><Icon name="check" /> Watched</span>}</span>
                  {ep.overview && <span className={`tv-ep-overview ${spoil ? "is-spoiler-note" : ""}`}>{spoil ? SPOILER_NOTE : ep.overview}</span>}
                </span>
              </a>
            );
          })}
        </div>
      </section>
    </div>
  );
}
