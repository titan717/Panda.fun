import { useEffect, useRef } from "react";
import { Icon } from "./Icon";
import { Img } from "./ui";
import { Sheet } from "./Sheet";
import { focusEl, useBackHandler, useFocusScope } from "../lib/focus";
import { SLEEP_GRACE_S, SLEEP_OPTIONS, SPEEDS, speedLabel, type SleepMode } from "../lib/player2";

export interface NextCardInfo { s: number; e: number; title: string | null; still: string | null; left: number }

/**
 * Floating Player 2.0 prompts shared by TV and touch: Skip Intro, the next-episode card that appears
 * over the credits, and the sleep timer's "Still watching?" check.
 */
export function PlayerPrompts(p: {
  tv: boolean;
  skip: boolean; skipLabel: string; onSkip: () => void;
  nextCard: NextCardInfo | null; onPlayNext: () => void; onDismissNext: () => void;
  stillWatching: number | null; onKeepWatching: () => void; onStop: () => void;
}) {
  return (
    <>
      {p.skip && <SkipIntro key={p.skipLabel} tv={p.tv} label={p.skipLabel} onSkip={p.onSkip} />}
      {p.nextCard && !p.skip && <NextCard tv={p.tv} info={p.nextCard} onPlay={p.onPlayNext} onDismiss={p.onDismissNext} />}
      {p.stillWatching !== null && <StillWatching left={p.stillWatching} onKeep={p.onKeepWatching} onStop={p.onStop} />}
    </>
  );
}

function SkipIntro({ tv, label, onSkip }: { tv: boolean; label: string; onSkip: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  // TV: take focus so OK skips straight away (Netflix / Prime behaviour); the chrome stays hidden
  useEffect(() => { if (tv) focusEl(ref.current); }, [tv]);
  return (
    <button ref={ref} id="p2-skip" className="p2-skip" onClick={onSkip} data-hover-focus>
      {label} <Icon name="next" />
    </button>
  );
}

function NextCard({ tv, info, onPlay, onDismiss }: { tv: boolean; info: NextCardInfo; onPlay: () => void; onDismiss: () => void }) {
  const play = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (tv) focusEl(play.current); }, [tv]);
  useBackHandler(() => { onDismiss(); }, tv);
  return (
    <div className="p2-next lrud-container" role="dialog" aria-label="Next episode">
      {!tv && <button id="p2-next-x" className="p2-next-x" onClick={onDismiss} aria-label="Watch credits"><Icon name="close" /></button>}
      <span className="p2-next-media">
        <Img src={info.still} alt="" title={`E${info.e}`} />
        <span className="p2-next-play" aria-hidden="true"><Icon name="play" /></span>
      </span>
      <span className="p2-next-text">
        <small>Next Episode · S{info.s} E{info.e}</small>
        {info.title && <strong>{info.title}</strong>}
        <span className="p2-next-actions">
          <button ref={play} id="p2-next-play" className="p2-btn p2-btn--primary" onClick={onPlay} data-hover-focus><Icon name="play" /> Play Now</button>
          {tv && <button id="p2-next-close" className="p2-btn" onClick={onDismiss} data-hover-focus>Watch Credits</button>}
        </span>
      </span>
    </div>
  );
}

function StillWatching({ left, onKeep, onStop }: { left: number; onKeep: () => void; onStop: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusScope(ref);
  useBackHandler(() => { onKeep(); });
  return (
    <div className="p2-still-root">
      <div ref={ref} className="p2-still lrud-container" role="alertdialog" aria-modal="true" aria-labelledby="p2-still-title">
        <Icon name="clock" />
        <h2 id="p2-still-title">Are you still watching?</h2>
        <p>The sleep timer paused playback. It stops in {Math.max(0, left)} s.</p>
        <span className="p2-still-ring" style={{ ["--p" as string]: `${(left / SLEEP_GRACE_S) * 100}` }} aria-hidden="true" />
        <div className="p2-still-actions">
          <button id="p2-keep" className="btn btn--primary" data-autofocus autoFocus onClick={onKeep}><Icon name="play" /> Continue Watching</button>
          <button id="p2-stop" className="btn btn--secondary" onClick={onStop}>Stop for Now</button>
        </div>
      </div>
    </div>
  );
}

/** Touch and non-chrome players: one options chip opens Speed and Sleep Timer pickers in a bottom sheet. */
export function PlayerOptionsSheet({ kind, controllable, speed, sleep, isSeries, onKind, onSpeed, onSleep, onClose }: {
  kind: "menu" | "speed" | "sleep"; controllable: boolean; speed: number; sleep: SleepMode; isSeries: boolean;
  onKind: (k: "speed" | "sleep") => void; onSpeed: (r: number) => void; onSleep: (m: SleepMode) => void; onClose: () => void;
}) {
  const sleepLabel = (id: SleepMode) => (id === "end" && !isSeries ? "End of movie" : SLEEP_OPTIONS.find((o) => o.id === id)?.label ?? "Off");
  if (kind === "menu") {
    return (
      <Sheet title="Playback" onClose={onClose} className="sheet--p2">
        <div className="p2-options lrud-container">
          {controllable && (
            <button id="p2-menu-speed" className="p2-opt p2-opt--menu" onClick={() => onKind("speed")} data-autofocus data-hover-focus>
              <span className="p2-opt-check" aria-hidden="true"><Icon name="play" /></span>Playback speed<small>{speedLabel(speed)}</small><Icon name="chevronRight" />
            </button>
          )}
          <button id="p2-menu-sleep" className="p2-opt p2-opt--menu" onClick={() => onKind("sleep")} data-autofocus={controllable ? undefined : true} data-hover-focus>
            <span className="p2-opt-check" aria-hidden="true"><Icon name="clock" /></span>Sleep timer<small>{sleepLabel(sleep)}</small><Icon name="chevronRight" />
          </button>
          {!controllable && <p className="p2-options-note">This source uses its own speed control in the player.</p>}
        </div>
      </Sheet>
    );
  }
  return (
    <Sheet title={kind === "speed" ? "Playback Speed" : "Sleep Timer"} onClose={onClose} className="sheet--p2">
      <div className="p2-options lrud-container" role="radiogroup" aria-label={kind === "speed" ? "Playback speed" : "Sleep timer"}>
        {kind === "speed"
          ? SPEEDS.map((r) => (
            <button key={r} id={`p2-speed-${String(r).replace(".", "_")}`} role="radio" aria-checked={speed === r} className={`p2-opt ${speed === r ? "is-selected" : ""}`}
              data-autofocus={speed === r ? true : undefined} onClick={() => onSpeed(r)} data-hover-focus>
              <span className="p2-opt-check" aria-hidden="true">{speed === r && <Icon name="check" />}</span>{speedLabel(r)}
            </button>
          ))
          : SLEEP_OPTIONS.map((o) => (
            <button key={o.id} id={`p2-sleep-${o.id}`} role="radio" aria-checked={sleep === o.id} className={`p2-opt ${sleep === o.id ? "is-selected" : ""}`}
              data-autofocus={sleep === o.id ? true : undefined} onClick={() => onSleep(o.id)} data-hover-focus>
              <span className="p2-opt-check" aria-hidden="true">{sleep === o.id && <Icon name="check" />}</span>{sleepLabel(o.id)}
            </button>
          ))}
      </div>
    </Sheet>
  );
}
