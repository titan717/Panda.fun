import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { Img } from "../components/ui";
import { useBackHandler, useFocusScope, focusEl } from "../lib/focus";
import { navKey } from "../lib/keys";
import { useSeason } from "../lib/hooks";
import { languageName, runtime } from "../lib/format";
import { sourceName } from "../lib/player";
import type { Prefs } from "../lib/store";
import type { Episode, PandaItem, PlaybackSource, SourceId, TitleDetails } from "../lib/types";

/** Quality choices of the TV PLAYER blueprint (§20.9). `cap` is the CineSrc `quality` hint. */
export const QUALITIES: { id: Prefs["quality"]; label: string; note?: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "2160", label: "4K", note: "Up to 2160p" },
  { id: "1080", label: "Full HD", note: "Up to 1080p" },
  { id: "720", label: "HD", note: "Up to 720p" },
  { id: "480", label: "Data Saver" }
];

export const ISSUES = [
  { id: "noplay", label: "Video won't play or keeps buffering", switchSource: true },
  { id: "wrong", label: "Wrong title or episode", switchSource: true },
  { id: "sync", label: "Audio and video out of sync", switchSource: true },
  { id: "subs", label: "Subtitles missing or wrong", switchSource: false }
] as const;

/** HH:MM:SS (blueprint shows the remaining time this way, §20.4). */
export function clock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/** Accelerating seek step while a direction is held (10 s → 30 s → 60 s). */
export function seekStep(repeats: number) { return repeats < 6 ? 10 : repeats < 16 ? 30 : 60; }

export type WatchNextCard =
  | { kind: "episode"; key: string; season: number; episode: number; title: string; image: string | null; sub: string }
  | { kind: "title"; key: string; item: PandaItem; title: string; image: string | null; sub: string };

export interface TvChromeProps {
  d: TitleDetails | undefined;
  isSeries: boolean;
  ep: { s: number; e: number };
  episodeTitle?: string | null;
  visible: boolean;
  poke: () => void;
  hide: () => void;
  paused: boolean;
  ready: boolean;
  position: number;
  duration: number;
  controllable: boolean;
  onSeek: (to: number) => void;
  onTogglePlay: () => void;
  quality: Prefs["quality"];
  onQuality: (q: Prefs["quality"]) => void;
  sources: PlaybackSource[];
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
}

type Panel = null | "quality" | "audio" | "next" | "report";

export function TvPlayerChrome(p: TvChromeProps) {
  const [panel, setPanel] = useState<Panel>(null);
  const [pending, setPending] = useState<number | null>(null);
  const repeats = useRef(0);
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
  useEffect(() => { if (p.upNext) setPanel("next"); }, [p.upNext]);

  // focus the seek track whenever the chrome appears with nothing else focused
  useEffect(() => {
    if (p.visible && !panel) {
      const a = document.activeElement as HTMLElement | null;
      if (!a || a === document.body || !a.closest(".tvp")) focusEl(track.current);
    }
  }, [p.visible, panel]);

  // Back: panel → chrome → exit (§20.12)
  useBackHandler(() => {
    if (panel === "next" && p.upNext) p.onCancelUpNext();
    if (panel) { setPanel(null); requestAnimationFrame(() => focusEl(track.current)); return; }
    if (pending !== null) { setPending(null); return; }
    if (p.visible) { p.hide(); return; }
    p.onExit();
  });

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
      repeats.current = e.repeat ? repeats.current + 1 : 0;
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
  const cls = `tvp ${p.visible || panel || pending !== null ? "is-visible" : ""} ${panel ? "has-panel" : ""} ${pending !== null ? "is-seeking" : ""}`;

  return (
    <div className={cls} onKeyDown={(e) => { if (!panel && track.current && document.activeElement === track.current) onTrackKey(e); }}>
      <div className="tvp-scrim" aria-hidden="true" />
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
        <div className="tvp-title">
          <strong>{d?.title ?? ""}</strong>
          {isSeries && <span>S{ep.s} E{ep.e}{p.episodeTitle ? ` · ${p.episodeTitle}` : ""}</span>}
        </div>
        <div className="tvp-actions lrud-container">
          <button id="tvp-quality" className="tvp-pill" onClick={() => setPanel("quality")} data-hover-focus>
            <Icon name="play" /> Quality <span className="tvp-pill-val">{QUALITIES.find((q) => q.id === p.quality)?.label ?? "Auto"}</span>
          </button>
          <button id="tvp-audio" className="tvp-pill" onClick={() => setPanel("audio")} data-hover-focus>
            <Icon name="list" /> Audio &amp; Subtitles
          </button>
        </div>
      </header>

      {pending !== null && <SeekStrip d={d} to={pending} duration={dur} />}

      <div className="tvp-bottom">
        <span className="tvp-remaining" aria-hidden="true">{dur > 0 ? clock(dur - shown) : ""}</span>
        <div ref={track} id="tvp-track" className="tvp-track" tabIndex={0} role="slider" aria-label="Seek"
          aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(shown)} aria-valuetext={`${clock(shown)} of ${clock(dur)}`}
          onClick={(e) => {
            if (!p.controllable || dur <= 0) return;
            const r = e.currentTarget.getBoundingClientRect();
            commit(((e.clientX - r.left) / r.width) * dur);
          }} data-hover-focus>
          <span className="tvp-track-fill" style={{ transform: `scaleX(${frac})` }} />
          <span className="tvp-knob" style={{ left: `${frac * 100}%` }} />
        </div>
        <div className="tvp-bottom-row lrud-container">
          <button id="tvp-next" className="tvp-pill" onClick={() => setPanel("next")} data-hover-focus><Icon name="episodes" /> Watch Next</button>
          {!p.controllable && <span className="tvp-hint">{p.nativeControls ? "Using the source player's controls" : `${p.sourceId ? sourceName(p.sourceId) : "This source"} uses its own controls`}</span>}
        </div>
      </div>

      {panel === "quality" && (
        <SidePanel className="tvp-panel--quality" title="Quality" onClose={() => setPanel(null)}
          footer={<button id="tvp-report" className="tvp-row tvp-row--report" onClick={() => setPanel("report")} data-hover-focus><Icon name="info" /> Report an Issue</button>}>
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
                  </button>
                ))}
              </div>
            </>
          )}
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
            </div>
            <div className="tvp-col">
              <p className="tvp-col-title">Subtitles</p>
              <div className="tvp-list lrud-container" role="radiogroup" aria-label="Subtitles">
                <button id="tvp-sub-off" role="radio" aria-checked={!p.nativeControls} className={`tvp-row ${!p.nativeControls ? "is-selected" : ""}`} onClick={() => { p.onNativeControls(false); setPanel(null); }} data-hover-focus>
                  <span className="tvp-check" aria-hidden="true">{!p.nativeControls && <Icon name="check" />}</span>
                  <strong>Off</strong>
                </button>
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
        <WatchNext d={d} isSeries={isSeries} ep={ep} upNext={p.upNext} countdown={p.countdown}
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
function SeekStrip({ d, to, duration }: { d: TitleDetails | undefined; to: number; duration: number }) {
  const img = d?.backdrop ?? d?.backdropLarge ?? null;
  const steps = [to - 10, to, to + 10];
  return (
    <div className="tvp-strip" aria-hidden="true">
      {steps.map((t, i) => (
        <div key={i} className={`tvp-thumb ${i === 1 ? "is-center" : ""} ${t < 0 || t > duration ? "is-empty" : ""}`}>
          {img && t >= 0 && t <= duration && <Img src={img} alt="" title="" style={{ objectPosition: `${20 + i * 30}% 50%` }} />}
          <span className="tvp-thumb-time">{t >= 0 && t <= duration ? clock(t) : ""}</span>
        </div>
      ))}
    </div>
  );
}

function WatchNext({ d, isSeries, ep, upNext, countdown, onPlayEpisode, onPlayTitle, onClose }: {
  d: TitleDetails; isSeries: boolean; ep: { s: number; e: number }; upNext: { s: number; e: number } | null; countdown: number | null;
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
    const epCard = (x: Episode): WatchNextCard => ({ kind: "episode", key: `${x.season}-${x.number}`, season: x.season, episode: x.number, title: `E${x.number} · ${x.title}`, image: x.still ?? d.backdrop, sub: [`Season ${x.season}`, runtime(x.runtime)].filter(Boolean).join(" · ") });
    const list = rest.map(epCard);
    if (nextSeason && nextSeason.number === nextSeasonNo) list.push(...nextSeason.episodes.slice(0, 6).map(epCard));
    return list.slice(0, 12);
  }, [isSeries, d, rest, nextSeason, nextSeasonNo]);

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
