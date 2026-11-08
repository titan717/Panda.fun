import { useEffect, useRef } from "react";
import { Link, useSearch as useQueryString } from "wouter";
import { Icon } from "../components/Icon";
import { EmptyState, ErrorState, Img, Skeleton } from "../components/ui";
import { POPULAR_TABS, SEARCH_SORTS, useSearchState, type SearchFilter } from "../lib/useSearchState";
import { itemMeta, titlePath } from "../lib/format";
import { MPoster } from "./MCards";

const FILTERS: { id: SearchFilter; label: string }[] = [{ id: "all", label: "All" }, { id: "movie", label: "Movies" }, { id: "tv", label: "Shows" }];

/** Mobile Search (spec 13). */
export function MSearch() {
  const s = useSearchState();
  const input = useRef<HTMLInputElement>(null);
  const qs = useQueryString();
  const wantsVoice = new URLSearchParams(qs).get("voice") === "1";
  const { voiceSupported, startVoice } = s;
  useEffect(() => {
    if (wantsVoice && voiceSupported) startVoice();
    else input.current?.focus({ preventScroll: true });
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [top, ...rest] = s.results;
  const q = s.debounced.trim().toLowerCase();
  const suggest = s.recents.filter((r) => r.toLowerCase() !== q && r.toLowerCase().includes(q)).slice(0, 4);
  const sortLabel = SEARCH_SORTS.find((x) => x.id === s.sort)?.label ?? "Best match";
  const nextSort = () => { const i = SEARCH_SORTS.findIndex((x) => x.id === s.sort); s.setSort(SEARCH_SORTS[(i + 1) % SEARCH_SORTS.length]!.id); };
  const note = s.active && !s.stale ? (s.interpreted ? `Showing ${s.interpreted}` : s.corrected ? `Showing results for “${s.corrected}”` : s.people.length ? `Including titles with ${s.people.join(", ")}` : null) : null;

  return (
    <div className="m-page m-search">
      <form className="m-search-bar" role="search" onSubmit={(e) => { e.preventDefault(); s.commit(); input.current?.blur(); }}>
        <Icon name="search" />
        <input ref={input} type="search" value={s.query} onChange={(e) => s.setQuery(e.target.value)} placeholder="Search for 'hindi movies'" aria-label="Search movies and shows" autoComplete="off" spellCheck={false} enterKeyHint="search" />
        {s.query && <button type="button" className="icon-btn" onClick={() => { s.setQuery(""); input.current?.focus(); }} aria-label="Clear search"><Icon name="close" /></button>}
        {s.voiceSupported && <button type="button" className={`icon-btn ${s.listening ? "is-listening" : ""}`} onClick={s.startVoice} aria-label="Search by voice"><Icon name="mic" /></button>}
      </form>

      {!s.active && (
        <>
          {s.recentTitles.length > 0 && (
            <section className="m-section">
              <div className="m-row-head"><h2 className="m-row-title">Recent Searches</h2><button className="m-link" onClick={s.clearRecents}>Clear All</button></div>
              <div className="m-recent-row">
                {s.recentTitles.map((it) => (
                  <Link key={it.id} href={titlePath(it)} className="m-recent-card" onClick={() => s.openTitle(it)}>
                    <span className="m-recent-media"><Img src={it.backdrop ?? it.poster} alt="" title={it.title} /></span>
                    <span className="m-recent-title">{it.title}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          <section className="m-section">
            <h2 className="m-row-title">Popular Searches in</h2>
            <div className="m-chips" role="tablist" aria-label="Popular searches in">
              {POPULAR_TABS.map((tab) => (
                <button key={tab.id} role="tab" aria-selected={s.popularTab === tab.id} className={`m-chip m-chip--tab ${s.popularTab === tab.id ? "is-selected" : ""}`} onClick={() => s.setPopularTab(tab.id)}>
                  <Icon name={tab.icon} /> {tab.label}
                </button>
              ))}
            </div>
            {s.popularError && !s.popular.length ? <ErrorState compact message={s.popularError.message} onRetry={s.retryPopular} /> : (
              <div className="m-mosaic" aria-busy={s.popularLoading} role="tabpanel">
                {s.popularLoading && Array.from({ length: 9 }, (_, i) => <Skeleton key={i} className="m-poster sk-poster-m" />)}
                {s.popular.map((it) => <MPoster key={it.id} item={it} onOpen={() => s.openTitle(it)} />)}
              </div>
            )}
          </section>
        </>
      )}

      {s.active && (
        <>
          <div className="m-chips" role="radiogroup" aria-label="Filter results">
            {FILTERS.map((f) => <button key={f.id} role="radio" aria-checked={s.filter === f.id} className={`m-chip ${s.filter === f.id ? "is-selected" : ""}`} onClick={() => s.setFilter(f.id)}>{f.label}</button>)}
            <button className="m-chip m-chip--sort" onClick={nextSort} aria-label={`Sort: ${sortLabel}. Tap to change.`}><Icon name="sort" /> {sortLabel}</button>
          </div>
          {s.genres.length > 1 && (
            <div className="m-chips" aria-label="Filter by genre">
              {s.genres.map((g) => <button key={g} aria-pressed={s.genre === g} className={`m-chip ${s.genre === g ? "is-selected" : ""}`} onClick={() => s.setGenre(s.genre === g ? null : g)}>{g}</button>)}
            </div>
          )}
          {suggest.length > 0 && (
            <div className="m-chips" aria-label="Recent searches">
              {suggest.map((r) => <button key={r} className="m-chip" onClick={() => { s.setQuery(r); s.commit(r); }}><Icon name="clock" /> {r}</button>)}
            </div>
          )}
          {note && <p className="m-search-note" role="status">{note}</p>}
          {s.error && !s.results.length && <ErrorState compact message={s.error.message} onRetry={s.retry} />}
          {s.loading && <div className="m-grid">{Array.from({ length: 9 }, (_, i) => <Skeleton key={i} className="m-poster sk-poster-m" />)}</div>}
          {!s.loading && !s.error && !s.stale && s.results.length === 0 && (
            <EmptyState icon="search" title={`No results for “${s.debounced.trim()}”`} sub="Check the spelling or try a different title, actor or genre." />
          )}
          {top && (
            <div className={s.stale ? "is-stale" : ""}>
              <Link href={titlePath(top)} className="m-top-result" onClick={() => s.openTitle(top)}>
                <span className="m-top-media"><Img src={top.backdrop ?? top.poster} alt="" title={top.title} eager /></span>
                <span className="m-top-text"><span className="m-top-title">{top.title}</span><span className="m-top-meta">{itemMeta(top, 3)}</span></span>
              </Link>
              {rest.length > 0 && <h2 className="m-row-title">More Results</h2>}
              <div className="m-grid">{rest.map((it) => <MPoster key={it.id} item={it} onOpen={() => s.openTitle(it)} />)}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
