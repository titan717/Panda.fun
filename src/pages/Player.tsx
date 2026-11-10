import { API_BASE } from "../lib/api";
import { recordTtff, TickWatch } from "../lib/ttff";
import "./player.css";
import { ExtraIcon } from "../components/ExtraIcons";
import { setRemoteTitle } from "../lib/remote";
import "../styles/spoilers.css";
import "../lib/validateLazy"; // validators for this page's payloads, loaded with the page
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearch } from "wouter";
import useSWR from "swr";
import { Icon } from "../components/Icon";
import { ErrorState, Img, Spinner, toast } from "../components/ui";
import { Sheet } from "../components/Sheet";
import { CaptionLayer } from "../components/CaptionLayer";
import { useCaptions } from "../lib/useCaptions";
import { playerShortcut, SHORTCUTS, toggleFullscreen } from "../lib/shortcuts";
import { clockAt, isCcKey, offsetLabel, subLangName, subLook } from "../lib/captions";
import { KidsGate } from "../components/KidsGate";
import { keys } from "../lib/api";
import { useSeason, useSourceRanking, useTitle } from "../lib/hooks";
import { ISSUES, isAnimeTitle, rankOf, reliabilityLabel, reliabilityTone, sourceOrder, tierLabel } from "../lib/sources";
import { actions, getPrefs, useHistoryEntry, usePrefs, useStore } from "../lib/store";
import { stopAllTrailers } from "../lib/audio";
import { useBackHandler, focusEl, focusFirst } from "../lib/focus";
import { nativeEnterPip, nativePipSupported, nativePlaybackActive } from "../lib/pip";
import { useNav } from "../lib/nav";
import { useIsTv } from "../lib/layout";
import { navKey } from "../lib/keys";
import type { TvChromeProps } from "../tv/TvPlayerChrome";
import { lazyNamed } from "../lib/lazy";
import { api } from "../lib/api";
import { ADAPTERS, embedUrl, parseMessage, READY_TIMEOUT_MS, sendCommand, sourceName, SOURCE_ORDER } from "../lib/player";
import { COMPAT, lastResortOnly, nativeShield, rankSources, recordPlay, SANDBOX, setShieldSource, shieldStats, syncNative } from "../lib/shield";
import { episodeRow, hideSpoiler, nextEpisodeOf, prevEpisodeOf } from "../lib/watch";
import { airsLater, playClock, pluralEps, runtime, titlePath, watchPath } from "../lib/format";
import { PlayerLoading } from "./PlayerLoading";
import { activeSkip, episodeLine, fitScale, getFit, getMutedMemory, saveMutedMemory, saveFit, seekMarkers, type FitMode, binge, shouldAskStill, getIntro, learnIntro, nextCardDue, SLEEP_GRACE_S, SLEEP_OFF, sleepDue, sleepLeft, sleepPillLabel, speedLabel, startSleep, type Intro, type SleepMode, type SleepTimer } from "../lib/player2";
/** TV-only chrome lives in its own chunk so phones never download it (v1.1.6, D-85). TV warms it at idle. */
export const loadTvChrome = () => import("../tv/TvPlayerChrome");
const TvPlayerChrome = lazyNamed(loadTvChrome, "TvPlayerChrome");
// skip / next-episode / still-watching prompts and the options sheet appear only after playback starts: own chunk
const loadPrompts = () => import("../components/PlayerPrompts");
const PlayerPrompts = lazyNamed(loadPrompts, "PlayerPrompts");
const PlayerOptionsSheet = lazyNamed(loadPrompts, "PlayerOptionsSheet");
export const loadSubOptions = () => import("../components/SubtitleOptions");
const SubtitleOptions = lazyNamed(loadSubOptions, "SubtitleOptions");
import type { SkipSegments, MediaType, PlaybackPayload, PlaybackSource, SourceId, TitleDetails } from "../lib/types";

const SHORT: Record<SourceId, string> = { cinesrc: sourceName("cinesrc"), vidy: sourceName("vidy"), vidyanime: sourceName("vidyanime"), vidlink: sourceName("vidlink") };

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

/** The announced episode after s/e that has not aired yet (smart next-up, v1.1.4). */
function upcomingNext(d: TitleDetails, s: number, e: number) {
  const n = nextEpisodeOf(d.seasons, s, e);
  const air = d.nextEpisode;
  if (air?.airDate && airsLater(air.airDate) && (!n || (air.season === n.season && air.episode === n.episode))) return { season: air.season, episode: air.episode, airDate: air.airDate };
  return null;
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
  useEffect(() => { if (details) setRemoteTitle({ type, id, title: details.title, poster: details.poster, playing: true }); return () => setRemoteTitle(null); }, [details, type, id]);
  const isTv = type === "tv";
  const [ep, setEp] = useState({ s: season, e: episode });
  const seasonData = useSeason(isTv ? id : null, isTv ? ep.s : null).data;
  const play = useSWR<PlaybackPayload>(keys.play(type, id, isTv ? { s: season, e: episode, t: start || undefined } : { t: start || undefined }), { revalidateOnFocus: false, revalidateIfStale: false, dedupingInterval: 0 });

  // v1.2.0: anime titles also ask the backend for Vidy's AniList-keyed anime player
  const anime = isAnimeTitle(details);
  const animePlay = useSWR<PlaybackPayload>(anime ? keys.play(type, id, isTv ? { s: season, e: episode, t: start || undefined, anime: 1 } : { t: start || undefined, anime: 1 }) : null, { revalidateOnFocus: false, revalidateIfStale: false, dedupingInterval: 0 });
  // the start order is frozen when the sources arrive, so a late ranking never swaps a loading source
  const rankingSwr = useSourceRanking();
  const ranking = rankingSwr.data;
  const rankingNow = useRef(ranking);
  rankingNow.current = ranking;
  // Automatic waits up to 1.5 s for the ranking (usually warmed on Details) before it picks a source
  const [rankWait, setRankWait] = useState(() => getPrefs().preferredSource === "auto");
  useEffect(() => { if (!rankWait) return; const t = setTimeout(() => setRankWait(false), 1500); return () => clearTimeout(t); }, [rankWait]);
  useEffect(() => { if (ranking || rankingSwr.error) setRankWait(false); }, [ranking, rankingSwr.error]);
  const playData = rankWait ? undefined : play.data;
  const order = useMemo(() => (playData ? sourceOrder(getPrefs().preferredSource, rankingNow.current) : SOURCE_ORDER), [playData]);
  const sources = useMemo(() => {
    const list = [...(playData?.sources ?? [])];
    for (const s of animePlay.data?.sources ?? []) if (!list.some((x) => x.id === s.id)) list.push(s);
    return rankSources(list, order, { tv });
  }, [playData, animePlay.data, order, tv]);
  const rankingFor = ranking;
  // an explicit preference is honoured as before (the ad-shield rules still apply, D-94); Automatic picks the first ranked source
  const [sourceId, setSourceId] = useState<SourceId | null>(() => { const p = getPrefs().preferredSource; return p === "auto" ? null : p; });
  const tried = useRef(new Set<SourceId>());
  // a compatibility source is never the first pick on a TV browser (ad shield §C.5)
  const source: PlaybackSource | undefined = sources.find((x) => x.id === sourceId && !(lastResortOnly(x.id, tv, x.tier) && !tried.current.size && sources.length > 1)) ?? sources[0];
  const [nativeControls, setNativeControls] = useState(false);
  // The TV PLAYER blueprint chrome is drawn over every source that can hide its own controls, on TV
  // and touch alike: the iframe then never receives a click or tap (§6, §20, ad shield layer 1).
  const customChrome = Boolean(source && ADAPTERS[source.id]?.hideControls) && !nativeControls;
  // v1.2.1: Panda's own subtitles over sources that report their position (not with the provider's controls on)
  const captionsOk = Boolean(source && ADAPTERS[source.id]?.captions) && !nativeControls;
  // v1.2.4: VidLink takes Panda's preferred subtitle file (sub_file) and draws it in its own player
  const handsSubs = source?.id === "vidlink" && !nativeControls && prefs.subtitleMode !== "off";
  const profileId = useStore((st) => st.activeProfileId);
  const caps = useCaptions({ imdbId: details?.imdbId, season: isTv ? ep.s : undefined, episode: isTv ? ep.e : undefined, enabled: captionsOk || handsSubs, prefs, original: details?.language ?? null, titleKey: details?.id, profileId: profileId ?? undefined });
  const [handedSub, setHandedSub] = useState<{ url: string; label: string } | null>(null);
  const [subsSheet, setSubsSheet] = useState(false);
  const [ready, setReady] = useState(false);
  // keeps the first-frames screen mounted for its 100 % fade-out (v1.2.6)
  const [loadingFade, setLoadingFade] = useState(false);
  useEffect(() => { if (!ready) { setLoadingFade(true); return; } const id = setTimeout(() => setLoadingFade(false), 500); return () => clearTimeout(id); }, [ready]);
  const [paused, setPaused] = useState(false);
  const [overlay, setOverlay] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [reportSheet, setReportSheet] = useState(false);
  const [upNext, setUpNext] = useState<{ s: number; e: number } | null>(null);
  const [countdown, setCountdown] = useState(10);
  const [time, setTime] = useState({ p: start, d: 0 });
  const [muted, setMuted] = useState(false);
  const [keysHelp, setKeysHelp] = useState(false);
  /* ---- v1.2.2 gestures and picture-in-picture ---- */
  const [brightness, setBrightness] = useState(1);
  // v1.2.6 picture fit (Fit / Fill / Stretch), remembered on this device
  const [fit, setFitMode] = useState<FitMode>(getFit);
  const [view, setView] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => { const on = () => setView({ w: window.innerWidth, h: window.innerHeight }); window.addEventListener("resize", on); return () => window.removeEventListener("resize", on); }, []);
  const [dragVolume, setDragVolume] = useState<number | null>(null);
  const volSave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pip, setPip] = useState(false);
  const pipOk = useMemo(() => nativePipSupported(), []);
  // position to reopen at when the embed reloads (source / quality / controls change)
  const [reloadAt, setReloadAt] = useState<number | null>(null);
  // hand the subtitle over once, before the source starts, so the embed never reloads mid-play
  useEffect(() => {
    if (!handsSubs || ready || handedSub || !caps.track) return;
    setHandedSub({ url: new URL(caps.track.file, API_BASE).toString(), label: subLangName(caps.track.language) });
  }, [handsSubs, ready, handedSub, caps.track]);
  useEffect(() => { setHandedSub(null); }, [source?.id, ep.s, ep.e]);
  const frame = useRef<HTMLIFrameElement>(null);
  /* ---- v1.2.4 player states: buffering, stall recovery, resume prompt, TTFF ---- */
  const ticks = useRef(new TickWatch());
  const firstFrame = useRef(false);
  const [buffering, setBuffering] = useState(false);
  const [stall, setStall] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);
  const [resumeAsk, setResumeAsk] = useState(start > 30);
  const pos = useRef({ position: start, duration: 0, dirty: false });
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const loadedAt = useRef(0);
  /* ---- Player 2.0 (v1.1.5) ---- */
  const [sleep, setSleep] = useState<SleepTimer>(SLEEP_OFF);
  const [stillWatching, setStillWatching] = useState<number | null>(null);
  // v1.2.2: why "Still watching?" is up — the sleep timer, or a run of episodes that started by themselves
  const [stillWhy, setStillWhy] = useState<{ kind: "sleep" } | { kind: "episodes"; count: number; next: { s: number; e: number } | null }>({ kind: "sleep" });
  const [intro, setIntro] = useState<Intro | null>(() => (type === "tv" ? getIntro(id) : null));
  const [introSkipped, setIntroSkipped] = useState(false);
  const [nextDismissed, setNextDismissed] = useState(false);
  const [optionsSheet, setOptionsSheet] = useState<null | "menu" | "speed" | "sleep">(null);
  const [, setTick] = useState(0);
  const lastTime = useRef<number | null>(null);
  // published intro / recap / credits markers for this episode (IntroDB through the Panda API)
  const segments = useSWR<SkipSegments>(details?.imdbId ? keys.segments(details.imdbId, isTv ? ep.s : undefined, isTv ? ep.e : undefined) : null, { revalidateOnFocus: false, shouldRetryOnError: false }).data;

  const next = details && isTv ? nextEpisodeOf(details.seasons, ep.s, ep.e) : null;
  const prev = details && isTv ? prevEpisodeOf(details.seasons, ep.s, ep.e) : null;
  const epInfo = seasonData?.number === ep.s ? seasonData.episodes.find((x) => x.number === ep.e) : undefined;

  /* ---- progress persistence (every 5 s, and on exit) ---- */
  const save = useCallback(() => {
    const d = getDetails();
    if (!d || !pos.current.dirty || pos.current.duration <= 0) return;
    actions.saveProgress(d, { position: pos.current.position, duration: pos.current.duration, season: isTv ? ep.s : undefined, episode: isTv ? ep.e : undefined, episodeTitle: epInfo?.title ?? null, next: isTv ? playableNext(d, ep.s, ep.e) : null, upcoming: isTv ? upcomingNext(d, ep.s, ep.e) : null });
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

  /* ---- ad shield (docs/AD_SHIELD.md) ---- */
  const reclaimFocus = useCallback(() => {
    // the embed must never keep keyboard / remote focus: hand it back to Panda's own controls
    if (document.activeElement === frame.current) {
      const target = document.getElementById("tvp-track") ?? document.getElementById("pl-back") ?? root.current;
      (target as HTMLElement | null)?.focus({ preventScroll: true });
    }
  }, []);
  useEffect(() => {
    const onBlur = () => setTimeout(() => { if (customChrome) reclaimFocus(); }, 0);
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [customChrome, reclaimFocus]);
  useEffect(() => {
    if (!source) return;
    setShieldSource(source.id);
    if (COMPAT[source.id]) toast(nativeShield ? `${SHORT[source.id]} uses its own controls. Panda blocks its popups and redirects` : `${SHORT[source.id]} uses its own controls. Popups are blocked where your browser allows it`, 4200);
    // compatibility sources run unsandboxed on the web: ask before anything navigates the app away
    if (!COMPAT[source.id] || nativeShield) return;
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [source?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // pin the first pick so a source added later (Vidy Anime) never replaces the one that is loading
  useEffect(() => { if (source && !sourceId) setSourceId(source.id); }, [source?.id, sourceId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ready && source) recordPlay(source.id); }, [ready, source?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  /* ---- community ranking signal (v1.2.0): one "ok" per source per play once real playback starts ---- */
  const okSent = useRef(new Set<SourceId>());
  const reportOk = () => {
    const s = source?.id;
    if (!s || okSent.current.has(s)) return;
    okSent.current.add(s);
    void api.report({ type, tmdbId: id, season: isTv ? ep.s : undefined, episode: isTv ? ep.e : undefined, source: s, issue: "ok", position: Math.floor(pos.current.position) }).catch(() => undefined);
  };
  useEffect(() => () => {
    // drain what the Android shield stopped; a noisy session becomes an automatic ranking signal
    const before = shieldStats();
    syncNative();
    const after = shieldStats();
    const blocked = after.popups + after.navigations - before.popups - before.navigations;
    setShieldSource(null);
    const s = sourceRef.current;
    const e = epRef.current;
    if (s && blocked >= 3) void api.report({ type, tmdbId: id, season: isTv ? e.s : undefined, episode: isTv ? e.e : undefined, source: s, issue: "popups", position: Math.floor(pos.current.position) }).catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const sourceRef = useRef<SourceId | null>(null);
  sourceRef.current = source?.id ?? null;
  const epRef = useRef(ep);
  epRef.current = ep;

  /* ---- source readiness + automatic fallback (spec 16.4) ---- */
  const fallback = useCallback((reason: string) => {
    if (!source) return;
    tried.current.add(source.id);
    // a source that never started is a "noplay" signal for the community ranking
    void api.report({ type, tmdbId: id, season: isTv ? epRef.current.s : undefined, episode: isTv ? epRef.current.e : undefined, source: source.id, issue: "noplay", position: 0 }).catch(() => undefined);
    const nextSrc = sources.find((x) => !tried.current.has(x.id));
    if (nextSrc) {
      toast(`Switched to ${SHORT[nextSrc.id]}`);
      setReloadAt(pos.current.position);
      setReady(false);
      setSourceId(nextSrc.id);
    } else {
      toast(reason);
    }
  }, [source, sources, type, id, isTv]);

  useEffect(() => {
    if (!source || ready) return;
    loadedAt.current = Date.now();
    ticks.current.reset(); firstFrame.current = false; setBuffering(false); setStall(null);
    const timer = setTimeout(() => fallback("No source could start playback. Try again later."), READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [source, ready, fallback]);

  // buffering shows only after the source's own update rhythm stops (≥ 400 ms); 12 s of stall opens recovery
  useEffect(() => {
    if (!ready || paused || !source || pip) { setBuffering(false); return; }
    const t = setInterval(() => {
      const s = ticks.current.stalledFor(performance.now());
      setBuffering(s > 0);
      if (s > 12_000) setStall((x) => x ?? 10);
    }, 250);
    return () => clearInterval(t);
  }, [ready, paused, source?.id, pip]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (stall === null) return;
    if (stall <= 0) { setStall(null); stallSwitch(); return; }
    const t = setTimeout(() => setStall((x) => (x === null ? null : x - 1)), 1000);
    return () => clearTimeout(t);
  }, [stall]); // eslint-disable-line react-hooks/exhaustive-deps
  // the recovery card and the resume prompt take the remote's focus when they appear
  const stallOpen = stall !== null;
  useEffect(() => { if (stallOpen) requestAnimationFrame(() => focusFirst(document.getElementById("pl-stall"))); }, [stallOpen]);
  const resumeOpen = resumeAsk && ready;
  useEffect(() => { if (resumeOpen && tv) requestAnimationFrame(() => focusFirst(document.getElementById("pl-resume"))); }, [resumeOpen, tv]);
  // the resume prompt stays up for 8 s after playback starts, then playback simply continues
  useEffect(() => {
    if (!resumeAsk || !ready) return;
    const t = setTimeout(() => setResumeAsk(false), 8000);
    return () => clearTimeout(t);
  }, [resumeAsk, ready]);

  /* ---- player messages ---- */
  const primed = useRef(false);
  const frameKey = source ? `${source.id}-${customChrome ? "c" : "n"}-${prefs.quality}-${nonce}` : "";
  useEffect(() => { primed.current = false; }, [frameKey]);
  useEffect(() => {
    if (!source) return;
    const onMsg = (m: MessageEvent) => {
      if (m.source !== frame.current?.contentWindow) return;
      const ev = parseMessage(source, m.origin, m.data);
      if (!ev) return;
      // v1.2.6: apply the saved volume, mute memory and speed on the first message from each embed load. CineSrc can post
      // "ready" before this listener exists (fast loads), so waiting for "ready" alone silently skipped them.
      if (!primed.current && source.events === "cinesrc") {
        primed.current = true;
        sendCommand(frame.current, source, { c: "volume", value: getPrefs().volume });
        if (getMutedMemory()) { sendCommand(frame.current, source, { c: "muted", value: true }); setMuted(true); }
        if (getPrefs().playbackSpeed !== 1) sendCommand(frame.current, source, { c: "rate", value: getPrefs().playbackSpeed });
      }
      switch (ev.kind) {
        case "ready":
          setReady(true);
          lastTime.current = null;
          break;
        case "skipintro": setIntroSkipped(true); lastTime.current = ev.to; toast("Intro skipped", 1600); break;
        case "rate": break;
        case "play": setReady(true); setPaused(false); reportOk(); caps.clock.current = { ...caps.clock.current, at: performance.now(), playing: true }; break;
        case "pause": setPaused(true); caps.clock.current = { ...caps.clock.current, position: clockAt(caps.clock.current, performance.now()), at: performance.now(), playing: false }; break;
        case "volume": setMuted(ev.muted); break;
        case "time":
          setReady(true); setPaused(false);
          ticks.current.tick(performance.now());
          if (buffering) setBuffering(false);
          if (stall !== null) setStall(null);
          if (!firstFrame.current && ev.position > 0 && loadedAt.current) { firstFrame.current = true; recordTtff(source.id, Date.now() - loadedAt.current); }
          caps.clock.current = { position: ev.position, at: performance.now(), playing: true, rate: getPrefs().playbackSpeed };
          if (ev.position > 1) reportOk();
          if (ev.duration > 0) {
            if (isTv && lastTime.current !== null) noteJump(lastTime.current, ev.position);
            lastTime.current = ev.position;
            pos.current = { position: ev.position, duration: ev.duration, dirty: true };
            setTime((t) => (Math.abs(t.p - ev.position) >= 0.25 || t.d !== ev.duration ? { p: ev.position, d: ev.duration } : t));
            if (isTv && next && ev.duration - ev.position < 1.5 && !upNext) setUpNext({ s: next.season, e: next.episode });
          }
          break;
        case "ended":
          pos.current = { ...pos.current, position: pos.current.duration || pos.current.position, dirty: true };
          save();
          if (sleep.mode === "end") { endForTheNight(); break; }
          if (isTv && next) setUpNext({ s: next.season, e: next.episode });
          break;
        case "episode":
          if (ev.internal && shouldAskStill(prefs.stillAfter) && controllable) {
            // the source moved on by itself: hold the new episode until someone answers
            sendCommand(frame.current, source, { c: "pause" }); setPaused(true);
            setStillWhy({ kind: "episodes", count: binge.count + 1, next: null }); setStillWatching(SLEEP_GRACE_S);
          }
          if (ev.internal) binge.markAuto();
          if (ev.internal) { save(); setEp({ s: ev.season, e: ev.episode }); setIntroSkipped(false); setNextDismissed(false); lastTime.current = null; pos.current = { position: 0, duration: 0, dirty: false }; }
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
  useEffect(() => {
    if (!(upNext && prefs.autoplayNext && countdown <= 0)) return;
    // v1.2.2: after N episodes in a row with nobody touching the remote, ask before starting another
    if (shouldAskStill(prefs.stillAfter)) { setStillWhy({ kind: "episodes", count: binge.count + 1, next: upNext }); setUpNext(null); setStillWatching(SLEEP_GRACE_S); return; }
    binge.markAuto();
    playEpisode(upNext.s, upNext.e);
  }, [upNext, countdown, prefs.autoplayNext, prefs.stillAfter]); // eslint-disable-line react-hooks/exhaustive-deps
  // episodes in a row: counted when an episode starts by itself, reset by any key, click or touch
  useEffect(() => { binge.onEpisode(); }, [id, ep.s, ep.e]);
  useEffect(() => {
    const reset = () => binge.reset();
    window.addEventListener("keydown", reset, true);
    window.addEventListener("pointerdown", reset, true);
    return () => { window.removeEventListener("keydown", reset, true); window.removeEventListener("pointerdown", reset, true); };
  }, []);  

  /* ---- Player 2.0 helpers ---- */
  const controllable = Boolean(source && ADAPTERS[source.id]?.commands);
  // the Android app opens picture-in-picture when you leave during playback (Settings › Playback)
  useEffect(() => {
    if (!pipOk) return;
    nativePlaybackActive(ready && !paused, prefs.autoPip);
  }, [pipOk, ready, paused, prefs.autoPip]);
  useEffect(() => {
    if (!pipOk) return;
    window.__pandaPip = (on: boolean) => { setPip(on); if (on) { setOverlay(false); setOptionsSheet(null); setSubsSheet(false); } };
    return () => { nativePlaybackActive(false, false); delete window.__pandaPip; };
  }, [pipOk]);
  function noteJump(from: number, to: number) {
    const learned = learnIntro(id, from, to);
    if (learned) setIntro(learned);
  }
  function endForTheNight() {
    setStillWatching(null);
    setSleep(SLEEP_OFF);
    if (source && controllable) sendCommand(frame.current, source, { c: "pause" });
    toast(stillWhy.kind === "episodes" ? `Paused after ${stillWhy.count} episodes in a row` : "Sleep timer ended playback", 3200);
    binge.reset();
    exit();
  }
  function keepWatching() {
    setStillWatching(null);
    binge.reset();
    if (stillWhy.kind === "episodes" && stillWhy.next) { playEpisode(stillWhy.next.s, stillWhy.next.e); return; }
    if (source) sendCommand(frame.current, source, { c: "play" });
    setPaused(false);
  }
  // sleep timer: tick once a second while armed; on time, pause and ask "Still watching?" (or stop when the source can't pause)
  useEffect(() => {
    if (sleep.at === null) return;
    const i = setInterval(() => {
      setTick((n) => n + 1);
      if (sleepDue(sleep)) {
        setSleep({ mode: "off", at: null });
        if (source && controllable) { sendCommand(frame.current, source, { c: "pause" }); setPaused(true); setStillWhy({ kind: "sleep" }); setStillWatching(SLEEP_GRACE_S); }
        else endForTheNight();
      }
    }, 1000);
    return () => clearInterval(i);
  }); // re-armed every render so it sees the current source
  useEffect(() => {
    if (stillWatching === null) return;
    if (stillWatching <= 0) { endForTheNight(); return; }
    const t = setTimeout(() => setStillWatching((n) => (n === null ? null : n - 1)), 1000);
    return () => clearTimeout(t);
  }); 
  const chooseSleep = (mode: SleepMode) => {
    const t = startSleep(mode);
    setSleep(t);
    toast(mode === "off" ? "Sleep timer off" : mode === "end" ? `Playback stops at the end of this ${isTv ? "episode" : "movie"}` : `Sleep timer: ${mode} minutes`, 2200);
  };
  const chooseSpeed = (r: number) => {
    actions.setPrefs({ playbackSpeed: r });
    if (source) sendCommand(frame.current, source, { c: "rate", value: r });
    toast(`Speed: ${speedLabel(r)}`, 1400);
  };
  const skip = controllable && ready ? activeSkip(time.p, { recap: segments?.recap, intro: segments?.intro, learned: isTv ? intro : null }) : null;
  const skipIntro = () => {
    if (!skip) return;
    if (skip.kind === "intro") setIntroSkipped(true);
    lastTime.current = skip.end;
    seekTo(skip.end);
  };
  const showSkip = Boolean(skip && !(skip.kind === "intro" && introSkipped));
  const showNextCard = isTv && !upNext && !nextDismissed && stillWatching === null && Boolean(next) && nextCardDue(time.p, time.d, Boolean(next), segments?.credits?.start);
  const nextEp = next && seasonData?.number === next.season ? seasonData.episodes.find((x) => x.number === next.episode) : undefined;

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
    if (optionsSheet) { setOptionsSheet(null); return; }
    if (upNext) { setUpNext(null); return; }
    exit();
  }, !customChrome);

  const nextSource = () => sources.find((x) => x.id !== source?.id && !tried.current.has(x.id)) ?? sources.find((x) => x.id !== source?.id);
  /** Stall recovery: reload the same source where it stopped. */
  const retryStall = () => {
    setStall(null); setBuffering(false); ticks.current.reset();
    setReloadAt(pos.current.position); setReady(false); setNonce((n) => n + 1);
  };
  function stallSwitch() {
    const n = nextSource();
    if (!source) return;
    void api.report({ type, tmdbId: id, season: isTv ? ep.s : undefined, episode: isTv ? ep.e : undefined, source: source.id, issue: "noplay", position: Math.floor(pos.current.position) }).catch(() => undefined);
    if (n) switchSource(n.id); else retryStall();
  }
  const startOver = () => {
    setResumeAsk(false);
    pos.current = { ...pos.current, position: 0, dirty: true };
    if (source && ADAPTERS[source.id]?.commands && ready) { sendCommand(frame.current, source, { c: "seek", to: 0 }); return; }
    setReloadAt(0); setReady(false); setNonce((n) => n + 1);
  };

  const switchSource = (sid: SourceId) => {
    if (sid === source?.id) return;
    save();
    tried.current.clear();
    setReloadAt(pos.current.position);
    setReady(false);
    setSourceId(sid);
    // a fixed preference follows the last pick; "Automatic" stays automatic (this play only)
    if (getPrefs().preferredSource !== "auto") actions.setPrefs({ preferredSource: sid });
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
    caps.clock.current = { ...caps.clock.current, position: clockAt(caps.clock.current, performance.now()), at: performance.now(), playing: paused };
    setPaused((p) => !p);
  };
  const seekTo = (to: number) => {
    if (!source) return;
    const t = Math.max(0, to);
    if (isTv && lastTime.current !== null && t > lastTime.current) noteJump(lastTime.current, t);
    lastTime.current = t;
    sendCommand(frame.current, source, { c: "seek", to: t });
    caps.clock.current = { ...caps.clock.current, position: t, at: performance.now() };
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

  /* ---- v1.2.6: the remote's Menu key opens the quick panel (Quality, source, speed, picture) wherever focus is ---- */
  // A request flag, not a DOM click: the chrome is a lazy chunk and may still be loading when the key arrives.
  const [menuReq, setMenuReq] = useState(false);
  useEffect(() => {
    const onMenu = (e: KeyboardEvent) => {
      if (e.key !== "ContextMenu") return;
      e.preventDefault(); poke(); setMenuReq(true);
    };
    // capture phase: focus scopes and sliders below may consume the event before it bubbles up
    window.addEventListener("keydown", onMenu, true);
    return () => window.removeEventListener("keydown", onMenu, true);
  }, [poke]);

  /* ---- v1.2.7: the remote's CC / Subtitle key (and C on a keyboard) switches Panda subtitles in one press, wherever focus is ---- */
  const ccToggle = useRef<(() => void) | null>(null);
  ccToggle.current = captionsOk && details?.imdbId ? toggleSubtitles : null;
  useEffect(() => {
    const onCc = (e: KeyboardEvent) => {
      if (e.repeat || !ccToggle.current || !isCcKey(e)) return;
      e.preventDefault(); e.stopPropagation(); poke(); ccToggle.current();
    };
    window.addEventListener("keydown", onCc, true);
    return () => window.removeEventListener("keydown", onCc, true);
  }, [poke]);

  /* ---- v1.2.8: keyboard shortcuts (Space/K, J, L, M, F, ?) for desktop and laptop keyboards ---- */
  const keysOpen = useRef(false);
  keysOpen.current = keysHelp;
  const shortcut = useRef<(a: NonNullable<ReturnType<typeof playerShortcut>>) => void>(() => {});
  shortcut.current = (a) => {
    if (a === "help") { setKeysHelp((v) => !v); return; }
    if (a === "fullscreen") { void toggleFullscreen(); return; }
    if (a === "toggle") { togglePlay(); return; }
    if (a === "back10") { seekBy(-10); toast("Back 10 s", 900); return; }
    if (a === "fwd10") { seekBy(10); toast("Forward 10 s", 900); return; }
    if (a === "mute") {
      const m = !muted;
      if (source) sendCommand(frame.current, source, { c: "muted", value: m });
      setMuted(m); saveMutedMemory(m); toast(m ? "Sound off" : "Sound on", 1000);
    }
  };
  useEffect(() => {
    const onShortcut = (e: KeyboardEvent) => {
      // the shortcuts sheet sits above the TV chrome: Back (and ?) close it before the chrome sees the key
      if (keysOpen.current && navKey(e) === "back") { e.preventDefault(); e.stopPropagation(); setKeysHelp(false); return; }
      if (e.repeat && e.key !== "j" && e.key !== "l") return;
      const a = playerShortcut(e);
      if (!a) return;
      e.preventDefault(); e.stopPropagation(); poke(); shortcut.current(a);
    };
    window.addEventListener("keydown", onShortcut, true);
    return () => window.removeEventListener("keydown", onShortcut, true);
  }, [poke]);

  /* ---- remote keys while the overlay is hidden ---- */
  const onKeyDown = (k: React.KeyboardEvent) => {
    // v1.2.6: the remote's Menu key opens the quick panel (Quality, source, speed, picture)
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

  /** Report an Issue (§20.9, phone and TV): counted by the community ranking, then the fix the issue calls for. */
  function report(issue: (typeof ISSUES)[number]) {
    void api.report({ type, tmdbId: id, season: isTv ? ep.s : undefined, episode: isTv ? ep.e : undefined, source: source?.id ?? null, issue: issue.id, position: Math.round(pos.current.position) }).catch(() => undefined);
    const other = sources.find((x) => x.id !== source?.id && !tried.current.has(x.id)) ?? sources.find((x) => x.id !== source?.id);
    if (issue.switchSource && other) { switchSource(other.id); toast(`Thanks for the report. Trying ${SHORT[other.id]}`); }
    else if (issue.id === "subs" && captionsOk && details?.imdbId && !customChrome) { setSubsSheet(true); toast("Thanks for the report. Pick another subtitle track"); }
    else if (issue.id === "subs" && captionsOk && details?.imdbId) toast("Thanks for the report. Pick another track in Audio & Subtitles");
    else if (issue.id === "subs" && customChrome) { reloadEmbed(); setNativeControls(true); toast("Thanks for the report. Pick subtitles in the source player"); }
    else if (issue.id === "subs") toast("Thanks for the report. Pick subtitles in the source player");
    else toast("Thanks for the report");
  }

  function chooseSubtitle(t: Parameters<typeof caps.choose>[0]) {
    caps.choose(t);
    toast(t === "off" ? "Subtitles off" : `Subtitles: ${t.label}`, 1600);
  }
  function toggleSubtitles() {
    const t = caps.toggle();
    toast(t ? `Subtitles: ${t.label}` : caps.track ? "Subtitles off" : caps.loading ? "Looking for subtitles…" : "No subtitles found for this title", 1600);
  }
  function nudgeSubtitle(by: number) {
    caps.nudge(by);
    toast(offsetLabel(Math.max(-30, Math.min(30, Math.round((caps.offset + by) * 10) / 10))), 1200);
  }

  function chromeProps(): TvChromeProps {
    return {
      d: details, isSeries: isTv, ep, episodeTitle: epInfo?.title,
      menuRequest: menuReq, onMenuHandled: () => setMenuReq(false),
      visible: overlay, poke, hide: () => { if (hideTimer.current) clearTimeout(hideTimer.current); setOverlay(false); },
      paused, ready, position: time.p, duration: time.d,
      controllable,
      speed: prefs.playbackSpeed, onSpeed: chooseSpeed,
      sleepMode: sleep.mode, sleepLabel: sleepPillLabel(sleep, isTv), onSleep: chooseSleep,
      onSeek: seekTo, onTogglePlay: togglePlay,
      quality: prefs.quality,
      onQuality: (q) => { if (q === prefs.quality) return; reloadEmbed(); actions.setPrefs({ quality: q }); toast(q === "auto" ? "Quality: Auto" : `Quality: ${q === "480" ? "Data Saver" : q === "2160" ? "4K" : `${q}p`}`); },
      sources, sourceId: source?.id, onSource: switchSource, ranking: rankingFor,
      onReport: report,
      nativeControls, onNativeControls: (on) => {
        if (on === nativeControls) return;
        reloadEmbed(); setNativeControls(on);
        if (on) setTimeout(() => frame.current?.focus(), 1200);
      },
      muted, onMuted: (m) => { if (source) sendCommand(frame.current, source, { c: "muted", value: m }); setMuted(m); saveMutedMemory(m); },
      upNext, countdown: upNext && prefs.autoplayNext ? countdown : null, onCancelUpNext: () => setUpNext(null),
      onPlayEpisode: playEpisode,
      onPlayTitle: (item) => { save(); go(watchPath(item.type, item.tmdbId), { replace: true }); },
      onExit: exit,
      hideSpoilers: prefs.hideSpoilers,
      captions: {
        available: captionsOk && Boolean(details?.imdbId), tracks: caps.tracks, trackId: caps.track?.id ?? null, loading: caps.loading, failed: caps.failed, error: caps.error,
        offset: caps.offset, langs: [prefs.subtitleLang, prefs.subtitleLang2].filter((x): x is string => Boolean(x)),
        onTrack: chooseSubtitle, onNudge: nudgeSubtitle,
        options: { caps, prefs, onPrefs: actions.setPrefs, toast: (m) => toast(m, 1400) }
      },
      gestures: !tv && prefs.gestures,
      volume: dragVolume ?? prefs.volume, onVolume: (v) => {
        if (!source) return;
        sendCommand(frame.current, source, { c: "volume", value: v }); setDragVolume(v);
        // saved once the finger settles, not on every move
        if (volSave.current) clearTimeout(volSave.current);
        volSave.current = setTimeout(() => { actions.setPrefs({ volume: v }); setDragVolume(null); }, 450);
        if (muted !== (v <= 0)) { sendCommand(frame.current, source, { c: "muted", value: v <= 0 }); setMuted(v <= 0); saveMutedMemory(v <= 0); }
      },
      brightness, onBrightness: setBrightness,
      onHold: (on) => { if (source) sendCommand(frame.current, source, { c: "rate", value: on ? 2 : prefs.playbackSpeed }); },
      fit, onFit: (m) => { setFitMode(m); saveFit(m); toast(`Picture: ${m === "fit" ? "Fit" : m === "fill" ? "Fill" : "Stretch"}`); },
      markers: seekMarkers({ recap: segments?.recap, intro: segments?.intro, credits: segments?.credits, learned: isTv ? intro : null }, time.d),
      onPip: pipOk ? () => { if (!nativeEnterPip()) toast("Picture-in-picture is turned off for Panda in Android settings", 3200); } : undefined
    };
  }

  const title = details?.title ?? "";
  const isolated = Boolean(source) && customChrome && !COMPAT[source!.id];
  const subtitle = isTv ? episodeLine(ep.s, ep.e, epInfo?.title) : [details?.year, runtime(details?.runtime)].filter(Boolean).join(" · ");
  // portrait phones already get a 16:9 frame (player.css), so only landscape screens scale
  const scale = controllable && customChrome && (tv || view.w > view.h) ? fitScale(fit, view.w, view.h) : { x: 1, y: 1 };
  const src = source ? embedUrl(source, { customChrome, start: reloadAt ?? undefined, quality: prefs.quality, autoskip: prefs.autoSkipIntro, subtitle: handsSubs ? handedSub : null }) : null;

  return (
    <div ref={root} className={`player ${overlay ? "is-overlay" : ""} ${tv ? "player--tv" : "player--touch"} ${pip ? "is-pip" : ""}`} onKeyDown={onKeyDown} onMouseMove={poke} role="application" aria-label={`Playing ${title}`}>
      {play.error && !play.data && <div className="player-center"><ErrorState message={play.error.message} onRetry={() => play.mutate()} /></div>}
      {src && source && (
        <iframe key={frameKey} ref={frame} className={`player-frame ${isolated ? "is-isolated" : ""}`} src={src} style={scale.x !== 1 || scale.y !== 1 ? { transform: `scale(${scale.x.toFixed(4)}, ${scale.y.toFixed(4)})` } : undefined} title={`${title} — ${SHORT[source.id]}`}
          {...(SANDBOX[source.id]?.attr ? { sandbox: SANDBOX[source.id]!.attr! } : {})} data-sandbox={SANDBOX[source.id]?.id ?? "none"}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="origin" tabIndex={isolated || (tv && !nativeControls) ? -1 : 0}
          onLoad={() => { if (source.events !== "cinesrc") setReady(true); if (isolated) reclaimFocus(); }} />
      )}
      {brightness < 1 && !tv && (
        <div className="player-dim" style={{ opacity: Math.round((1 - brightness) * 0.85 * 100) / 100 }} aria-hidden="true" />
      )}
      {ready && captionsOk && caps.track && caps.cues && (
        <CaptionLayer cues={caps.cues} second={caps.dual ? caps.dualCues : null} clock={caps.clock} offset={caps.offset} raised={overlay || Boolean(upNext)} look={subLook(prefs)} />
      )}
      {ready && buffering && stall === null && !paused && (
        <div className="player-buffering" id="pl-buffering" role="status" aria-label="Buffering"><div className="spinner" /></div>
      )}
      {stall !== null && source && (
        <div className="player-stall" id="pl-stall" role="alertdialog" aria-labelledby="pl-stall-title">
          <p id="pl-stall-title" className="player-stall-title">{SHORT[source.id]} stopped playing</p>
          <p className="player-stall-sub" aria-live="polite">{nextSource() ? `Switching to ${SHORT[nextSource()!.id]} in ${stall} s` : `Trying again in ${stall} s`}</p>
          <div className="player-stall-actions lrud-container">
            <button id="pl-stall-retry" className="btn btn--primary" data-autofocus data-hover-focus onClick={retryStall}><Icon name="refresh" /> Retry</button>
            {nextSource() && <button id="pl-stall-switch" className="btn" data-hover-focus onClick={() => { setStall(null); switchSource(nextSource()!.id); }}>Switch source</button>}
            <button id="pl-stall-report" className="btn" data-hover-focus onClick={() => { setStall(null); setReportSheet(true); }}>Report</button>
          </div>
        </div>
      )}
      {resumeAsk && ready && start > 30 && stall === null && (
        <div className="player-resume" id="pl-resume" role="dialog" aria-label="Resume">
          <button id="pl-resume-go" className="btn btn--primary" data-autofocus data-hover-focus onClick={() => setResumeAsk(false)}><Icon name="play" /> Resume from {playClock(start)}</button>
          <button id="pl-resume-over" className="btn" data-hover-focus onClick={startOver}><Icon name="replay10" /> Start over</button>
        </div>
      )}
      {!play.error && (!ready || loadingFade) && (
        <PlayerLoading backdrop={details?.backdropLarge} title={title} line={isTv ? episodeLine(ep.s, ep.e, epInfo?.title) : null} sourceId={source?.id ?? null} ready={ready} touch={!tv} onBack={exit} />
      )}
      <div className="player-hotzone" onMouseEnter={poke} aria-hidden="true" />
      {customChrome ? <Suspense fallback={null}><TvPlayerChrome {...chromeProps()} touch={!tv} /></Suspense> : <>
      <div className="player-top lrud-container">
        <button id="pl-back" className="pl-btn" onClick={exit} aria-label="Back" data-hover-focus><Icon name="back" /></button>
        <div className="pl-title"><strong>{title}</strong><span>{subtitle}</span></div>
        <div className="pl-sources" role="radiogroup" aria-label="Video source">
          {sources.map((x) => (
            <button key={x.id} id={`pl-src-${x.id}`} role="radio" aria-checked={x.id === source?.id} className={`pl-pill ${x.id === source?.id ? "is-active" : ""}`} onClick={() => switchSource(x.id)} data-hover-focus
              title={[tierLabel(x.id, rankOf(ranking, x.id)).label, reliabilityLabel(rankOf(ranking, x.id))].filter(Boolean).join(" · ")}>
              <span className={`src-rel-dot src-rel--${reliabilityTone(rankOf(ranking, x.id))}`} aria-hidden="true" />{SHORT[x.id]}
            </button>
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
        {captionsOk && details?.imdbId && <button id="pl-subs" className={`pl-chip ${caps.track ? "is-active" : ""}`} onClick={() => setSubsSheet(true)} data-hover-focus><Icon name="captions" /> {caps.track ? subLangName(caps.track.language) : "Subtitles"}</button>}
        <button id="pl-report" className="pl-chip" onClick={() => setReportSheet(true)} data-hover-focus><ExtraIcon name="warning" /> Report</button>
        <button id="pl-options" className={`pl-chip pl-chip--icon ${sleep.mode !== "off" ? "is-active" : ""}`} onClick={() => setOptionsSheet("menu")} aria-label="Speed and sleep timer" data-hover-focus>
          <Icon name="settings" />{sleep.mode !== "off" ? <span>{sleep.mode === "end" ? "End" : `${sleepLeft(sleep)}m`}</span> : prefs.playbackSpeed !== 1 && controllable ? <span>{prefs.playbackSpeed}×</span> : null}
        </button>
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
      <Suspense fallback={null}>
      <PlayerPrompts tv={tv} skip={showSkip} skipLabel={skip?.kind === "recap" ? "Skip Recap" : "Skip Intro"} onSkip={skipIntro}
        nextCard={showNextCard && next ? { s: next.season, e: next.episode, title: nextEp?.title ?? null, still: (prefs.hideSpoilers ? null : nextEp?.still) ?? details?.backdrop ?? null, left: Math.max(0, Math.ceil(time.d - time.p)) } : null}
        onPlayNext={() => next && playEpisode(next.season, next.episode)} onDismissNext={() => setNextDismissed(true)}
        stillWatching={stillWatching} stillNote={stillWhy.kind === "episodes" ? `You've watched ${stillWhy.count} episodes in a row.${stillWhy.next ? ` Next: S${stillWhy.next.s}\u00a0E${stillWhy.next.e}.` : ""}` : null}
        onKeepWatching={keepWatching} onStop={endForTheNight} />
      {optionsSheet && <PlayerOptionsSheet kind={optionsSheet} controllable={controllable} onKind={setOptionsSheet} speed={prefs.playbackSpeed} sleep={sleep.mode} isSeries={isTv} onSpeed={(r) => { chooseSpeed(r); setOptionsSheet(null); }} onSleep={(m) => { chooseSleep(m); setOptionsSheet(null); }} onClose={() => setOptionsSheet(null)} />}
      </Suspense>
      {reportSheet && (
        <Sheet title="Report an Issue" onClose={() => setReportSheet(false)} className="sheet--report">
          <p className="report-lead">Reports from every Panda viewer rank the sources, so the most reliable one plays first.{source ? ` Now playing from ${SHORT[source.id]}.` : ""}</p>
          <div className="report-list lrud-container" role="list">
            {ISSUES.map((i, n) => (
              <button key={i.id} id={`pl-issue-${i.id}`} className="report-row" role="listitem" data-autofocus={n === 0 ? true : undefined} data-hover-focus
                onClick={() => { setReportSheet(false); report(i); }}>
                <ExtraIcon name="warning" /><span>{i.label}</span>
                {i.switchSource && sources.length > 1 && <small>Tries another source</small>}
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {subsSheet && (
        <Sheet title="Subtitles" onClose={() => setSubsSheet(false)} className="sheet--report sheet--subs">
          <Suspense fallback={<Spinner />}>
            <SubtitleOptions caps={caps} prefs={prefs} onPrefs={actions.setPrefs} toast={(m) => toast(m, 1400)} tv={tv} onPicked={() => setSubsSheet(false)} />
          </Suspense>
        </Sheet>
      )}
      {keysHelp && (
        <Sheet title="Keyboard shortcuts" onClose={() => setKeysHelp(false)} className="sheet--keys">
          <dl className="keys-list">
            {SHORTCUTS.map((k) => (
              <div key={k.label} className="keys-row"><dt>{k.keys.map((x) => <kbd key={x}>{x}</kbd>)}</dt><dd>{k.label}</dd></div>
            ))}
          </dl>
        </Sheet>
      )}
      {drawer && details && <EpisodesDrawer d={details} current={ep} spoilers={prefs.hideSpoilers} onClose={() => setDrawer(false)} onPick={(sn, en) => { setDrawer(false); playEpisode(sn, en); }} />}
    </div>
  );
}

function EpisodesDrawer({ d, current, spoilers, onClose, onPick }: { d: TitleDetails; current: { s: number; e: number }; spoilers: boolean; onClose: () => void; onPick: (s: number, e: number) => void }) {
  const history = useHistoryEntry(d.id);
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
            <span className={`drawer-ep-still ${spoilers && !(x.season === current.s && x.number === current.e) && hideSpoiler(true, episodeRow(history, d.tmdbId, x.season, x.number).done, episodeRow(history, d.tmdbId, x.season, x.number).pct) ? "is-spoiler" : ""}`}><Img src={x.still} alt="" title={`E${x.number}`} /></span>
            <span><strong>{x.number}. {x.title}</strong><small>{[runtime(x.runtime)].filter(Boolean).join("")}</small></span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
