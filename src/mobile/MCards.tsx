import { memo, useState } from "react";
import { Link } from "wouter";
import { Icon } from "../components/Icon";
import { Img, toast } from "../components/ui";
import { Sheet, SheetItem } from "../components/Sheet";
import { isUpcoming, itemBadge, landMeta, titlePath } from "../lib/format";
import { actions, getState, selectData, type HistoryEntry } from "../lib/store";
import { useNav } from "../lib/nav";
import { continueHref, continueSub } from "../tv/TvCards";
import type { PandaItem } from "../lib/types";

/** Mobile poster (spec 12.3–12.5). */
export const MPoster = memo(function MPoster({ item, rank, top10, className }: { item: PandaItem; rank?: number; top10?: boolean; className?: string }) {
  const badge = itemBadge(item);
  return (
    <Link href={titlePath(item)} className={`m-poster ${rank ? "has-rank" : ""} ${className ?? ""}`} aria-label={item.title}>
      {rank !== undefined && <span className="m-rank" aria-hidden="true">{rank}</span>}
      <span className="m-poster-media">
        <Img src={item.poster} alt="" title={item.title} />
        {top10 && <span className="m-top10-tag">TOP<br />10</span>}
        {badge && <span className="m-poster-badge">{badge}</span>}
      </span>
    </Link>
  );
});

function ItemMenu({ item, entry, onClose }: { item: PandaItem; entry?: HistoryEntry; onClose: () => void }) {
  const { go } = useNav();
  const inList = selectData(getState()).watchlist.some((i) => i.id === item.id);
  return (
    <Sheet title={item.title} onClose={onClose}>
      <SheetItem icon={<Icon name="info" />} label="Details & More" onClick={() => { onClose(); go(titlePath(item)); }} />
      <SheetItem icon={<Icon name={inList ? "check" : "plus"} />} label={inList ? "Remove from Watchlist" : "Add to Watchlist"} onClick={() => {
        const added = actions.toggleWatchlist(item); toast(added ? "Added to Watchlist" : "Removed from Watchlist"); onClose();
      }} />
      {entry && <SheetItem icon={<Icon name="trash" />} label="Remove from Continue Watching" danger onClick={() => { actions.removeHistory(item.id); toast("Removed from Continue Watching"); onClose(); }} />}
    </Sheet>
  );
}

/** Landscape card with title below and ⋮ menu (spec 12.3). */
export const MLand = memo(function MLand({ item, sub }: { item: PandaItem; sub?: string | null }) {
  const [menu, setMenu] = useState(false);
  return (
    <div className="m-land">
      <Link href={titlePath(item)} className="m-land-link" aria-label={item.title}>
        <span className="m-land-media"><Img src={item.backdrop} alt="" title={item.title} />{!isUpcoming(item) && <Icon name="play" className="m-land-play" />}</span>
        <span className="m-land-title">{item.title}</span>
        <span className="m-land-sub">{sub ?? landMeta(item)}</span>
      </Link>
      <button className="m-more" aria-label={`More options for ${item.title}`} onClick={() => setMenu(true)}><Icon name="more" strokeWidth={3} /></button>
      {menu && <ItemMenu item={item} onClose={() => setMenu(false)} />}
    </div>
  );
});

export const MContinue = memo(function MContinue({ entry }: { entry: HistoryEntry }) {
  const [menu, setMenu] = useState(false);
  const pct = entry.duration ? Math.min(100, (entry.position / entry.duration) * 100) : 0;
  return (
    <div className="m-land">
      <Link href={continueHref(entry)} className="m-land-link" aria-label={`${entry.upNext ? "Play" : "Resume"} ${entry.item.title}, ${continueSub(entry) ?? ""}`}>
        <span className="m-land-media">
          <Img src={entry.item.backdrop} alt="" title={entry.item.title} />
          <Icon name="play" className="m-land-play" />
          <span className="progress"><span style={{ width: `${pct}%` }} /></span>
        </span>
        <span className="m-land-title">{entry.item.title}</span>
        <span className="m-land-sub">{continueSub(entry)}</span>
      </Link>
      <button className="m-more" aria-label={`More options for ${entry.item.title}`} onClick={() => setMenu(true)}><Icon name="more" strokeWidth={3} /></button>
      {menu && <ItemMenu item={entry.item} entry={entry} onClose={() => setMenu(false)} />}
    </div>
  );
});
