import { useEffect, useRef } from "react";
import { Icon } from "../components/Icon";
import { EmptyState, ErrorState, Skeleton } from "../components/ui";
import { SEARCH_SORTS, useSearchState, type SearchFilter } from "../lib/useSearchState";
import { focusEl, recallFocusWhenReady, useFocusMemory } from "../lib/focus";
import { useRemoteField } from "../lib/remoteInput";
import { TvPoster } from "./TvCards";
import { TvDiscover } from "./TvDiscover";

const FILTERS: { id: SearchFilter; label: string }[] = [{ id: "all", label: "All" }, { id: "movie", label: "Movies" }, { id: "tv", label: "Shows" }];

/** TV Search (spec 8). */
export function TvSearch() {
  // v1.4.0: before typing, Search is the discovery page (Panda Top Picks first, src/tv/TvDiscover.tsx)
  const s = useSearchState("all");
  // Remote-friendly field (D-45, v1.3.2 src/lib/remoteInput.ts): landing on Search focuses the field without popping
  // the on-screen keyboard; OK opens it (Gboard in the Android app), Enter/Search on the keyboard closes it, runs the
  // search and moves to the first result. Down from the field reaches the filters and results.
  const field = useRemoteField(true, () => {
    s.commit();
    const first = document.getElementById("res-0");
    if (first && s.active) focusEl(first);
  }, { mode: "search" });
  const input = field.ref;
  // Back from a title returns to the card it was opened from (focus memory per history entry, v1.4.0); a fresh
  // visit starts in the field. Discovery rows load after mount, so the remembered card is awaited briefly.
  const root = useRef<HTMLDivElement>(null);
  useFocusMemory(root);
  useEffect(() => recallFocusWhenReady(root.current, () => focusEl(input.current)), [input]);
  const sortLabel = SEARCH_SORTS.find((x) => x.id === s.sort)?.label ?? "Best match";
  const nextSort = () => { const i = SEARCH_SORTS.findIndex((x) => x.id === s.sort); s.setSort(SEARCH_SORTS[(i + 1) % SEARCH_SORTS.length]!.id); };
  const note = s.active && !s.stale ? (s.interpreted ? `Showing ${s.interpreted}` : s.corrected ? `Showing results for “${s.corrected}”` : s.people.length ? `Including titles with ${s.people.join(", ")}` : null) : null;

  return (
    <div ref={root} className="tv-page tv-search" data-scroll-y="item" data-scroll-offset="0.3">
      <section className={`tv-search-bar ${field.editing ? "is-editing" : ""}`}>
        {s.voiceSupported && (
          <button id="search-mic" className={`tv-mic ${s.listening ? "is-listening" : ""}`} onClick={s.startVoice} aria-label="Search by voice" data-hover-focus><Icon name="mic" /></button>
        )}
        <label className={`tv-search-field ${field.editing ? "is-editing" : ""}`}>
          <Icon name="search" />
          <input ref={input} id="search-input" type="search" value={s.query} placeholder={s.listening ? "Listening…" : field.editing ? "Type a title, actor or genre" : "Search movies and shows"} aria-label="Search movies and shows" autoComplete="off" spellCheck={false}
            enterKeyHint="search" onChange={(e) => s.setQuery(e.target.value)} {...field.props} />
          {/* v1.4.1: what OK does here, shown only while the field has focus */}
          <span className="tv-search-hint" aria-hidden="true">{field.editing ? "Press Search on the keyboard when done" : <><kbd>OK</kbd> to type</>}</span>
        </label>
        {s.query && (
          <button id="search-clear" className="tv-search-clear" onClick={() => { s.setQuery(""); focusEl(input.current); }} aria-label="Clear search" data-hover-focus>
            <Icon name="close" /> Clear
          </button>
        )}
      </section>
      {!s.active && s.recents.length > 0 && (
        <section className="tv-chips" aria-label="Recent searches">
          {s.recents.slice(0, 6).map((r, i) => (
            <button key={r} id={`recent-${i}`} className="tv-chip" onClick={() => s.setQuery(r)} data-hover-focus><Icon name="clock" /> {r}</button>
          ))}
          <button id="recent-clear" className="tv-chip tv-chip--quiet" onClick={() => { s.clearRecents(); focusEl(input.current); }} data-hover-focus><Icon name="close" /> Clear history</button>
        </section>
      )}
      {s.active && (
        <section className="tv-chips" aria-label="Filter results">
          {FILTERS.map((f) => (
            <button key={f.id} id={`filter-${f.id}`} className={`tv-chip ${s.filter === f.id ? "is-selected" : ""}`} aria-pressed={s.filter === f.id} onClick={() => s.setFilter(f.id)} data-hover-focus>{f.label}</button>
          ))}
          {s.genres.length > 1 && <span className="tv-chip-sep" aria-hidden="true" />}
          {s.genres.length > 1 && s.genres.map((g) => (
            <button key={g} id={`sgenre-${g}`} className={`tv-chip ${s.genre === g ? "is-selected" : ""}`} aria-pressed={s.genre === g} onClick={() => s.setGenre(s.genre === g ? null : g)} data-hover-focus>{g}</button>
          ))}
          <button id="search-sort" className="tv-chip" onClick={nextSort} aria-label={`Sort: ${sortLabel}. Press to change.`} data-hover-focus><Icon name="sort" /> {sortLabel}</button>
        </section>
      )}
      {!s.active && <TvDiscover onOpen={s.openTitle} />}
      {s.active && (
        <>
          <h2 className="tv-section-title">{`Results for “${s.debounced.trim()}”`}</h2>
          {note && <p className="tv-search-note" role="status">{note}</p>}
          {s.error && !s.results.length ? <ErrorState compact message={s.error.message} onRetry={s.retry} /> : null}
          {!s.loading && !s.error && !s.stale && s.results.length === 0 && (
            <EmptyState icon="search" title={`No results for “${s.debounced.trim()}”`} sub="Check the spelling or try a different title, actor or genre." />
          )}
          <section className={`tv-grid ${s.stale ? "is-stale" : ""}`} aria-busy={s.loading}>
            {s.loading && Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="sk-poster" />)}
            {s.results.map((it, i) => (
              <div key={it.id} onClick={() => s.openTitle(it)}>
                <TvPoster item={it} id={`res-${i}`} expand={false} />
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
