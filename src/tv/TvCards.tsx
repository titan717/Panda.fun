import { memo, useState } from "react";
import { Link } from "wouter";
import { Icon } from "../components/Icon";
import { Img, TitleArt } from "../components/ui";
import { useDwell, useTitle } from "../lib/hooks";
import { itemBadge, landMeta, runtime, timeLeft, titlePath, watchPath } from "../lib/format";
import type { HistoryEntry } from "../lib/store";
import type { PandaItem } from "../lib/types";

export interface CardFocus { onFocusItem?: (item: PandaItem) => void; pos?: [number, number]; onRemove?: () => void }

/** Spoken label for a card: title, year, kind, rating and position in its row. */
export function cardLabel(item: PandaItem, pos?: [number, number], extra?: string | null) {
  const parts = [item.title, item.year ? String(item.year) : null, item.type === "tv" ? "Series" : "Movie", item.rating ? `Rated ${item.rating.toFixed(1)}` : null, extra ?? null, pos ? `${pos[0]} of ${pos[1]}` : null];
  return parts.filter(Boolean).join(", ");
}

/** Poster card that expands into the wide info card when focused (spec 6.3). */
export const TvPoster = memo(function TvPoster({ item, id, rank, expand = true, onFocusItem, pos, onRemove }: { item: PandaItem; id: string; rank?: number; expand?: boolean } & CardFocus) {
  const [focused, setFocused] = useState(false);
  const settled = useDwell(focused && expand, 350);
  const details = useTitle(settled ? item.type : null, settled ? item.tmdbId : null).data;
  const badge = itemBadge(item);
  const meta = [item.year, details?.certification, item.type === "movie" ? runtime(details?.runtime) : details?.numberOfSeasons ? `${details.numberOfSeasons} Season${details.numberOfSeasons > 1 ? "s" : ""}` : null, ...item.genres.slice(0, 2)].filter(Boolean);
  return (
    <div className={`tv-card-wrap ${rank ? "has-rank" : ""}`}>
      {rank !== undefined && <span className="top10-num" aria-hidden="true">{rank}</span>}
      <Link href={titlePath(item)} id={id} className={`tv-card tv-poster ${focused && expand ? "is-expanded" : ""} ${onRemove ? "is-removable" : ""}`} data-hover-focus
        aria-label={onRemove ? `Remove ${item.title}` : cardLabel(item, pos, rank ? `Number ${rank}` : null)}
        onClick={onRemove ? (e) => { e.preventDefault(); onRemove(); } : undefined}
        onFocus={() => { setFocused(true); onFocusItem?.(item); }} onBlur={() => setFocused(false)}>
        <Img src={item.poster} alt="" title={item.title} className="tv-poster-img" />
        {badge && !onRemove && <span className="poster-badge">{badge}</span>}
        {onRemove && <span className="remove-mark" aria-hidden="true"><Icon name="trash" /></span>}
        {focused && expand && settled && item.backdrop && <Img src={item.backdrop} alt="" title={item.title} className="expand-bg" eager />}
        {focused && expand && (
          <span className="expand-info">
            <span className="expand-badges">
              {item.rating ? <span className="glass-badge"><Icon name="star" /> {item.rating.toFixed(1)}</span> : null}
              {badge && <span className="glass-badge">{badge === "NEWLY ADDED" ? "Newly Added" : badge === "NEW EPISODES" ? "New Episodes" : badge}</span>}
            </span>
            <TitleArt logo={details?.logo ?? item.logo} title={item.title} className="expand-logo" />
            <span className="expand-meta">{meta.join(" • ")}</span>
            <span className="expand-overview">{item.overview}</span>
          </span>
        )}
      </Link>
    </div>
  );
});

/** Landscape card for Latest Episodes style rows (spec 6.5). */
export const TvLandscape = memo(function TvLandscape({ item, id, sub, onFocusItem, pos }: { item: PandaItem; id: string; sub?: string | null } & CardFocus) {
  return (
    <Link href={titlePath(item)} id={id} className="tv-card tv-land" data-hover-focus onFocus={() => onFocusItem?.(item)} aria-label={cardLabel(item, pos, sub)}>
      <span className="tv-land-media"><Img src={item.backdrop} alt="" title={item.title} /></span>
      <span className="tv-land-title">{item.title}</span>
      <span className="tv-land-sub">{sub ?? landMeta(item)}</span>
    </Link>
  );
});

export function continueHref(h: HistoryEntry) {
  const base = watchPath(h.item.type, h.item.tmdbId, h.season, h.episode);
  return h.position > 0 ? `${base}${base.includes("?") ? "&" : "?"}t=${h.position}` : base;
}

export function continueSub(h: HistoryEntry) {
  if (h.upNext && h.season && h.episode) return `Next Episode • S${h.season} E${h.episode}`;
  if (h.item.type === "tv" && h.season && h.episode) {
    const left = timeLeft(h.position, h.duration);
    return `S${h.season} E${h.episode}${left ? ` • ${left}` : ""}`;
  }
  return timeLeft(h.position, h.duration);
}

export const TvContinue = memo(function TvContinue({ entry, id, onFocusItem, onRemove }: { entry: HistoryEntry; id: string } & CardFocus) {
  const pct = entry.duration ? Math.min(100, (entry.position / entry.duration) * 100) : 0;
  return (
    <Link href={continueHref(entry)} id={id} className={`tv-card tv-land ${onRemove ? "is-removable" : ""}`} data-hover-focus onFocus={() => onFocusItem?.(entry.item)}
      onClick={onRemove ? (e) => { e.preventDefault(); onRemove(); } : undefined}
      aria-label={onRemove ? `Remove ${entry.item.title} from Continue Watching` : `${entry.upNext ? "Play" : "Resume"} ${entry.item.title}${continueSub(entry) ? `, ${continueSub(entry)}` : ""}`}>
      <span className="tv-land-media">
        <Img src={entry.item.backdrop} alt="" title={entry.item.title} />
        <span className="progress"><span style={{ width: `${pct}%` }} /></span>
        {onRemove ? <span className="remove-mark" aria-hidden="true"><Icon name="trash" /></span> : <Icon name="play" className="tv-land-play" />}
      </span>
      <span className="tv-land-title">{entry.item.title}</span>
      <span className="tv-land-sub">{continueSub(entry)}</span>
    </Link>
  );
});
