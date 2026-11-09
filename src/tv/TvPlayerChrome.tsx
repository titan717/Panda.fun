import "./tvplayer.css";
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { Icon } from "../components/Icon";
import { ExtraIcon } from "../components/ExtraIcons";
import { Img } from "../components/ui";
import { useBackHandler, useFocusScope, focusEl } from "../lib/focus";
import { navKey } from "../lib/keys";
import { useSeason } from "../lib/hooks";
import { languageName, runtime } from "../lib/format";
import { capabilityLabels, sourceName } from "../lib/player";
import { ISSUES, rankOf, reliabilityLabel, reliabilityTone, tierLabel } from "../lib/sources";
import type { Prefs } from "../lib/store";
import { BRIGHT_MIN, chapterAt, FIT_OPTIONS, type FitMode, episodeLine, MARKER_LABEL, type SeekMarker, classifyDrag, dragLevel, dragSeek, HOLD_MS, SLEEP_OPTIONS, SPEEDS, speedLabel, type DragKind, type SleepMode } from "../lib/player2";
import type { Episode, PandaItem, PlaybackSource, SourceId, SourceRankingPayload, SubtitleTrack, TitleDetails } from "../lib/types";
import { offsetLabel, subLangName } from "../lib/captions";

/** Panda subtitles in the Audio & Subtitles panel (v1.2.1). */
export interface CaptionControls {
  /** The source reports its position, so Panda can draw subtitles. */
  available: boolean;
  tracks: SubtitleTrack[];
  trackId: string | null;
  loading: boolean;
  failed: boolean;
  error: string | null;
  offset: number;
  langs: string[];
  onTrack: (t: SubtitleTrack | "off") => void;
  onNudge: (by: number) => void;
}

/** Quality choices of the TV PLAYER blueprint (§20.9). `cap` is the CineSrc `quality` hint. */
export const QUALITIES: { id: Prefs["quality"]; label: string; note?: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "2160", label: "4K", note: "Up to 2160p" },
  { id: "1080", label: "Full HD", note: "Up to 1080p" },
  { id: "720", label: "HD", note: "Up to 720p" },
  { id: "480", label: "Data Saver" }
];

export { ISSUES };

/** Capabilities and community reliability under a source name (v1.2.0). */
export function SourceMeta({ id, ranking }: { id: SourceId; ranking?: SourceRankingPayload }) {
  const r = rankOf(ranking, id);
  const rel = reliabilityLabel(r);
  return (
    <small className="src-meta">
      <span className={`src-tier src-tier--${tierLabel(id, r).tier}`}>{tierLabel(id, r).label}</span>
      {rel && <span className={`src-rel src-rel--${reliabilityTone(r)}`}><span className="src-rel-dot" aria-hidden="true" />{rel}</span>}
      <span className="src-caps">{capabilityLabels(id).join(" · ")}</span>
    </small>
  );
}

/** HH:MM:SS (blueprint shows the remaining time this way, §20.4). */
export function clock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/** Accumulating seek step while a direction is held or pressed in a burst (10 s → 20 s → 30 s → 60 s, MASTER V4 §5.1). */
export function seekStep(repeats: number) { return repeats < 4 ? 10 : repeats < 10 ? 20 : repeats < 18 ? 30 : 60; }

/** "+1:30" / "−0:20" for the seek bubble. */
export function seekDelta(sec: number) {
  const a = Math.round(Math.abs(sec)), h = Math.floor(a / 3600), m = Math.floor((a % 3600) / 60), s = a % 60;
  const body = h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  return `${sec < 0 ? "\u2212" : "+"}${body}`;
}

export type WatchNextCard =
  | { kind: "episode"; key: string; season: number; episode: number; title: string; image: string | null; sub: string }
  | { kind: "title"; key: string; item: PandaItem; title: string; image: string | null; sub: string };

export interface TvChromeProps {
  d: TitleDetails | undefined;
  isSeries: boolean;
  ep: { s: number; e: number };
  episodeTitle?: string | null;
  visible: boolean;
  /** the remote's Menu key was pressed: open the quick (Quality) panel, then call onMenuHandled */
  menuRequest?: boolean;
  onMenuHandled?: () => void;
  poke: () => void;
  hide: () => void;
  paused: boolean;
  ready: boolean;
  position: number;
  duration: number;
  controllable: boolean;
  /** Player 2.0 (v1.1.5): speed lives in the Quality sheet; the sleep timer is a bottom-row pill. */
  speed: number;
  onSpeed: (r: number) => void;
  sleepMode: SleepMode;
  sleepLabel: string;
  onSleep: (m: SleepMode) => void;
  onSeek: (to: number) => void;
  onTogglePlay: () => void;
  quality: Prefs["quality"];
  onQuality: (q: Prefs["quality"]) => void;
  sources: PlaybackSource[];
  /** Community ranking (v1.2.0) for the reliability note on each source row. */
  ranking?: SourceRankingPayload;
  sourceId: SourceId | undefined;
  onSource: (id: SourceId) => void;
  onReport: (issue: (typeof ISSUES)[number]) => void;
  nativeControls: boolean;
  onNativeControls: (on: boolean) => void;
  muted: boolean;
  onMuted: (m: boolean) => void;
  /** Auto-next: set when the episode ends; Watch Next opens with a countdown on the first card. */
  upNext: { s: number; e: number } | null;
  countdown: number | null;
  onCancelUpNext: () => void;
  onPlayEpisode: (s: number, e: number) => void;
  onPlayTitle: (item: PandaItem) => void;
  onExit: () => void;
  /** Phones and tablets: tap layer, back button and centre transport (v1.1.7 ad shield, D-91). */
  touch?: boolean;
  captions?: CaptionControls;
  /** v1.2.2: Watch Next shows the show's artwork instead of unwatched episode stills. */
  hideSpoilers?: boolean;
  /** v1.2.2 phone gestures (Settings › Playback › Swipe gestures). */
  gestures?: boolean;
  volume?: number;
  onVolume?: (v: number) => void;
  brightness?: number;
  onBrightness?: (b: number) => void;
  /** Hold for 2×: true while a finger rests on the video, false when it lifts. */
  onHold?: (on: boolean) => void;
  /** v1.2.2: set only where the Android app can open a picture-in-picture window. */
  onPip?: () => void;
  /** v1.2.6: recap / intro / credits spans drawn on the seek bar and named in the seek preview. */
  markers?: SeekMarker[];
  /** v1.2.6 picture fit; offered only where Panda draws the controls. */
  fit?: FitMode;
  onFit?: (m: FitMode) => void;
}

type Panel = null | "quality" | "audio" | "next" | "report" | "sleep";

export function TvPlayerChrome(p: TvChromeProps) {
  const [panel, setPanel] = useState<Panel>(null);
  const [pending, setPending] = useState<number | null>(null);
  const repeats = useRef(0);
  const lastPress = useRef(0);
  const seekFrom = useRef(0);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [intro, setIntro] = useState(true);
  const track = useRef<HTMLDivElement>(null);
  const { d, isSeries, ep } = p;

  // advisory + language chips for ~6 s once playback starts (§20.6, §20.7)
  useEffect(() => {
    if (!p.ready) return;
    const t = setTimeout(() => setIntro(false), 6500);
    return () => clearTimeout(t);
  }, [p.ready]);

  // auto-next opens Watch Next (§20.8)
  // ...and closes again when the countdown is taken away (cancelled, or "Still watching?" took over)
  const autoOpened = useRef(false);
  useEffect(() => {
    if (p.upNext) { autoOpened.current = true; setPanel("next"); }
    else if (autoOpened.current) { autoOpened.current = false; setPanel((x) => (x === "next" ? null : x)); }
  }, [p.upNext]);

  // focus the seek track whenever the chrome appears with nothing else focused
  useEffect(() => {
    if (p.visible && !panel && !p.touch) {
      const a = document.activeElement as HTMLElement | null;
      if (!a || a === document.body || !a.closest(".tvp")) focusEl(track.current);
    }
  }, [p.visible, panel, p.touch]);

  // Back: panel → chrome → exit (§20.12)
  useBackHandler(() => {
    if (panel === "next" && p.upNext) p.onCancelUpNext();
    if (panel) { setPanel(null); requestAnimationFrame(() => focusEl(track.current)); return; }
    if (pending !== null) { setPending(null); return; }
    if (p.visible) { p.hide(); return; }
    p.onExit();
  });

  // v1.2.6 lock (phones): hides every control so pocket or toddler taps do nothing; Back unlocks
  const [locked, setLocked] = useState(false);
  const [unlockShown, setUnlockShown] = useState(false);
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (unlockTimer.current) clearTimeout(unlockTimer.current); }, []);
  useBackHandler(() => { setLocked(false); p.poke(); }, locked);
  const { menuRequest } = p;
  const menuHandled = useRef(p.onMenuHandled);
  menuHandled.current = p.onMenuHandled;
  useEffect(() => {
    if (!menuRequest) return;
    menuHandled.current?.();
    // idempotent (open, never toggle): the effect can run again before the parent clears the request
    if (!locked) setPanel("quality");
  }, [menuRequest, locked]);
  const showUnlock = () => { setUnlockShown(true); if (unlockTimer.current) clearTimeout(unlockTimer.current); unlockTimer.current = setTimeout(() => setUnlockShown(false), 2600); };

  const commit = (to: number) => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = null;
    repeats.current = 0;
    setPending(null);
    p.onSeek(to);
  };
  useEffect(() => () => { if (commitTimer.current) clearTimeout(commitTimer.current); }, []);

  const dur = p.duration;
  const shown = pending ?? p.position;
  const frac = dur > 0 ? Math.min(1, Math.max(0, shown / dur)) : 0;

  const onTrackKey = (e: React.KeyboardEvent) => {
    const k = navKey(e.nativeEvent);
    if (!p.controllable || dur <= 0) return;
    if (k === "left" || k === "right" || k === "ff" || k === "rw") {
      e.preventDefault();
      // a held key or a quick burst of presses (< 450 ms apart) both accumulate
      const now = performance.now();
      repeats.current = e.repeat || (pending !== null && now - lastPress.current < 450) ? repeats.current + 1 : 0;
      lastPress.current = now;
      if (pending === null) seekFrom.current = p.position;
      const step = seekStep(repeats.current) * (k === "left" || k === "rw" ? -1 : 1);
      const base = pending ?? p.position;
      const to = Math.min(dur - 2, Math.max(0, base + step));
      setPending(to);
      p.poke();
      if (commitTimer.current) clearTimeout(commitTimer.current);
      commitTimer.current = setTimeout(() => commit(to), 900);
    } else if (k === "enter") {
      e.preventDefault();
      if (pending !== null) commit(pending); else p.onTogglePlay();
    }
  };

  const lang = d?.originalLanguage ?? languageName(d?.language) ?? null;
  const otherLangs = (d?.languages ?? []).filter((l) => l !== lang).slice(0, 3);
  const showIntro = intro && p.ready && !panel;
  const cls = `tvp ${p.touch ? "is-touch" : ""} ${p.visible || panel || pending !== null ? "is-visible" : ""} ${panel ? "has-panel" : ""} ${pending !== null ? "is-seeking" : ""}`;

  if (locked) return (
    <div className="tvp is-touch is-locked">
      <div className="tvp-touch" onPointerUp={showUnlock} aria-hidden="true" />
      <button id="tvp-unlock" className={`tvp-unlock ${unlockShown ? "is-shown" : ""}`} onClick={() => { setLocked(false); setUnlockShown(false); p.poke(); }} aria-label="Unlock controls">
        <Icon name="lock" /> <span>Tap to unlock</span>
      </button>
    </div>
  );

  return (
    <div className={cls} onKeyDown={(e) => { if (!panel && track.current && document.activeElement === track.current) onTrackKey(e); }}>
      <div className="tvp-scrim" aria-hidden="true" />
      {p.touch && <TouchLayer p={p} />}
      {p.touch && (
        <div className="tvp-center" aria-hidden={!p.visible}>
          {p.controllable && <button className="tvp-round" onClick={() => { p.onSeek(Math.max(0, p.position - 10)); p.poke(); }} aria-label="Back 10 seconds"><Icon name="replay10" /></button>}
          {p.controllable && <button className="tvp-round tvp-round--main" onClick={() => { p.onTogglePlay(); p.poke(); }} aria-label={p.paused ? "Play" : "Pause"}>{p.paused ? <Icon name="play" /> : <span className="pause-glyph" aria-hidden="true" />}</button>}
          {p.controllable && <button className="tvp-round" onClick={() => { p.onSeek(Math.min(Math.max(0, p.duration - 2), p.position + 10)); p.poke(); }} aria-label="Forward 10 seconds"><Icon name="forward10" /></button>}
        </div>
      )}
      {showIntro && d?.certification && (
        <div className="tvp-advisory" aria-live="polite">
          <span className="tvp-advisory-bar" aria-hidden="true" />
          <div>
            <p className="tvp-advisory-rating">Rated {d.certification}</p>
            {d.genres.length > 0 && <p className="tvp-advisory-sub">{d.genres.slice(0, 3).join(" · ")}</p>}
          </div>
        </div>
      )}
      {showIntro && lang && !p.visible && (
        <div className="tvp-langs" aria-hidden="true">
          <span className="tvp-lang is-active"><Icon name="check" /> {lang} <small>Original</small></span>
          {otherLangs.map((l) => <span key={l} className="tvp-lang">{l}</span>)}
        </div>
      )}
      {p.paused && p.ready && !panel && pending === null && <span className="tvp-paused" aria-label="Paused"><span className="pause-glyph" /></span>}

      <header className="tvp-top lrud-container">
        {p.touch && <button className="tvp-back" onClick={p.onExit} aria-label="Back"><Icon name="back" /></button>}
        <div className="tvp-title">
          <strong>{d?.title ?? ""}</strong>
          {isSeries && <span>{episodeLine(ep.s, ep.e, p.episodeTitle)}</span>}
        </div>
        <div className="tvp-actions lrud-container">
          {p.touch && <button id="tvp-lock" className="tvp-pill tvp-pill--icon" onClick={() => { setLocked(true); setPanel(null); showUnlock(); }} aria-label="Lock controls" title="Lock controls"><Icon name="lock" /></button>}
          {p.onPip && <button id="tvp-pip" className="tvp-pill tvp-pill--icon" onClick={p.onPip} aria-label="Picture in picture" title="Picture in picture" data-hover-focus><ExtraIcon name="pip" /></button>}
          <button id="tvp-quality" className="tvp-pill" onClick={() => setPanel("quality")} data-hover-focus>
            <ExtraIcon name="videoBox" /> Quality <span className="tvp-pill-val">{QUALITIES.find((q) => q.id === p.quality)?.label ?? "Auto"}</span>
          </button>
          <button id="tvp-audio" className="tvp-pill" onClick={() => setPanel("audio")} data-hover-focus>
            <Icon name="captions" /> Audio &amp; Subtitles
          </button>
        </div>
      </header>

      {pending !== null && <SeekStrip d={d} to={pending} duration={dur} delta={pending - seekFrom.current} chapter={chapterAt(pending, p.markers ?? [])} />}

      <div className="tvp-bottom">
        <span className="tvp-remaining" aria-hidden="true">{dur > 0 ? clock(dur - shown) : ""}</span>
        <div ref={track} id="tvp-track" className="tvp-track" tabIndex={0} role="slider" aria-label="Seek"
          aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(shown)} aria-valuetext={`${clock(shown)} of ${clock(dur)}`}
          onClick={(e) => {
            if (!p.controllable || dur <= 0) return;
            const r = e.currentTarget.getBoundingClientRect();
            commit(((e.clientX - r.left) / r.width) * dur);
          }} data-hover-focus>
          {dur > 0 && p.markers?.map((m) => (
            <span key={m.kind} className={`tvp-mark is-${m.kind}`} style={{ left: `${(m.start / dur) * 100}%`, width: `${((m.end - m.start) / dur) * 100}%` }} title={MARKER_LABEL[m.kind]} />
          ))}
          <span className="tvp-track-fill" style={{ transform: `scaleX(${frac})` }} />
          <span className="tvp-knob" style={{ left: `${frac * 100}%` }} />
        </div>
        <div className="tvp-bottom-row lrud-container">
          <button id="tvp-next" className="tvp-pill" onClick={() => setPanel("next")} data-hover-focus><Icon name="episodes" /> Watch Next</button>
          <button id="tvp-sleep" className={`tvp-pill ${p.sleepMode !== "off" ? "is-on" : ""}`} onClick={() => setPanel("sleep")} data-hover-focus><Icon name="clock" /> {p.sleepLabel}</button>
          {!p.controllable && <span className="tvp-hint">{p.nativeControls ? "Using the source player's controls" : `${p.sourceId ? sourceName(p.sourceId) : "This source"} uses its own controls`}</span>}
        </div>
      </div>

      {panel === "quality" && (
        <SidePanel className="tvp-panel--quality" title="Quality" onClose={() => setPanel(null)}
          footer={<button id="tvp-report" className="tvp-row tvp-row--report" onClick={() => setPanel("report")} data-hover-focus><ExtraIcon name="warning" /> Report an Issue</button>}>
          <div className="tvp-list lrud-container" role="radiogroup" aria-label="Quality">
            {QUALITIES.map((q) => (
              <button key={q.id} id={`tvp-q-${q.id}`} role="radio" aria-checked={p.quality === q.id} className={`tvp-row ${p.quality === q.id ? "is-selected" : ""}`}
                data-autofocus={p.quality === q.id ? true : undefined} onClick={() => { p.onQuality(q.id); setPanel(null); }} data-hover-focus>
                <span className="tvp-check" aria-hidden="true">{p.quality === q.id && <Icon name="check" />}</span>
                <strong>{q.label}</strong>{q.note && <small>{q.note}</small>}
              </button>
            ))}
          </div>
          {p.sources.length > 1 && (
            <>
              <p className="tvp-group">Source</p>
              <div className="tvp-list lrud-container" role="radiogroup" aria-label="Source">
                {p.sources.map((s) => (
                  <button key={s.id} id={`tvp-s-${s.id}`} role="radio" aria-checked={p.sourceId === s.id} className={`tvp-row ${p.sourceId === s.id ? "is-selected" : ""}`}
                    onClick={() => { p.onSource(s.id); setPanel(null); }} data-hover-focus>
                    <span className="tvp-check" aria-hidden="true">{p.sourceId === s.id && <Icon name="check" />}</span>
                    <strong>{sourceName(s.id)}</strong>
                    <SourceMeta id={s.id} ranking={p.ranking} />
                  </button>
                ))}
              </div>
            </>
          )}
          {p.controllable && (
            <>
              <p className="tvp-group">Speed</p>
              <div className="tvp-speeds lrud-container" role="radiogroup" aria-label="Playback speed">
                {SPEEDS.map((r) => (
                  <button key={r} id={`tvp-sp-${String(r).replace(".", "_")}`} role="radio" aria-checked={p.speed === r} className={`tvp-speed ${p.speed === r ? "is-selected" : ""}`}
                    onClick={() => p.onSpeed(r)} data-hover-focus>{r === 1 ? "1×" : speedLabel(r)}</button>
                ))}
              </div>
              {p.onFit && (
                <>
                  <p className="tvp-group">Picture</p>
                  <div className="tvp-speeds lrud-container" role="radiogroup" aria-label="Picture fit">
                    {FIT_OPTIONS.map((o) => (
                      <button key={o.id} id={`tvp-fit-${o.id}`} role="radio" aria-checked={p.fit === o.id} className={`tvp-speed ${p.fit === o.id ? "is-selected" : ""}`}
                        onClick={() => p.onFit!(o.id)} data-hover-focus>{o.label}</button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </SidePanel>
      )}

      {panel === "sleep" && (
        <SidePanel className="tvp-panel--quality" title="Sleep Timer" onClose={() => setPanel(null)}>
          <div className="tvp-list lrud-container" role="radiogroup" aria-label="Sleep timer">
            {SLEEP_OPTIONS.map((o) => (
              <button key={o.id} id={`tvp-sl-${o.id}`} role="radio" aria-checked={p.sleepMode === o.id} className={`tvp-row ${p.sleepMode === o.id ? "is-selected" : ""}`}
                data-autofocus={p.sleepMode === o.id ? true : undefined} onClick={() => { p.onSleep(o.id); setPanel(null); }} data-hover-focus>
                <span className="tvp-check" aria-hidden="true">{p.sleepMode === o.id && <Icon name="check" />}</span>
                <strong>{o.id === "end" && !isSeries ? "End of movie" : o.label}</strong>
              </button>
            ))}
          </div>
          <p className="tvp-panel-note">Playback pauses when the timer runs out. If nobody answers within a minute, Panda stops and saves your spot.</p>
        </SidePanel>
      )}

      {panel === "audio" && (
        <SidePanel className="tvp-panel--audio" title="" onClose={() => setPanel(null)}>
          <div className="tvp-cols">
            <div className="tvp-col">
              <p className="tvp-col-title">Audio</p>
              <div className="tvp-list lrud-container" role="radiogroup" aria-label="Audio">
                <button id="tvp-a-orig" role="radio" aria-checked={!p.muted} className={`tvp-row ${!p.muted ? "is-selected" : ""}`} data-autofocus onClick={() => p.onMuted(false)} data-hover-focus>
                  <span className="tvp-check" aria-hidden="true">{!p.muted && <Icon name="check" />}</span>
                  <span className="tvp-row-text"><strong>{lang ?? "Original"}</strong><small>Original</small></span>
                </button>
                {p.controllable && (
                  <button id="tvp-a-mute" role="radio" aria-checked={p.muted} className={`tvp-row ${p.muted ? "is-selected" : ""}`} onClick={() => p.onMuted(true)} data-hover-focus>
                    <span className="tvp-check" aria-hidden="true">{p.muted && <Icon name="check" />}</span>
                    <strong>Sound off</strong>
                  </button>
                )}
              </div>
              {p.controllable && p.onVolume && (
                <div className="tvp-vol lrud-container" role="group" aria-label="Volume">
                  <span className="tvp-vol-label">Volume</span>
                  <span className="tvp-vol-ctl">
                  <button id="tvp-vol-down" className="tvp-speed" onClick={() => p.onVolume!(Math.max(0, Math.round(((p.muted ? 0 : p.volume ?? 1) - 0.1) * 10) / 10))} aria-label="Volume down" data-hover-focus><Icon name="volumeDown" /></button>
                  <span className="tvp-vol-val" aria-live="polite">{Math.round((p.muted ? 0 : p.volume ?? 1) * 100)}%</span>
                  <button id="tvp-vol-up" className="tvp-speed" onClick={() => p.onVolume!(Math.min(1, Math.round(((p.muted ? 0 : p.volume ?? 1) + 0.1) * 10) / 10))} aria-label="Volume up" data-hover-focus><Icon name="volume" /></button>
                  </span>
                </div>
              )}
            </div>
            <div className="tvp-col">
              <p className="tvp-col-title">Subtitles</p>
              <div className="tvp-list lrud-container" role="radiogroup" aria-label="Subtitles">
                <SubtitleRows c={p.captions} native={p.nativeControls} onOff={() => { if (p.nativeControls) p.onNativeControls(false); p.captions?.onTrack("off"); }} onPicked={() => { if (p.nativeControls) p.onNativeControls(false); }} />
                <button id="tvp-sub-src" role="radio" aria-checked={p.nativeControls} className={`tvp-row ${p.nativeControls ? "is-selected" : ""}`} onClick={() => { p.onNativeControls(true); setPanel(null); }} data-hover-focus>
                  <span className="tvp-check" aria-hidden="true">{p.nativeControls && <Icon name="check" />}</span>
                  <span className="tvp-row-text"><strong>Choose in source player</strong><small>Opens {p.sourceId ? sourceName(p.sourceId) : "the source"}'s subtitle and audio menu</small></span>
                </button>
              </div>
            </div>
          </div>
        </SidePanel>
      )}

      {panel === "report" && (
        <SidePanel className="tvp-panel--quality" title="Report an Issue" onClose={() => setPanel("quality")}>
          <div className="tvp-list lrud-container">
            {ISSUES.map((i, n) => (
              <button key={i.id} id={`tvp-issue-${i.id}`} className="tvp-row" data-autofocus={n === 0 ? true : undefined} onClick={() => { p.onReport(i); setPanel(null); }} data-hover-focus>
                <strong>{i.label}</strong>
              </button>
            ))}
          </div>
        </SidePanel>
      )}

      {panel === "next" && d && (
        <WatchNext d={d} isSeries={isSeries} ep={ep} upNext={p.upNext} countdown={p.countdown} spoilers={Boolean(p.hideSpoilers)}
          onPlayEpisode={p.onPlayEpisode} onPlayTitle={p.onPlayTitle} onClose={() => { if (p.upNext) p.onCancelUpNext(); setPanel(null); }} />
      )}
    </div>
  );
}

function SidePanel({ title, className, children, footer, onClose }: { title: string; className?: string; children: React.ReactNode; footer?: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusScope(ref);
  return (
    <div className="tvp-panel-root">
      <div className="tvp-panel-scrim" onClick={onClose} aria-hidden="true" />
      <div ref={ref} className={`tvp-panel ${className ?? ""}`} role="dialog" aria-modal="true" aria-label={title || "Audio and Subtitles"}>
        {title && <h2 className="tvp-panel-title">{title}</h2>}
        <div className="tvp-panel-body">{children}</div>
        {footer && <div className="tvp-panel-foot lrud-container">{footer}</div>}
      </div>
    </div>
  );
}

/** Seek preview (§20.11): three cards at −10 s / target / +10 s. Embeds give no frames (D-25), so the cards show the title's artwork at different crops. */
function SeekStrip({ d, to, duration, delta, chapter }: { d: TitleDetails | undefined; to: number; duration: number; delta: number; chapter: string | null }) {
  const img = d?.backdrop ?? d?.backdropLarge ?? null;
  const steps = [to - 10, to, to + 10];
  return (
    <div className="tvp-strip" aria-hidden="true">
      <span className="tvp-seek-bubble" id="tvp-seek-bubble"><strong>{clock(to)}</strong><span>{seekDelta(delta)}</span>{chapter && <em className="tvp-chapter">{chapter}</em>}</span>
      {steps.map((t, i) => (
        <div key={i} className={`tvp-thumb ${i === 1 ? "is-center" : ""} ${t < 0 || t > duration ? "is-empty" : ""}`}>
          {img && t >= 0 && t <= duration && <Img src={img} alt="" title="" style={{ objectPosition: `${20 + i * 30}% 50%` }} />}
          <span className="tvp-thumb-time">{t >= 0 && t <= duration ? clock(t) : ""}</span>
        </div>
      ))}
    </div>
  );
}

function WatchNext({ d, isSeries, ep, upNext, countdown, spoilers, onPlayEpisode, onPlayTitle, onClose }: {
  d: TitleDetails; isSeries: boolean; ep: { s: number; e: number }; upNext: { s: number; e: number } | null; countdown: number | null; spoilers: boolean;
  onPlayEpisode: (s: number, e: number) => void; onPlayTitle: (i: PandaItem) => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusScope(ref);
  const seasons = d.seasons.filter((s) => s.number > 0);
  const cur = useSeason(isSeries ? d.tmdbId : null, isSeries ? ep.s : null).data;
  const nextSeasonNo = seasons.find((s) => s.number > ep.s)?.number ?? null;
  const curEps = cur?.number === ep.s ? cur.episodes : [];
  const rest = curEps.filter((x) => x.number > ep.e);
  const nextSeason = useSeason(isSeries && rest.length < 6 && nextSeasonNo ? d.tmdbId : null, nextSeasonNo).data;
  const cards: WatchNextCard[] = useMemo(() => {
    if (!isSeries) {
      return d.moreLikeThis.slice(0, 12).map((i) => ({ kind: "title" as const, key: i.id, item: i, title: i.title, image: i.backdrop ?? i.poster, sub: i.genres.slice(0, 2).join(" · ") }));
    }
    const epCard = (x: Episode): WatchNextCard => ({ kind: "episode", key: `${x.season}-${x.number}`, season: x.season, episode: x.number, title: `E${x.number} · ${x.title}`, image: (spoilers ? null : x.still) ?? d.backdrop, sub: [`Season ${x.season}`, runtime(x.runtime)].filter(Boolean).join(" · ") });
    const list = rest.map(epCard);
    if (nextSeason && nextSeason.number === nextSeasonNo) list.push(...nextSeason.episodes.slice(0, 6).map(epCard));
    return list.slice(0, 12);
  }, [isSeries, d, rest, nextSeason, nextSeasonNo, spoilers]);

  return (
    <div ref={ref} className="tvp-next" role="dialog" aria-label="Watch Next">
      <div className="tvp-next-head">
        <span className="tvp-next-title"><Icon name="episodes" /> Watch Next</span>
        <button id="tvp-next-close" className="tvp-pill tvp-pill--sm" onClick={onClose} data-hover-focus>Close</button>
      </div>
      <hr className="tvp-next-rule" />
      {cards.length === 0
        ? <p className="tvp-next-empty">{isSeries ? "You're on the latest episode." : "Nothing else to suggest right now."}</p>
        : (
          <div className="tvp-next-row lrud-container">
            {cards.map((c, i) => {
              const auto = upNext && i === 0 && c.kind === "episode" && c.season === upNext.s && c.episode === upNext.e;
              return (
                <button key={c.key} id={`tvp-wn-${c.key}`} className="tvp-wn" data-autofocus={i === 0 ? true : undefined} data-hover-focus
                  onClick={() => (c.kind === "episode" ? onPlayEpisode(c.season, c.episode) : onPlayTitle(c.item))}>
                  <span className="tvp-wn-media">
                    <Img src={c.image} alt="" title={c.title} />
                    <span className="tvp-wn-play" aria-hidden="true"><Icon name="play" /></span>
                    {auto && countdown !== null && <span className="tvp-wn-count">Next episode in {Math.max(0, countdown)}</span>}
                  </span>
                  <strong>{c.title}</strong>
                  {c.sub && <small>{c.sub}</small>}
                </button>
              );
            })}
          </div>
        )}
    </div>
  );
}

/**
 * Touch input layer: the provider iframe never receives taps (docs/AD_SHIELD.md, layer 1).
 * One tap shows or hides the controls; a double tap on the left or right third seeks 10 s.
 * v1.2.2 gestures: drag sideways to seek, up/down on the right for volume and on the left for
 * brightness, and hold a finger still to play at 2× until it lifts.
 */
function TouchLayer({ p }: { p: TvChromeProps }) {
  const last = useRef({ t: 0, x: 0 });
  const single = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drag = useRef<null | { id: number; x: number; y: number; w: number; h: number; kind: DragKind | null; base: number; holding: boolean }>(null);
  const [flash, setFlash] = useState<null | { side: "l" | "r"; n: number }>(null);
  const [hud, setHud] = useState<null | { kind: DragKind | "hold"; value: number }>(null);
  const g = p.gestures;
  useEffect(() => () => { for (const t of [single, holdTimer, hudTimer]) if (t.current) clearTimeout(t.current); }, []);
  const clearHold = () => { if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; } };

  function tap(e: RPointerEvent<HTMLDivElement>) {
    const w = e.currentTarget.clientWidth || 1;
    const x = (e.clientX - e.currentTarget.getBoundingClientRect().left) / w;
    const now = e.timeStamp;
    const dbl = now - last.current.t < 300 && Math.abs(x - last.current.x) < 0.2;
    last.current = { t: now, x };
    if (dbl && p.controllable && (x < 1 / 3 || x > 2 / 3)) {
      if (single.current) { clearTimeout(single.current); single.current = null; }
      const fwd = x > 2 / 3;
      p.onSeek(fwd ? Math.min(Math.max(0, p.duration - 2), p.position + 10) : Math.max(0, p.position - 10));
      setFlash((f) => ({ side: fwd ? "r" : "l", n: (f?.n ?? 0) + 1 }));
      setTimeout(() => setFlash(null), 650);
      return;
    }
    if (single.current) clearTimeout(single.current);
    single.current = setTimeout(() => { single.current = null; if (p.visible) p.hide(); else p.poke(); }, 220);
  }

  return (
    <div className={`tvp-touch ${g ? "has-gestures" : ""}`}
      onPointerDown={(e) => {
        if (!g || drag.current) return;
        const r = e.currentTarget.getBoundingClientRect();
        drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, w: r.width, h: r.height, kind: null, base: 0, holding: false };
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
        clearHold();
        // a new gesture owns the readout: the last one's fade-out must not hide it
        if (hudTimer.current) { clearTimeout(hudTimer.current); hudTimer.current = null; }
        if (p.controllable && !p.paused) holdTimer.current = setTimeout(() => {
          holdTimer.current = null;
          const d = drag.current;
          if (!d || d.kind) return;
          d.holding = true; p.onHold?.(true); setHud({ kind: "hold", value: 2 });
        }, HOLD_MS);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId || d.holding) return;
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (!d.kind) {
          const k = classifyDrag(dx, dy, d.x - e.currentTarget.getBoundingClientRect().left, d.w);
          if (!k || (k === "seek" && (!p.controllable || p.duration <= 0)) || (k === "volume" && !p.controllable)) return;
          clearHold();
          d.kind = k;
          d.base = k === "seek" ? p.position : k === "volume" ? (p.muted ? 0 : p.volume ?? 1) : p.brightness ?? 1;
        }
        const value = d.kind === "seek" ? dragSeek(d.base, p.duration, dx, d.w) : dragLevel(d.base, dy, d.h, d.kind === "brightness" ? BRIGHT_MIN : 0);
        if (d.kind === "volume") p.onVolume?.(value);
        if (d.kind === "brightness") p.onBrightness?.(value);
        setHud({ kind: d.kind, value });
      }}
      onPointerUp={(e) => {
        clearHold();
        const d = drag.current;
        drag.current = null;
        if (d?.holding) { p.onHold?.(false); setHud(null); return; }
        if (d?.kind) {
          if (d.kind === "seek") p.onSeek(dragSeek(d.base, p.duration, e.clientX - d.x, d.w));
          if (d.kind === "seek") setHud(null);
          else hudTimer.current = setTimeout(() => { hudTimer.current = null; setHud(null); }, 500);
          return;
        }
        tap(e);
      }}
      onPointerCancel={() => {
        clearHold();
        const d = drag.current; drag.current = null;
        if (d?.holding) p.onHold?.(false);
        setHud(null);
      }}>
      {flash && <span key={flash.n} className={`tvp-seekflash is-${flash.side}`} aria-hidden="true"><Icon name={flash.side === "r" ? "forward10" : "replay10"} /> 10s</span>}
      {hud && <GestureHud kind={hud.kind} value={hud.value} position={p.position} duration={p.duration} />}
    </div>
  );
}

/** "1:05" / "12 s" for the seek preview. */
function deltaLabel(sec: number) {
  return sec < 60 ? `${sec} s` : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function GestureHud({ kind, value, position, duration }: { kind: DragKind | "hold"; value: number; position: number; duration: number }) {
  if (kind === "hold") return <div className="tvp-ghud tvp-ghud--hold" role="status"><Icon name="next" /> 2× speed</div>;
  if (kind === "seek") {
    const delta = Math.round(value - position);
    return (
      <div className="tvp-ghud tvp-ghud--seek" role="status">
        <strong>{clock(value)}</strong><span>{delta >= 0 ? "+" : "−"}{deltaLabel(Math.abs(delta))} · {clock(duration)}</span>
      </div>
    );
  }
  const pct = Math.round(value * 100);
  return (
    <div className={`tvp-ghud tvp-ghud--level is-${kind}`} role="status" aria-label={`${kind === "volume" ? "Volume" : "Brightness"} ${pct}%`}>
      {kind === "volume" ? <Icon name={value <= 0 ? "volumeOff" : "volume"} /> : <ExtraIcon name="sun" />}
      <span className="tvp-ghud-bar" aria-hidden="true"><i style={{ height: `${pct}%` }} /></span>
      <small>{pct}%</small>
    </div>
  );
}

/** Off, Panda's subtitle tracks, a timing nudge and the status line (v1.2.1). */
function SubtitleRows({ c, native, onOff, onPicked }: { c?: CaptionControls; native: boolean; onOff: () => void; onPicked: () => void }) {
  const offSelected = !native && !c?.trackId;
  const langs = (c?.langs ?? []).map(subLangName).join(" or ");
  return (
    <>
      <button id="tvp-sub-off" role="radio" aria-checked={offSelected} className={`tvp-row ${offSelected ? "is-selected" : ""}`} onClick={onOff} data-hover-focus>
        <span className="tvp-check" aria-hidden="true">{offSelected && <Icon name="check" />}</span>
        <strong>Off</strong>
      </button>
      {c?.available && c.tracks.map((t) => {
        const on = !native && c.trackId === t.id;
        return (
          <button key={t.id} id={`tvp-sub-${t.id}`} role="radio" aria-checked={on} className={`tvp-row ${on ? "is-selected" : ""}`} data-autofocus={on ? true : undefined} onClick={() => { onPicked(); c.onTrack(t); }} data-hover-focus>
            <span className="tvp-check" aria-hidden="true">{on && <Icon name="check" />}</span>
            <span className="tvp-row-text"><strong>{t.label}</strong>{t.release && <small className="tvp-sub-release">{t.release}</small>}</span>
          </button>
        );
      })}
      {c?.available && c.trackId && !native && (
        <div className="tvp-sub-sync lrud-container" role="group" aria-label="Subtitle timing">
          <button id="tvp-sub-earlier" className="tvp-row tvp-row--half" onClick={() => c.onNudge(-0.5)} data-hover-focus><strong>Earlier</strong><small>−0.5 s</small></button>
          <button id="tvp-sub-later" className="tvp-row tvp-row--half" onClick={() => c.onNudge(0.5)} data-hover-focus><strong>Later</strong><small>+0.5 s</small></button>
          <p className="tvp-sub-offset" aria-live="polite">{offsetLabel(c.offset)}</p>
        </div>
      )}
      {c?.available && (c.loading || c.failed || c.error || !c.tracks.length) && (
        <p className="tvp-panel-note tvp-sub-status" aria-live="polite">
          {c.error ? c.error : c.failed ? "Subtitles are unavailable right now. Try again in a moment" : c.loading ? `Looking for ${langs} subtitles…` : `No ${langs} subtitles found. Pick other languages in Settings › Subtitles`}
        </p>
      )}
    </>
  );
}
