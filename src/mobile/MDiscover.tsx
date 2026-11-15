import { useCallback, useRef, useState } from "react";
import { Link } from "wouter";
import { ErrorState, Img, Skeleton } from "../components/ui";
import { QuickActions } from "../components/QuickActions";
import { RecoDiagnostics, recoDebug } from "../components/RecoDiagnostics";
import { useRecommendations } from "../lib/reco/useRecommendations";
import { recordFeedback } from "../lib/reco/feedback";
import { logOpened, useRecoImpressions } from "../lib/reco/metrics";
import { getState } from "../lib/store";
import { prefetchItem } from "../lib/prefetch";
import { titlePath } from "../lib/format";
import type { RecoSection } from "../lib/reco/sections";
import type { PandaItem } from "../lib/types";
import { Icon } from "../components/Icon";

/**
 * Mobile Search before typing (v1.4.0): Panda Top Picks first, then the other discovery rows. Each personalised
 * card shows its real reason; press and hold (or tap ⋮) for More like this / Not interested / Hide / Already watched.
 */
export function MDiscover({ onOpen }: { onOpen: (item: PandaItem) => void }) {
  const r = useRecommendations();
  const [sheet, setSheet] = useState<PandaItem | null>(null);
  const open = useCallback((item: PandaItem) => {
    recordFeedback(getState().activeProfileId, { id: item.id, type: item.type, kind: "open", genres: item.genres, title: item.title });
    logOpened(item.id);
    onOpen(item);
  }, [onOpen]);
  const rootRef = useRef<HTMLDivElement>(null);
  useRecoImpressions(rootRef, r.sections);
  return (
    <div className="m-discover" ref={rootRef}>
      {r.loading && [0, 1].map((i) => <section key={i} className="m-section"><Skeleton className="sk-row-title" /><div className="m-row-track">{[0, 1, 2, 3].map((j) => <Skeleton key={j} className="m-poster sk-poster-m" />)}</div></section>)}
      {r.error && !r.sections.length && <ErrorState compact message={r.error.message} onRetry={r.retry} />}
      {r.sections.map((s) => s.id === "top-picks"
        ? <TopPicks key={s.id} section={s} onOpen={open} onMenu={setSheet} />
        : <Row key={s.id} section={s} onOpen={open} onMenu={setSheet} />)}
      {recoDebug() && <RecoDiagnostics ranked={r.ranked} model={r.model} />}
      {sheet && <QuickActions item={sheet} context={{ kind: "reco" }} onClose={() => setSheet(null)} />}
    </div>
  );
}

/**
 * Rows reorder while the remaining sources load. With scroll snapping Chrome keeps the previously snapped card in
 * view, which left rows scrolled to the middle on first paint. Remounting the track when the order changes starts
 * it at the first card again.
 */
const trackKey = (s: RecoSection) => s.items.map((i) => i.id).join("|");

type RowProps = { section: RecoSection; onOpen: (i: PandaItem) => void; onMenu: (i: PandaItem) => void };

function TopPicks({ section, onOpen, onMenu }: RowProps) {
  return (
    <section className="m-section m-reco m-reco--top" data-reco-surface={section.id} aria-labelledby="reco-top-title">
      <div className="m-row-head"><h2 className="m-row-title" id="reco-top-title"><span className="m-reco-mark" aria-hidden="true" />{section.title}</h2></div>
      {section.note && <p className="m-reco-note">{section.note}</p>}
      <div className="m-row-track m-reco-top-track" key={trackKey(section)}>
        {section.items.map((it) => (
          <div key={it.id} className="m-reco-top-card" data-reco-id={it.id}>
            <Link href={titlePath(it)} className="m-reco-top-link" aria-label={`${it.title}${section.reasons?.[it.id] ? `. ${section.reasons[it.id]}` : ""}`}
              onPointerDown={() => prefetchItem(it)} onClick={() => onOpen(it)} onContextMenu={(e) => { e.preventDefault(); onMenu(it); }}>
              <span className="m-reco-top-media"><Img src={it.backdrop ?? it.poster} alt="" title={it.title} /></span>
              <span className="m-reco-top-title">{it.title}</span>
              {section.reasons?.[it.id] && <span className="m-reco-reason">{section.reasons[it.id]}</span>}
            </Link>
            <button className="m-reco-more icon-btn" aria-label={`Options for ${it.title}`} onClick={() => onMenu(it)}><Icon name="more" /></button>
          </div>
        ))}
      </div>
    </section>
  );
}

function Row({ section, onOpen, onMenu }: RowProps) {
  return (
    <section className="m-section m-reco" data-reco-surface={section.id} aria-labelledby={`reco-${section.id}-title`}>
      <div className="m-row-head"><h2 className="m-row-title" id={`reco-${section.id}-title`}>{section.title}</h2></div>
      {section.note && <p className="m-reco-note">{section.note}</p>}
      <div className="m-row-track" key={trackKey(section)}>
        {section.items.map((it) => (
          <Link key={it.id} data-reco-id={it.id} href={titlePath(it)} className="m-poster m-reco-poster" aria-label={`${it.title}${section.reasons?.[it.id] ? `. ${section.reasons[it.id]}` : ""}`}
            onPointerDown={() => prefetchItem(it)} onClick={() => onOpen(it)} onContextMenu={(e) => { e.preventDefault(); onMenu(it); }}>
            <span className="m-poster-media"><Img src={it.poster} alt="" title={it.title} /></span>
            {section.reasons?.[it.id] && <span className="m-reco-reason">{section.reasons[it.id]}</span>}
          </Link>
        ))}
      </div>
    </section>
  );
}
