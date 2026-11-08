import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Icon } from "../components/Icon";
import { Avatar, EmptyState, toast } from "../components/ui";
import { sortList, LIST_SORTS, type ListFilter, type ListSort } from "../lib/lists";
import { actions, continueWatching, useHistoryMap, useProfile, useStore, useWatchlist } from "../lib/store";
import { focusFirst } from "../lib/focus";
import { useNav } from "../lib/nav";
import { installedVersion } from "../lib/updates";
import { TvContinue, TvPoster } from "./TvCards";

/** TV My Space (spec 10). */
export function TvMySpace({ initialTab = "watchlist" }: { initialTab?: "watchlist" | "continue" }) {
  const profile = useProfile();
  const profiles = useStore((s) => s.profiles);
  const list = useWatchlist();
  const cw = continueWatching(useHistoryMap());
  const [tab, setTab] = useState(initialTab);
  const [filter, setFilter] = useState<ListFilter>("all");
  const [sort, setSort] = useState<ListSort>("recent");
  const [removing, setRemoving] = useState(false);
  const shown = useMemo(() => sortList(list, filter, sort), [list, filter, sort]);
  const count = tab === "watchlist" ? list.length : cw.length;
  useEffect(() => { if (!count) setRemoving(false); }, [count]);
  useEffect(() => { setRemoving(false); }, [tab]);
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
          <button id="ms-remove" className={`tv-chip ${removing ? "is-danger" : ""}`} aria-pressed={removing} onClick={() => setRemoving((r) => !r)} data-hover-focus>
            {removing ? <><Icon name="check" /> Done</> : <><Icon name="trash" /> Remove items</>}
          </button>
          {removing && <span className="tv-ms-hint">Press OK on a title to remove it</span>}
        </section>
      )}
      <section className="tv-ms-panel" data-row role="tabpanel">
        {tab === "watchlist" && (list.length
          ? shown.length
            ? <div className="tv-grid">{shown.map((it, i) => <TvPoster key={it.id} item={it} id={`msw-${i}`} expand={false}
                onRemove={removing ? () => { actions.toggleWatchlist(it); toast(`Removed ${it.title} from your Watchlist`); } : undefined} />)}</div>
            : <EmptyState icon="plus" title={filter === "movie" ? "No movies in your watchlist" : "No shows in your watchlist"} sub="Switch the filter to see everything." />
          : <EmptyState icon="plus" title="Your watchlist is empty" sub="Press + on any title to save it here." />)}
        {tab === "continue" && (cw.length
          ? <div className="tv-land-grid">{cw.map((h, i) => <TvContinue key={h.item.id} entry={h} id={`msc-${i}`}
            onRemove={removing ? () => { actions.removeHistory(h.item.id); toast(`Removed ${h.item.title} from Continue Watching`); } : undefined} />)}</div>
          : <EmptyState icon="play" title="Start watching to see it here" />)}
      </section>
    </div>
  );
}
