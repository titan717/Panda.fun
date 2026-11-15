import { useCallback, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { ErrorState, Skeleton } from "../components/ui";
import { QuickActions } from "../components/QuickActions";
import { RecoDiagnostics, recoDebug } from "../components/RecoDiagnostics";
import { useRecommendations } from "../lib/reco/useRecommendations";
import { recordFeedback } from "../lib/reco/feedback";
import { getState } from "../lib/store";
import type { RecoSection } from "../lib/reco/sections";
import type { PandaItem } from "../lib/types";
import { TvPoster } from "./TvCards";

const HOLD_MS = 550;

/**
 * TV Search before typing (v1.4.0): Panda Top Picks first, then the other discovery rows. Each row shows the
 * focused title's honest reason. Hold OK (or press Menu) on a title for More like this / Not interested / Hide /
 * Already watched; a short OK still opens the title.
 */
export function TvDiscover({ onOpen }: { onOpen: (item: PandaItem) => void }) {
  const r = useRecommendations();
  const [sheet, setSheet] = useState<PandaItem | null>(null);
  const hold = useRef<{ t: number; el: HTMLElement; fired: boolean } | null>(null);
  const byId = useRef(new Map<string, PandaItem>());
  byId.current = new Map(r.sections.flatMap((s) => s.items.map((i) => [i.id, i] as const)));

  const itemFor = (el: Element | null) => {
    const id = el?.closest<HTMLElement>("[data-reco-id]")?.dataset.recoId;
    return id ? byId.current.get(id) ?? null : null;
  };
  const open = useCallback((item: PandaItem) => {
    recordFeedback(getState().activeProfileId, { id: item.id, type: item.type, kind: "open", genres: item.genres, title: item.title });
    onOpen(item);
  }, [onOpen]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const item = itemFor(e.target as Element);
    if (!item) return;
    if (e.key === "ContextMenu" || e.key === "m" || e.key === "M") { e.preventDefault(); setSheet(item); return; }
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (e.repeat || hold.current) return;
    const el = e.target as HTMLElement;
    hold.current = { el, fired: false, t: window.setTimeout(() => { if (hold.current) hold.current.fired = true; setSheet(item); }, HOLD_MS) };
  };
  const onKeyUp = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" || !hold.current) return;
    const h = hold.current;
    hold.current = null;
    clearTimeout(h.t);
    if (!h.fired) h.el.click();
  };

  return (
    <div className="tv-discover" onKeyDown={onKeyDown} onKeyUp={onKeyUp}
      onContextMenu={(e) => { const item = itemFor(e.target as Element); if (item) { e.preventDefault(); setSheet(item); } }}>
      {r.loading && <DiscoverSkeleton />}
      {r.error && !r.sections.length && <ErrorState compact message={r.error.message} onRetry={r.retry} />}
      {r.sections.map((s, n) => <DiscoverRow key={s.id} section={s} first={n === 0} onOpen={open} />)}
      {r.sections.length > 0 && <p className="tv-discover-hint"><Icon name="info" /> Hold OK on a title for More like this, Not interested or Hide</p>}
      {recoDebug() && <RecoDiagnostics ranked={r.ranked} model={r.model} />}
      {sheet && <QuickActions item={sheet} context={{ kind: "reco" }} onClose={() => setSheet(null)} />}
    </div>
  );
}

function DiscoverRow({ section, first, onOpen }: { section: RecoSection; first: boolean; onOpen: (item: PandaItem) => void }) {
  const [focused, setFocused] = useState<PandaItem | null>(null);
  const reason = focused ? section.reasons?.[focused.id] : undefined;
  return (
    <section className={`tv-row tv-row--poster tv-reco ${first ? "is-first" : ""} tv-reco--${section.id.split("-")[0]}`} data-row aria-labelledby={`reco-${section.id}-title`} id={`reco-${section.id}`}>
      <h2 className="tv-row-title" id={`reco-${section.id}-title`}>
        {section.id === "top-picks" && <span className="tv-reco-mark" aria-hidden="true" />}
        {section.title}
      </h2>
      <p className="tv-reco-why" aria-live="polite">{reason ?? section.note ?? "\u00a0"}</p>
      <div className="tv-row-track" data-scroll-x>
        {section.items.map((it, i) => (
          <div key={it.id} data-reco-id={it.id} onClick={() => onOpen(it)}>
            <TvPoster item={it} id={first && i === 0 ? "res-0" : `reco-${section.id}-${i}`} expand={false} pos={[i + 1, section.items.length]} onFocusItem={setFocused} />
          </div>
        ))}
      </div>
    </section>
  );
}

function DiscoverSkeleton() {
  return (
    <>
      {[0, 1].map((i) => (
        <section key={i} className="tv-row" aria-busy="true">
          <Skeleton className="sk-row-title" />
          <div className="tv-row-track">{Array.from({ length: 7 }, (_, j) => <Skeleton key={j} className="sk-poster" />)}</div>
        </section>
      ))}
    </>
  );
}
