import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Icon } from "../components/Icon";
import { Avatar, EmptyState, toast } from "../components/ui";
import { sortList, LIST_SORTS, type ListFilter, type ListSort } from "../lib/lists";
import { ListCard, NewListCard } from "../components/ListCard";
import { NewListSheet, QuickActions, type ActionContext } from "../components/QuickActions";
import type { PandaItem } from "../lib/types";
import { actions, continueWatching, MAX_LISTS, useAlertsSeenAt, useHistoryMap, useLists, useProfile, useStore, useWatchlist } from "../lib/store";
import { focusFirst } from "../lib/focus";
import { useNav } from "../lib/nav";
import { installedVersion } from "../lib/updates";
import { TvContinue, TvPoster } from "./TvCards";
import { unseen, useCalendar } from "../lib/calendar";

/** TV My Space (spec 10). */
type Tab = "watchlist" | "lists" | "continue";

export function TvMySpace({ initialTab = "watchlist" }: { initialTab?: Tab }) {
  const profile = useProfile();
  const profiles = useStore((s) => s.profiles);
  const list = useWatchlist();
  const cw = continueWatching(useHistoryMap());
  const lists = useLists();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [mode, setMode] = useState<"remove" | "edit" | null>(null);
  const [sheet, setSheet] = useState<{ item: PandaItem; context: ActionContext } | null>(null);
  const [naming, setNaming] = useState(false);
  const [filter, setFilter] = useState<ListFilter>("all");
  const [sort, setSort] = useState<ListSort>("recent");
  const shown = useMemo(() => sortList(list, filter, sort), [list, filter, sort]);
  const count = tab === "watchlist" ? list.length : tab === "continue" ? cw.length : 0;
  const removing = mode === "remove";
  const editing = mode === "edit";
  useEffect(() => { if (!count) setMode(null); }, [count]);
  useEffect(() => { setMode(null); }, [tab]);
  const { go } = useNav();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { if (root.current) focusFirst(root.current); }, []);

  return (
    <div ref={root} className="tv-page tv-myspace" data-scroll-y="row" data-scroll-offset="0.12">
      <header className="tv-ms-head" data-row>
        <div>
          <h1 className="tv-ms-name">{profile?.name ?? "My Space"}</h1>
          <p className="tv-ms-sub">{profile?.kids ? "Kids profile" : "Panda.fun"} • Version {installedVersion()}</p>
        </div>
        <div className="tv-ms-actions">
          <Link href="/settings/updates" id="ms-updates" className="tv-btn" data-hover-focus data-autofocus><Icon name="download" /> Check for Updates</Link>
          <CalendarButton />
          <Link href="/settings" id="ms-settings" className="tv-btn" data-hover-focus><Icon name="settings" /> Help & Settings</Link>
        </div>
      </header>
      <section className="tv-row tv-ms-profiles" data-row aria-label="Profiles">
        <h2 className="tv-row-title">Profiles</h2>
        <div className="tv-row-track" data-scroll-x>
          {profiles.map((p) => (
            <button key={p.id} id={`msp-${p.id}`} className={`tv-ms-profile ${p.id === profile?.id ? "is-current" : ""}`} data-hover-focus
              onClick={() => { if (p.id !== profile?.id) { actions.selectProfile(p.id); go("/", { replace: true }); } }} aria-label={`Switch to ${p.name}`}>
              <Avatar kind={p.avatar} />
              <span>{p.name}</span>
            </button>
          ))}
          {profiles.length < 6 && (
            <Link href="/profiles/new" id="msp-add" className="tv-ms-profile" data-hover-focus aria-label="Add profile">
              <span className="avatar avatar--add"><Icon name="plus" /></span><span>Add</span>
            </Link>
          )}
          <Link href="/profiles/manage" id="msp-edit" className="tv-ms-profile" data-hover-focus aria-label="Edit profiles">
            <span className="avatar avatar--add"><Icon name="edit" /></span><span>Edit</span>
          </Link>
        </div>
      </section>
      <section className="tv-ms-tabs" data-row aria-label="Your lists">
        <div role="tablist" className="tv-tabs">
          <button id="mst-watchlist" role="tab" aria-selected={tab === "watchlist"} className={`tv-tab ${tab === "watchlist" ? "is-selected" : ""}`} onFocus={() => setTab("watchlist")} onClick={() => setTab("watchlist")} data-hover-focus>Watchlist</button>
          <button id="mst-lists" role="tab" aria-selected={tab === "lists"} className={`tv-tab ${tab === "lists" ? "is-selected" : ""}`} onFocus={() => setTab("lists")} onClick={() => setTab("lists")} data-hover-focus>My Lists</button>
          <button id="mst-continue" role="tab" aria-selected={tab === "continue"} className={`tv-tab ${tab === "continue" ? "is-selected" : ""}`} onFocus={() => setTab("continue")} onClick={() => setTab("continue")} data-hover-focus>Continue Watching</button>
        </div>
      </section>
      {count > 0 && (
        <section className="tv-ms-tools" data-row aria-label="List options">
          {tab === "watchlist" && (["all", "movie", "tv"] as const).map((f) => (
            <button key={f} id={`msf-${f}`} className={`tv-chip ${filter === f ? "is-selected" : ""}`} aria-pressed={filter === f} onClick={() => setFilter(f)} data-hover-focus>
              {f === "all" ? "All" : f === "movie" ? "Movies" : "Shows"}
            </button>
          ))}
          {tab === "watchlist" && (
            <button id="ms-sort" className="tv-chip" onClick={() => setSort(LIST_SORTS[(LIST_SORTS.findIndex((x) => x.id === sort) + 1) % LIST_SORTS.length]!.id)} data-hover-focus aria-label={`Sort: ${LIST_SORTS.find((x) => x.id === sort)!.label}. Press to change.`}>
              <Icon name="sort" /> {LIST_SORTS.find((x) => x.id === sort)!.label}
            </button>
          )}
          <button id="ms-edit" className={`tv-chip ${editing ? "is-selected" : ""}`} aria-pressed={editing} onClick={() => setMode((m) => (m === "edit" ? null : "edit"))} data-hover-focus>
            {editing ? <><Icon name="check" /> Done</> : <><Icon name="more" /> Edit</>}
          </button>
          <button id="ms-remove" className={`tv-chip ${removing ? "is-danger" : ""}`} aria-pressed={removing} onClick={() => setMode((m) => (m === "remove" ? null : "remove"))} data-hover-focus>
            {removing ? <><Icon name="check" /> Done</> : <><Icon name="trash" /> Remove items</>}
          </button>
          {removing && <span className="tv-ms-hint">Press OK on a title to remove it</span>}
          {editing && <span className="tv-ms-hint">Press OK on a title for lists, move to top and more</span>}
        </section>
      )}
      <section className="tv-ms-panel" data-row role="tabpanel">
        {tab === "watchlist" && (list.length
          ? shown.length
            ? <div className="tv-grid">{shown.map((it, i) => <TvPoster key={it.id} item={it} id={`msw-${i}`} expand={false}
                onRemove={removing ? () => { actions.toggleWatchlist(it); toast(`Removed ${it.title} from your Watchlist`); } : undefined}
                onOptions={editing ? () => setSheet({ item: it, context: { kind: "watchlist" } }) : undefined} />)}</div>
            : <EmptyState icon="plus" title={filter === "movie" ? "No movies in your watchlist" : "No shows in your watchlist"} sub="Switch the filter to see everything." />
          : <EmptyState icon="plus" title="Your watchlist is empty" sub="Press + on any title to save it here." />)}
        {tab === "continue" && (cw.length
          ? <div className="tv-land-grid">{cw.map((h, i) => <TvContinue key={h.item.id} entry={h} id={`msc-${i}`}
            onRemove={removing ? () => { actions.removeHistory(h.item.id); toast(`Removed ${h.item.title} from Continue Watching`); } : undefined}
            onOptions={editing ? () => setSheet({ item: h.item, context: { kind: "continue", entry: h } }) : undefined} />)}</div>
          : <EmptyState icon="play" title="Start watching to see it here" />)}
        {tab === "lists" && (
          <div className="tv-list-grid">
            {lists.map((l, i) => <ListCard key={l.id} list={l} id={`msl-${i}`} tv />)}
            {lists.length < MAX_LISTS && <NewListCard id="msl-new" tv onClick={() => setNaming(true)} />}
          </div>
        )}
        {tab === "lists" && !lists.length && <p className="tv-ms-hint tv-ms-lists-hint">Make lists like Weekend or Date Night, then save titles to them from any details page.</p>}
      </section>
      {sheet && <QuickActions item={sheet.item} context={sheet.context} onClose={() => setSheet(null)} />}
      {naming && <NewListSheet onClose={() => setNaming(false)} onDone={(id) => go(`/my-list?list=${encodeURIComponent(id)}`)} />}
    </div>
  );
}

/** "Coming Up" with the count of new episodes since the calendar was last opened (v1.1.7). */
function CalendarButton() {
  const cal = useCalendar();
  const n = unseen(cal.fresh, useAlertsSeenAt()).length;
  return (
    <Link href="/calendar" id="ms-calendar" className="tv-btn" data-hover-focus aria-label={n ? `Coming Up, ${n} new` : "Coming Up"}>
      <Icon name="bell" /> Coming Up {n > 0 && <span className="tv-count-badge">{n > 9 ? "9+" : n}</span>}
    </Link>
  );
}
