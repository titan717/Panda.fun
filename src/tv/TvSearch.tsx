import { useEffect, useRef } from "react";
import { Icon } from "../components/Icon";
import { EmptyState, ErrorState, Skeleton } from "../components/ui";
import { useSearchState, type SearchFilter } from "../lib/useSearchState";
import { focusEl } from "../lib/focus";
import { TvPoster } from "./TvCards";

const FILTERS: { id: SearchFilter; label: string }[] = [{ id: "all", label: "All" }, { id: "movie", label: "Movies" }, { id: "tv", label: "Shows" }];

/** TV Search (spec 8). */
export function TvSearch() {
  const s = useSearchState();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { focusEl(input.current); }, []);
  const grid = s.active ? s.results : s.popular;

  return (
    <div className="tv-page tv-search" data-scroll-y="item" data-scroll-offset="0.3">
      <section className="tv-search-bar">
        {s.voiceSupported && (
          <button id="search-mic" className={`tv-mic ${s.listening ? "is-listening" : ""}`} onClick={s.startVoice} aria-label="Search by voice" data-hover-focus><Icon name="mic" /></button>
        )}
        <label className="tv-search-field">
          <Icon name="search" />
          <input ref={input} id="search-input" type="search" value={s.query} placeholder="Search" aria-label="Search movies and shows" autoComplete="off" spellCheck={false}
            enterKeyHint="search" onChange={(e) => s.setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") s.commit(); }} />
        </label>
      </section>
      {!s.active && s.recents.length > 0 && (
        <section className="tv-chips" aria-label="Recent searches">
          {s.recents.slice(0, 6).map((r, i) => (
            <button key={r} id={`recent-${i}`} className="tv-chip" onClick={() => s.setQuery(r)} data-hover-focus><Icon name="clock" /> {r}</button>
          ))}
        </section>
      )}
      {s.active && (
        <section className="tv-chips" aria-label="Filter results">
          {FILTERS.map((f) => (
            <button key={f.id} id={`filter-${f.id}`} className={`tv-chip ${s.filter === f.id ? "is-selected" : ""}`} aria-pressed={s.filter === f.id} onClick={() => s.setFilter(f.id)} data-hover-focus>{f.label}</button>
          ))}
        </section>
      )}
      <h2 className="tv-section-title">{s.active ? `Results for “${s.debounced.trim()}”` : "Popular Searches"}</h2>
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
