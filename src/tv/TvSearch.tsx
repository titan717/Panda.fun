import { useEffect, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { EmptyState, ErrorState, Skeleton } from "../components/ui";
import { SEARCH_SORTS, useSearchState, type SearchFilter } from "../lib/useSearchState";
import { useLocation } from "wouter";
import { useGenres } from "../lib/hooks";
import { useProfile } from "../lib/store";
import { focusEl } from "../lib/focus";
import { TvPoster } from "./TvCards";

const FILTERS: { id: SearchFilter; label: string }[] = [{ id: "all", label: "All" }, { id: "movie", label: "Movies" }, { id: "tv", label: "Shows" }];

/** TV Search (spec 8). */
export function TvSearch() {
  const s = useSearchState();
  const input = useRef<HTMLInputElement>(null);
  // Remote-friendly field (D-45): landing on Search focuses the field without popping the on-screen keyboard;
  // OK opens it, Enter/Search on the keyboard closes it and jumps to the first result.
  const [editing, setEditing] = useState(false);
  useEffect(() => { focusEl(input.current); }, []);
  const openKeyboard = () => {
    const el = input.current;
    if (!el) return;
    setEditing(true);
    requestAnimationFrame(() => { el.blur(); el.focus(); });
  };
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (!editing && !s.query) { openKeyboard(); return; }
    s.commit();
    setEditing(false);
    const first = document.getElementById("res-0");
    if (first && s.active) focusEl(first); else openKeyboard();
  };
  const grid = s.active ? s.results : s.popular;
  const [, go] = useLocation();
  const genres = useGenres();
  const kids = Boolean(useProfile()?.kids);
  const browse = (genres.data?.movie ?? []).filter((g) => !kids || g.name === "Animation" || g.name === "Family");
  const sortLabel = SEARCH_SORTS.find((x) => x.id === s.sort)?.label ?? "Best match";
  const nextSort = () => { const i = SEARCH_SORTS.findIndex((x) => x.id === s.sort); s.setSort(SEARCH_SORTS[(i + 1) % SEARCH_SORTS.length]!.id); };
  const note = s.active && !s.stale ? (s.interpreted ? `Showing ${s.interpreted}` : s.corrected ? `Showing results for “${s.corrected}”` : s.people.length ? `Including titles with ${s.people.join(", ")}` : null) : null;

  return (
    <div className="tv-page tv-search" data-scroll-y="item" data-scroll-offset="0.3">
      <section className="tv-search-bar">
        {s.voiceSupported && (
          <button id="search-mic" className={`tv-mic ${s.listening ? "is-listening" : ""}`} onClick={s.startVoice} aria-label="Search by voice" data-hover-focus><Icon name="mic" /></button>
        )}
        <label className="tv-search-field">
          <Icon name="search" />
          <input ref={input} id="search-input" type="search" value={s.query} placeholder={s.listening ? "Listening…" : "Search"} aria-label="Search movies and shows" autoComplete="off" spellCheck={false}
            inputMode={editing ? "search" : "none"} enterKeyHint="search" onChange={(e) => s.setQuery(e.target.value)} onKeyDown={onKey}
            onClick={() => { if (!editing) openKeyboard(); }} onBlur={() => setEditing(false)} />
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
      {!s.active && browse.length > 0 && (
        <>
          <h2 className="tv-section-title">Browse by Genre</h2>
          <section className="tv-chips tv-chips--genres" aria-label="Browse by genre">
            {browse.map((g) => (
              <button key={g.id} id={`genre-${g.id}`} className="tv-chip" onClick={() => go(`/browse/movie?genre=${g.id}`)} data-hover-focus>{g.name}</button>
            ))}
          </section>
        </>
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
      <h2 className="tv-section-title">{s.active ? `Results for “${s.debounced.trim()}”` : "Popular Searches"}</h2>
      {note && <p className="tv-search-note" role="status">{note}</p>}
      {s.active && s.error && !s.results.length ? <ErrorState compact message={s.error.message} onRetry={s.retry} /> : null}
      {s.active && !s.loading && !s.error && !s.stale && s.results.length === 0 && (
        <EmptyState icon="search" title={`No results for “${s.debounced.trim()}”`} sub="Check the spelling or try a different title, actor or genre." />
      )}
      <section className={`tv-grid ${s.stale ? "is-stale" : ""}`} aria-busy={s.loading || s.popularLoading}>
        {(s.loading || (!s.active && s.popularLoading)) && Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="sk-poster" />)}
        {grid.map((it, i) => (
          <div key={it.id} onClick={() => s.commit()}>
            <TvPoster item={it} id={`res-${i}`} expand={false} />
          </div>
        ))}
      </section>
    </div>
  );
}
