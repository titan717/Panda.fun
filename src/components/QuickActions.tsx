import { useState } from "react";
import { Icon } from "./Icon";
import { Sheet, SheetItem } from "./Sheet";
import { toast } from "./ui";
import { actions, getState, MAX_LISTS, selectData, useLists, useStore, type HistoryEntry } from "../lib/store";
import { isUpcoming, titlePath, watchPath } from "../lib/format";
import { continueHref } from "../tv/TvCards";
import { useNav } from "../lib/nav";
import type { PandaItem } from "../lib/types";

export const LIST_SUGGESTIONS = ["Weekend", "Date Night", "Family Time", "Rewatch", "Must See"];

/** Where the sheet was opened from, so it can offer "Move to top" / "Remove from …" for that list. */
export type ActionContext = { kind: "watchlist" } | { kind: "list"; listId: string } | { kind: "continue"; entry: HistoryEntry } | null;

/**
 * Quick actions for one title (Watchlist 2.0): play, details, Watchlist and every custom list as
 * checkboxes, a new list, mark as watched, and the context's own remove / move-to-top.
 */
export function QuickActions({ item, context = null, onClose }: { item: PandaItem; context?: ActionContext; onClose: () => void }) {
  const { go } = useNav();
  const lists = useLists();
  const inWatchlist = useStore((s) => selectData(s).watchlist.some((i) => i.id === item.id));
  const [naming, setNaming] = useState(false);
  const entry = context?.kind === "continue" ? context.entry : selectData(getState()).history[item.id];
  const resume = entry && !entry.completed && (entry.position > 30 || entry.upNext) ? entry : null;
  const upcoming = isUpcoming(item);
  const contextList = context?.kind === "list" ? lists.find((l) => l.id === context.listId) ?? null : null;

  if (naming) return <NewListSheet first={item} onClose={() => setNaming(false)} onDone={onClose} />;

  return (
    <Sheet title={item.title} onClose={onClose} className="qa-sheet">
      {!upcoming && (
        <SheetItem icon={<Icon name="play" />} label={resume ? "Resume" : "Play"} onClick={() => { onClose(); go(resume ? continueHref(resume) : watchPath(item.type, item.tmdbId)); }} />
      )}
      <SheetItem icon={<Icon name="info" />} label="Details & More" onClick={() => { onClose(); go(titlePath(item)); }} />
      {context?.kind === "watchlist" && (
        <SheetItem icon={<Icon name="chevronUp" />} label="Move to top" onClick={() => { actions.bumpWatchlist(item.id); toast("Moved to the top of your Watchlist"); onClose(); }} />
      )}
      <p className="sheet-group">Save to</p>
      <CheckItem label="Watchlist" checked={inWatchlist} onClick={() => { const added = actions.toggleWatchlist(item); toast(added ? "Added to Watchlist" : "Removed from Watchlist"); }} />
      {lists.map((l) => (
        <CheckItem key={l.id} label={l.name} checked={l.items.some((i) => i.id === item.id)}
          onClick={() => { const added = actions.toggleInList(l.id, item); toast(added ? `Added to ${l.name}` : `Removed from ${l.name}`); }} />
      ))}
      {lists.length < MAX_LISTS && <SheetItem icon={<Icon name="plus" />} label="New list…" onClick={() => setNaming(true)} />}
      <p className="sheet-group">More</p>
      {!upcoming && <SheetItem icon={<Icon name="check" />} label="Mark as watched" onClick={() => { actions.markWatched(item); toast(`Marked ${item.title} as watched`); onClose(); }} />}
      {contextList && (
        <SheetItem icon={<Icon name="trash" />} label={`Remove from ${contextList.name}`} danger onClick={() => { actions.toggleInList(contextList.id, item); toast(`Removed from ${contextList.name}`); onClose(); }} />
      )}
      {context?.kind === "continue" && (
        <SheetItem icon={<Icon name="trash" />} label="Remove from Continue Watching" danger onClick={() => { actions.removeHistory(item.id); toast("Removed from Continue Watching"); onClose(); }} />
      )}
    </Sheet>
  );
}

/** The details page "+" once a profile has lists: Watchlist and every list as checkboxes, plus a new list. */
export function SaveToSheet({ item, onClose }: { item: PandaItem; onClose: () => void }) {
  const lists = useLists();
  const inWatchlist = useStore((s) => selectData(s).watchlist.some((i) => i.id === item.id));
  const [naming, setNaming] = useState(false);
  if (naming) return <NewListSheet first={item} onClose={() => setNaming(false)} onDone={onClose} />;
  return (
    <Sheet title={`Save ${item.title} to`} onClose={onClose} className="qa-sheet">
      <CheckItem label="Watchlist" checked={inWatchlist} onClick={() => { const added = actions.toggleWatchlist(item); toast(added ? "Added to Watchlist" : "Removed from Watchlist"); }} />
      {lists.map((l) => (
        <CheckItem key={l.id} label={l.name} checked={l.items.some((i) => i.id === item.id)}
          onClick={() => { const added = actions.toggleInList(l.id, item); toast(added ? `Added to ${l.name}` : `Removed from ${l.name}`); }} />
      ))}
      {lists.length < MAX_LISTS && <SheetItem icon={<Icon name="plus" />} label="New list…" onClick={() => setNaming(true)} />}
      <SheetItem icon={<Icon name="check" />} label="Done" onClick={onClose} />
    </Sheet>
  );
}

function CheckItem({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button className={`sheet-item qa-check ${checked ? "is-on" : ""}`} role="menuitemcheckbox" aria-checked={checked} onClick={onClick} data-hover-focus>
      <span className="qa-box" aria-hidden="true">{checked && <Icon name="check" />}</span><span>{label}</span>
    </button>
  );
}

/** Name a new list (or rename one): a text field plus one-tap suggestions, which matter most with a TV remote. */
export function NewListSheet({ first, rename, onClose, onDone }: { first?: PandaItem; rename?: { id: string; name: string }; onClose: () => void; onDone?: (listId: string) => void }) {
  const [name, setName] = useState(rename?.name ?? "");
  const lists = useLists();
  const used = new Set(lists.map((l) => l.name.toLowerCase()));
  const save = (value: string) => {
    const v = value.trim();
    if (!v) { toast("Give your list a name"); return; }
    if (rename) { actions.renameList(rename.id, v); toast("List renamed"); onClose(); onDone?.(rename.id); return; }
    const list = actions.createList(v, first);
    if (!list) { toast(`You can have up to ${MAX_LISTS} lists`); onClose(); return; }
    toast(first ? `Added to ${list.name}` : `Created ${list.name}`);
    onClose();
    onDone?.(list.id);
  };
  return (
    <Sheet title={rename ? "Rename list" : "New list"} onClose={onClose} className="qa-sheet">
      <form className="qa-form" onSubmit={(e) => { e.preventDefault(); save(name); }}>
        <input className="field-input qa-input" value={name} maxLength={32} placeholder="List name" aria-label="List name" autoFocus
          onChange={(e) => setName(e.target.value)} data-hover-focus enterKeyHint="done" />
        <button type="submit" className="btn btn--primary" data-hover-focus>{rename ? "Save" : "Create"}</button>
      </form>
      {!rename && (
        <div className="qa-suggest" role="group" aria-label="Suggested names">
          {LIST_SUGGESTIONS.filter((s) => !used.has(s.toLowerCase())).map((s) => (
            <button key={s} className="m-chip qa-chip" onClick={() => save(s)} data-hover-focus>{s}</button>
          ))}
        </div>
      )}
    </Sheet>
  );
}
