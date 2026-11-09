import { useEffect, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { Img } from "../components/ui";
import { bufferPct, TTFF_DEFAULT_MS } from "../lib/player2";
import { sourceName } from "../lib/player";
import { ttffStats } from "../lib/ttff";
import type { SourceId } from "../lib/types";

/**
 * First-frames screen (v1.2.6, MASTER V5 §1, D-150): dimmed backdrop, top bar (back, show name,
 * "Season X, Episode Y · title") and a centred "Buffering the first seconds…" with a percentage
 * that reaches 100 % when the source reports it is ready, then fades out.
 */
export function PlayerLoading({ backdrop, title, line, sourceId, ready, touch, onBack }: {
  backdrop?: string | null; title: string; line?: string | null; sourceId?: SourceId | null; ready: boolean; touch: boolean; onBack: () => void;
}) {
  const t0 = useRef(Date.now());
  const sourceAt = useRef<number | null>(sourceId ? Date.now() : null);
  const [now, setNow] = useState(Date.now());
  const [gone, setGone] = useState(false);
  // a new source restarts its estimate (the backdrop and bar stay)
  useEffect(() => { sourceAt.current = sourceId ? Date.now() : null; if (!ready) setGone(false); }, [sourceId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (ready) { const id = setTimeout(() => setGone(true), 420); return () => clearTimeout(id); }
    setGone(false);
    const id = setInterval(() => setNow(Date.now()), 120);
    return () => clearInterval(id);
  }, [ready]);
  if (gone) return null;
  const median = sourceId ? (ttffStats()[sourceId]?.median ?? TTFF_DEFAULT_MS[sourceId] ?? null) : null;
  const pct = bufferPct(now - (sourceAt.current ?? t0.current), median, Boolean(sourceId), ready);
  return (
    <div className={`player-loading ${ready ? "is-done" : ""}`} id="pl-loading">
      {backdrop && <Img src={backdrop} alt="" title="" className="player-loading-bg" />}
      <div className="pll-top">
        {touch && <button id="pll-back" className="pll-back" onClick={onBack} aria-label="Back"><Icon name="back" /></button>}
        <div className="pll-title"><strong>{title}</strong>{line && <span>{line}</span>}</div>
      </div>
      <div className="pll-center" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Buffering the first seconds">
        <p className="pll-label">{sourceId ? "Buffering the first seconds…" : "Finding the best source…"}</p>
        <p className="pll-pct">{pct}%</p>
        <span className="pll-bar" aria-hidden="true"><span style={{ transform: `scaleX(${pct / 100})` }} /></span>
        {sourceId && <p className="pll-src">from {sourceName(sourceId)}</p>}
      </div>
    </div>
  );
}
