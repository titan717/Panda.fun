import "./captions.css";
import { Fragment, useEffect, useState, type RefObject } from "react";
import { clockAt, cuesAt, type Cue } from "../lib/captions";
import type { CaptionClock } from "../lib/useCaptions";
import type { Prefs } from "../lib/store";

/** <i>/<b>/<u> from the cue text as elements; everything else is plain text (no HTML injection). */
function Line({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const stack: string[] = [];
  let k = 0;
  for (const tok of text.split(/(<\/?[ibu]>)/)) {
    const m = /^<(\/?)([ibu])>$/.exec(tok);
    if (m) { if (m[1]) stack.splice(stack.lastIndexOf(m[2]!), 1); else stack.push(m[2]!); continue; }
    if (!tok) continue;
    let node: React.ReactNode = tok;
    for (const t of stack) node = t === "i" ? <i>{node}</i> : t === "b" ? <b>{node}</b> : <u>{node}</u>;
    parts.push(<Fragment key={k++}>{node}</Fragment>);
  }
  return <span className="cap-line">{parts}</span>;
}

/**
 * Panda's caption layer (v1.2.1): drawn over the embed, never takes clicks or focus, and moves up
 * while the player controls are on screen so the two never overlap.
 */
export function CaptionLayer({ cues, clock, offset, raised, size, look }: { cues: Cue[]; clock: RefObject<CaptionClock>; offset: number; raised: boolean; size: Prefs["subtitleSize"]; look: Prefs["subtitleStyle"] }) {
  const [shown, setShown] = useState<Cue[]>([]);
  useEffect(() => {
    let last = "";
    const tick = () => {
      const now = cuesAt(cues, clockAt(clock.current!, performance.now()) - offset);
      const key = now.map((c) => c.start).join(",");
      if (key !== last) { last = key; setShown(now); }
    };
    tick();
    const i = setInterval(tick, 100);
    return () => clearInterval(i);
  }, [cues, clock, offset]);
  return (
    <div className={`captions cap--${size} cap--${look} ${raised ? "is-raised" : ""}`} aria-live="off" aria-hidden={shown.length ? undefined : true}>
      {shown.map((c) => (
        <p key={c.start} className="cap-cue">{c.lines.map((l, n) => <Fragment key={n}>{n > 0 && <br />}<Line text={l} /></Fragment>)}</p>
      ))}
    </div>
  );
}

/** A sample caption in the profile's style (Settings › Subtitles preview). */
export function CaptionPreview({ size, look, text }: { size: Prefs["subtitleSize"]; look: Prefs["subtitleStyle"]; text: string }) {
  return (
    <div className={`captions captions--preview cap--${size} cap--${look}`} aria-hidden="true">
      <p className="cap-cue"><span className="cap-line">{text}</span></p>
    </div>
  );
}
