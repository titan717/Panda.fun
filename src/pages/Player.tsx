import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearch } from "wouter";
import useSWR from "swr";
import { Icon } from "../components/Icon";
import { ErrorState, Img, Spinner, toast } from "../components/ui";
import { Sheet } from "../components/Sheet";
import { KidsGate } from "../components/KidsGate";
import { keys } from "../lib/api";
import { useSeason, useTitle } from "../lib/hooks";
import { actions, getPrefs, usePrefs } from "../lib/store";
import { stopAllTrailers } from "../lib/audio";
import { useBackHandler, focusEl } from "../lib/focus";
import { useNav } from "../lib/nav";
import { useIsTv } from "../lib/layout";
import { navKey } from "../lib/keys";
import { TvPlayerChrome, type TvChromeProps } from "../tv/TvPlayerChrome";
import { api } from "../lib/api";
import { ADAPTERS, embedUrl, parseMessage, READY_TIMEOUT_MS, sendCommand, sourceName, SOURCE_ORDER } from "../lib/player";
import { nextEpisodeOf, prevEpisodeOf } from "../lib/watch";
import { airsLater, pluralEps, runtime, titlePath, watchPath } from "../lib/format";
import type { MediaType, PlaybackPayload, PlaybackSource, SourceId, TitleDetails } from "../lib/types";

const SHORT: Record<SourceId, string> = { cinesrc: sourceName("cinesrc"), vidy: sourceName("vidy") };

export function PlayerPage() {
  const params = useParams<{ type: string; id: string }>();
  const qs = new URLSearchParams(useSearch());
  const type = (params.type === "tv" ? "tv" : "movie") as MediaType;
  const id = Number(params.id);
  const s = Number(qs.get("s")) || 1, e = Number(qs.get("e")) || 1;
  const t = Number(qs.get("t")) || 0;
  if (!Number.isFinite(id) || id <= 0) return <div className="player player--error"><ErrorState message="This title link is invalid." /></div>;
  // re-mount the player when the episode changes through our own navigation (next / episodes drawer)
  return (
    <KidsGate type={type} id={id} wait>
      <Player key={`${type}-${id}-${type === "tv" ? `${s}-${e}` : ""}`} type={type} id={id} season={s} episode={e} start={t} />
    </KidsGate>
  );
}

/** The episode after s/e, unless it hasn't aired yet. */
function playableNext(d: TitleDetails, s: number, e: number) {
  const n = nextEpisodeOf(d.seasons, s, e);
  if (!n) return null;
  const air = d.nextEpisode;
  if (air && air.season === n.season && air.episode === n.episode && airsLater(air.airDate)) return null;
  return n;
}

function Player({ type, id, season, episode, start }: { type: MediaType; id: number; season: number; episode: number; start: number }) {
  const prefs = usePrefs();
  const tv = useIsTv();
  const { go, back } = useNav();
  const details = useTitle(type, id).data;
  const isTv = type === "tv";
  const [ep, setEp] = useState({ s: season, e: episode });
  const seasonData = useSeason(isTv ? id : null, isTv ? ep.s : null).data;
  const play = useSWR<PlaybackPayload>(keys.play(type, id, isTv ? { s: season, e: episode, t: start || undefined } : { t: start || undefined }), { revalidateOnFocus: false, revalidateIfStale: false, dedupingInterval: 0 });

  const sources = useMemo(() => {
    const list = play.data?.sources ?? [];
    return [...list].sort((a, b) => SOURCE_ORDER.indexOf(a.id) - SOURCE_ORDER.indexOf(b.id));
  }, [play.data]);
  const [sourceId, setSourceId] = useState<SourceId>(prefs.preferredSource);
  const source: PlaybackSource | undefined = sources.find((x) => x.id === sourceId) ?? sources[0];
  const tried = useRef(new Set<SourceId>());
  const [nativeControls, setNativeControls] = useState(false);
  // TV draws the TV PLAYER blueprint chrome over sources that can hide their own controls (§6, §20)
  const customChrome = tv && Boolean(source && ADAPTERS[source.id]?.hideControls) && !nativeControls;
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [overlay, setOverlay] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [upNext, setUpNext] = useState<{ s: number; e: number } | null>(null);
  const [countdown, setCountdown] = useState(10);
  const [time, setTime] = useState({ p: start, d: 0 });
  const [muted, setMuted] = useState(false);
  // position to reopen at when the embed reloads (source / quality / controls change)
  const [reloadAt, setReloadAt] = useState<number | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const pos = useRef({ position: start, duration: 0, dirty: false });
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const loadedAt = useRef(0);

  const next = details && isTv ? nextEpisodeOf(details.seasons, ep.s, ep.e) : null;
  const prev = details && isTv ? prevEpisodeOf(details.seasons, ep.s, ep.e) : null;
  const epInfo = seasonData?.number === ep.s ? seasonData.episodes.find((x) => x.number === ep.e) : undefined;

  /* ---- progress persistence (every 5 s, and on exit) ---- */
  const save = useCallback(() => {
    const d = getDetails();
    if (!d || !pos.current.dirty || pos.current.duration <= 0) return;
    actions.saveProgress(d, { position: pos.current.position, duration: pos.current.duration, season: isTv ? ep.s : undefined, episode: isTv ? ep.e : undefined, episodeTitle: epInfo?.title ?? null, next: isTv ? playableNext(d, ep.s, ep.e) : null });
    pos.current.dirty = false;
  }, [ep.s, ep.e, epInfo?.title, isTv]);
  const detailsRef = useRef<TitleDetails | undefined>(details);
  detailsRef.current = details;
  function getDetails() { return detailsRef.current; }

  // the player always wins: stop any trailer the moment it opens (§4.B)
  useEffect(() => { stopAllTrailers(); }, []);
  useEffect(() => { const i = setInterval(save, 5000); return () => { clearInterval(i); save(); }; }, [save]);
  useEffect(() => { window.addEventListener("pagehide", save); return () => window.removeEventListener("pagehide", save); }, [save]);

  /* ---- overlay auto-hide (spec 16.2) ---- */
  const poke = useCallback(() => {
    setOverlay(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setOverlay(false), 4000);
  }, []);
  useEffect(() => { poke(); return () => { if (hideTimer.current) clearTimeout(hideTimer.current); }; }, [poke]);
  useEffect(() => { if (overlay && tv && !customChrome) focusEl(document.getElementById("pl-back")); }, [overlay, tv]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- source readiness + automatic fallback (spec 16.4) ---- */
  const fallback = useCallback((reason: string) => {
    if (!source) return;
    tried.current.add(source.id);
    const nextSrc = sources.find((x) => !tried.current.has(x.id));
    if (nextSrc) {
      toast(`Switched to ${SHORT[nextSrc.id]}`);
      setReloadAt(pos.current.position);
      setReady(false);
      setSourceId(nextSrc.id);
    } else {
      toast(reason);
    }
  }, [source, sources]);

  useEffect(() => {
    if (!source || ready) return;
    loadedAt.current = Date.now();
    const timer = setTimeout(() => fallback("No source could start playback. Try again later."), READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [source, ready, fallback]);

  /* ---- player messages ---- */
  useEffect(() => {
    if (!source) return;
    const onMsg = (m: MessageEvent) => {
      if (m.source !== frame.current?.contentWindow) return;
      const ev = parseMessage(source, m.origin, m.data);
      if (!ev) return;
      switch (ev.kind) {
        case "ready":
          setReady(true);
          if (source.events === "cinesrc") sendCommand(frame.current, source, { c: "volume", value: getPrefs().volume });
          break;
        case "play": setReady(true); setPaused(false); break;
        case "pause": setPaused(true); break;
        case "volume": setMuted(ev.muted); break;
        case "time":
          setReady(true); setPaused(false);
          if (ev.duration > 0) {
            pos.current = { position: ev.position, duration: ev.duration, dirty: true };
            setTime((t) => (Math.abs(t.p - ev.position) >= 0.25 || t.d !== ev.duration ? { p: ev.position, d: ev.duration } : t));
            if (isTv && next && ev.duration - ev.position < 1.5 && !upNext) setUpNext({ s: next.season, e: next.episode });
          }
          break;
        case "ended":
          pos.current = { ...pos.current, position: pos.current.duration || pos.current.position, dirty: true };
          save();
          if (isTv && next) setUpNext({ s: next.season, e: next.episode });
          break;
        case "episode":
          if (ev.internal) { save(); setEp({ s: ev.season, e: ev.episode }); pos.current = { position: 0, duration: 0, dirty: false }; }
          break;
        case "close": exit(); break;
        case "error": if (!ready) fallback(`${SHORT[source.id]} couldn't play this title.`); break;
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }); // re-bound every render so handlers see current state

  /* ---- up-next countdown (spec 16.5) ---- */
  useEffect(() => {
    if (!upNext) return;
    poke();
    if (!prefs.autoplayNext) return;
    setCountdown(10);
    const i = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(i);
  }, [upNext, prefs.autoplayNext, poke]);
  useEffect(() => { if (upNext && prefs.autoplayNext && countdown <= 0) playEpisode(upNext.s, upNext.e); });  

  function playEpisode(sn: number, en: number) {
    save();
    setUpNext(null);
    go(watchPath("tv", id, sn, en), { replace: true });
  }
  function exit() {
    save();
    back(titlePath({ type, tmdbId: id }));
  }

  // On TV the blueprint chrome owns Back (panel → chrome → exit, §20.12).
  useBackHandler(() => {
    if (upNext) { setUpNext(null); return; }
    exit();
  }, !(tv && customChrome));

  const switchSource = (sid: SourceId) => {
    if (sid === source?.id) return;
    save();
    tried.current.clear();
    setReloadAt(pos.current.position);
    setReady(false);
    setSourceId(sid);
    actions.setPrefs({ preferredSource: sid });
    toast(`Playing from ${SHORT[sid]}`);
  };
  const setVolume = (delta: number) => {
    const v = Math.round(Math.max(0, Math.min(1, getPrefs().volume + delta)) * 10) / 10;
    actions.setPrefs({ volume: v });
    if (source) sendCommand(frame.current, source, { c: "volume", value: v });
    toast(`Volume ${Math.round(v * 100)}%`, 1200);
  };
  const togglePlay = () => {
    if (!source) return;
    sendCommand(frame.current, source, { c: paused ? "play" : "pause" });
    setPaused((p) => !p);
  };
  const seekTo = (to: number) => {
    if (!source) return;
    const t = Math.max(0, to);
    sendCommand(frame.current, source, { c: "seek", to: t });
    pos.current = { ...pos.current, position: t, dirty: true };
    setTime((x) => ({ ...x, p: t }));
  };
  const seekBy = (by: number) => seekTo(pos.current.position + by);
  const reloadEmbed = () => { save(); setReloadAt(pos.current.position); setReady(false); };
  /* ---- back online: retry the stream from where it stopped ---- */
  const reconnect = useRef<() => void>(() => {});
  reconnect.current = () => {
    if (play.error) { void play.mutate(); return; }
    if (!ready) reloadEmbed();
  };
  useEffect(() => {
    const h = () => reconnect.current();
    window.addEventListener("panda:reconnect", h);
    return () => window.removeEventListener("panda:reconnect", h);
  }, []);

  /* ---- remote keys while the overlay is hidden ---- */
  const onKeyDown = (k: React.KeyboardEvent) => {
    const key = navKey(k.nativeEvent);
    if (!key || key === "back") return;
    const hidden = !overlay;
    poke();
    if (k.defaultPrevented) return; // handled by the TV chrome (seek track)
    if (key === "playpause" || key === "play" || key === "pause") { k.preventDefault(); togglePlay(); return; }
    if (key === "ff") { k.preventDefault(); seekBy(10); return; }
    if (key === "rw") { k.preventDefault(); seekBy(-10); return; }
    if (key === "next" && next) { k.preventDefault(); playEpisode(next.season, next.episode); return; }
    if (key === "prev" && prev) { k.preventDefault(); playEpisode(prev.season, prev.episode); return; }
    if (tv && customChrome) {
      if (hidden && key !== "enter") {
        // first press only reveals the chrome; Left/Right go straight to the seek track
        k.preventDefault();
        if (key === "left" || key === "right") focusEl(document.getElementById("tvp-track"));
      }
      return;
    }
    if (hidden) {
      k.preventDefault();
      if (key === "enter") togglePlay();
      if (key === "left") seekBy(-10);
      if (key === "right") seekBy(10);
    }
  };

  function chromeProps(): TvChromeProps {
    return {
      d: details, isSeries: isTv, ep, episodeTitle: epInfo?.title,
      visible: overlay, poke, hide: () => { if (hideTimer.current) clearTimeout(hideTimer.current); setOverlay(false); },
      paused, ready, position: time.p, duration: time.d,
      controllable: Boolean(source && ADAPTERS[source.id]?.commands),
      onSeek: seekTo, onTogglePlay: togglePlay,
      quality: prefs.quality,
      onQuality: (q) => { if (q === prefs.quality) return; reloadEmbed(); actions.setPrefs({ quality: q }); toast(q === "auto" ? "Quality: Auto" : `Quality: ${q === "480" ? "Data Saver" : q === "2160" ? "4K" : `${q}p`}`); },
      sources, sourceId: source?.id, onSource: switchSource,
      onReport: (issue) => {
        void api.report({ type, tmdbId: id, season: isTv ? ep.s : undefined, episode: isTv ? ep.e : undefined, source: source?.id ?? null, issue: issue.id, position: Math.round(pos.current.position) }).catch(() => undefined);
        const other = sources.find((x) => x.id !== source?.id);
        if (issue.switchSource && other) { switchSource(other.id); toast(`Thanks for the report. Trying ${SHORT[other.id]}`); }
        else if (issue.id === "subs") { reloadEmbed(); setNativeControls(true); toast("Thanks for the report. Pick subtitles in the source player"); }
        else toast("Thanks for the report");
      },
      nativeControls, onNativeControls: (on) => {
        if (on === nativeControls) return;
        reloadEmbed(); setNativeControls(on);
        if (on) setTimeout(() => frame.current?.focus(), 1200);
      },
      muted, onMuted: (m) => { if (source) sendCommand(frame.current, source, { c: "muted", value: m }); setMuted(m); },
      upNext, countdown: upNext && prefs.autoplayNext ? countdown : null, onCancelUpNext: () => setUpNext(null),
      onPlayEpisode: playEpisode,
      onPlayTitle: (item) => { save(); go(watchPath(item.type, item.tmdbId), { replace: true }); },
      onExit: exit
    };
  }

  const title = details?.title ?? "";
  const subtitle = isTv ? `S${ep.s} E${ep.e}${epInfo?.title ? ` · ${epInfo.title}` : ""}` : [details?.year, runtime(details?.runtime)].filter(Boolean).join(" · ");
  const src = source ? embedUrl(source, { customChrome, start: reloadAt ?? undefined, quality: prefs.quality }) : null;

  return (
    <div ref={root} className={`player ${overlay ? "is-overlay" : ""} ${tv ? "player--tv" : "player--touch"}`} onKeyDown={onKeyDown} onMouseMove={poke} role="application" aria-label={`Playing ${title}`}>
      {play.error && !play.data && <div className="player-center"><ErrorState message={play.error.message} onRetry={() => play.mutate()} /></div>}
      {src && source && (
        <iframe key={`${source.id}-${customChrome ? "c" : "n"}-${prefs.quality}`} ref={frame} className="player-frame" src={src} title={`${title} — ${SHORT[source.id]}`}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="origin" tabIndex={tv && !nativeControls ? -1 : 0}
          onLoad={() => { if (source.events !== "cinesrc") setReady(true); }} />
      )}
      {!ready && !play.error && (
        <div className="player-loading" aria-live="polite">
          {details?.backdropLarge && <Img src={details.backdropLarge} alt="" title="" className="player-loading-bg" />}
          <Spinner label={source ? `Loading from ${SHORT[source.id]}…` : "Finding a source…"} />
        </div>
      )}
      <div className="player-hotzone" onMouseEnter={poke} aria-hidden="true" />
      {tv && customChrome ? <TvPlayerChrome {...chromeProps()} /> : <>
      <div className="player-top lrud-container">
        <button id="pl-back" className="pl-btn" onClick={exit} aria-label="Back" data-hover-focus><Icon name="back" /></button>
        <div className="pl-title"><strong>{title}</strong><span>{subtitle}</span></div>
        <div className="pl-sources" role="radiogroup" aria-label="Video source">
          {sources.map((x) => (
            <button key={x.id} id={`pl-src-${x.id}`} role="radio" aria-checked={x.id === source?.id} className={`pl-pill ${x.id === source?.id ? "is-active" : ""}`} onClick={() => switchSource(x.id)} data-hover-focus>{SHORT[x.id]}</button>
          ))}
        </div>
      </div>
      <div className="player-bottom lrud-container">
        {tv && source && ADAPTERS[source.id]?.commands && (
          <>
            <button id="pl-rw" className="pl-btn" onClick={() => seekBy(-10)} aria-label="Back 10 seconds" data-hover-focus><Icon name="prev" /></button>
            <button id="pl-play" className="pl-btn pl-btn--main" onClick={togglePlay} aria-label={paused ? "Play" : "Pause"} data-hover-focus>{paused ? <Icon name="play" /> : <span className="pause-glyph" aria-hidden="true" />}</button>
            <button id="pl-ff" className="pl-btn" onClick={() => seekBy(10)} aria-label="Forward 10 seconds" data-hover-focus><Icon name="next" /></button>
          </>
        )}
        {isTv && <button id="pl-eps" className="pl-chip" onClick={() => setDrawer(true)} data-hover-focus><Icon name="episodes" /> Episodes</button>}
        {isTv && next && <button id="pl-next" className="pl-chip" onClick={() => playEpisode(next.season, next.episode)} data-hover-focus><Icon name="next" /> Next Episode</button>}
        {source?.events === "cinesrc" && (
          <span className="pl-volume">
            <button id="pl-voldown" className="pl-btn" onClick={() => setVolume(-0.1)} aria-label="Volume down" data-hover-focus><Icon name="volumeDown" /></button>
            <span className="pl-vol-val">{Math.round(prefs.volume * 100)}%</span>
            <button id="pl-volup" className="pl-btn" onClick={() => setVolume(0.1)} aria-label="Volume up" data-hover-focus><Icon name="volume" /></button>
          </span>
        )}
      </div>
      {upNext && (
        <div className="upnext lrud-container" role="dialog" aria-label="Up next">
          <p className="upnext-label">Up Next · S{upNext.s} E{upNext.e}</p>
          <div className="upnext-actions">
            <button id="un-play" className="btn btn--primary" data-autofocus autoFocus onClick={() => playEpisode(upNext.s, upNext.e)}>
              {prefs.autoplayNext && <span className="ring" style={{ ["--p" as string]: `${(countdown / 10) * 100}` }} aria-hidden="true" />}
              <Icon name="play" /> Play Now{prefs.autoplayNext ? ` (${Math.max(0, countdown)})` : ""}
            </button>
            <button id="un-cancel" className="btn btn--secondary" onClick={() => setUpNext(null)}>Cancel</button>
          </div>
        </div>
      )}
      </>}
      {drawer && details && <EpisodesDrawer d={details} current={ep} onClose={() => setDrawer(false)} onPick={(sn, en) => { setDrawer(false); playEpisode(sn, en); }} />}
    </div>
  );
}

function EpisodesDrawer({ d, current, onClose, onPick }: { d: TitleDetails; current: { s: number; e: number }; onClose: () => void; onPick: (s: number, e: number) => void }) {
  const seasons = d.seasons.filter((x) => x.number > 0);
  const [season, setSeason] = useState(current.s);
  const { data } = useSeason(d.tmdbId, season);
  return (
    <Sheet title="Episodes" onClose={onClose} className="sheet--episodes">
      <div className="drawer-seasons lrud-container" role="tablist">
        {seasons.map((x) => <button key={x.number} id={`dr-s-${x.number}`} role="tab" aria-selected={x.number === season} className={`m-chip ${x.number === season ? "is-selected" : ""}`} onClick={() => setSeason(x.number)} data-hover-focus>Season {x.number} <small>{pluralEps(x.episodeCount)}</small></button>)}
      </div>
      <div className="drawer-eps lrud-container">
        {!data && <Spinner />}
        {data?.number === season && data.episodes.map((x) => (
          <button key={x.id} id={`dr-e-${x.season}-${x.number}`} className={`drawer-ep ${x.season === current.s && x.number === current.e ? "is-current" : ""}`} onClick={() => onPick(x.season, x.number)} data-hover-focus
            data-autofocus={x.season === current.s && x.number === current.e ? true : undefined}>
            <Img src={x.still} alt="" title={`E${x.number}`} />
            <span><strong>{x.number}. {x.title}</strong><small>{[runtime(x.runtime)].filter(Boolean).join("")}</small></span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
