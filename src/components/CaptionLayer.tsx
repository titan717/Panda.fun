import "./captions.css";
import { Fragment, useEffect, useState, type RefObject } from "react";
import { clockAt, cuesAt, lookClass, type Cue, type SubLook } from "../lib/captions";
import type { CaptionClock } from "../lib/useCaptions";

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

/** The cues showing now, re-read ten times a second from the interpolated clock. */
function useShown(cues: Cue[] | null | undefined, clock: RefObject<CaptionClock>, offset: number) {
  const [shown, setShown] = useState<Cue[]>([]);
  useEffect(() => {
    if (!cues) { setShown([]); return; }
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
  return shown;
}

const Cues = ({ shown, className }: { shown: Cue[]; className: string }) => (
  <>{shown.map((c) => <p key={c.start} className={className}>{c.lines.map((l, n) => <Fragment key={n}>{n > 0 && <br />}<Line text={l} /></Fragment>)}</p>)}</>
);

/**
 * Panda's caption layer (v1.2.1): drawn over the embed, never takes clicks or focus, and moves up
 * while the player controls are on screen so the two never overlap. v1.2.7: colour, background,
 * edge and height from the profile's look, and an optional second language above the first.
 */
export function CaptionLayer({ cues, second, clock, offset, raised, look }: { cues: Cue[]; second?: Cue[] | null; clock: RefObject<CaptionClock>; offset: number; raised: boolean; look: SubLook }) {
  const shown = useShown(cues, clock, offset);
  const shown2 = useShown(second, clock, offset);
  const any = shown.length + shown2.length > 0;
  return (
    <div className={`captions ${lookClass(look)} ${raised ? "is-raised" : ""}`} style={{ "--cap-lift": `${look.pos}%` } as React.CSSProperties} aria-live="off" aria-hidden={any ? undefined : true}>
      <Cues shown={shown2} className="cap-cue cap-cue--second" />
      <Cues shown={shown} className="cap-cue" />
    </div>
  );
}

/** A sample caption in a look (Settings › Subtitles and the player's Style tab). */
export function CaptionPreview({ look, text, second }: { look: SubLook; text: string; second?: string }) {
  return (
    <div className={`captions captions--preview ${lookClass(look)}`} style={{ "--cap-lift": `${look.pos}%` } as React.CSSProperties} aria-hidden="true">
      {second && <p className="cap-cue cap-cue--second"><span className="cap-line">{second}</span></p>}
      <p className="cap-cue"><span className="cap-line">{text}</span></p>
    </div>
  );
}
