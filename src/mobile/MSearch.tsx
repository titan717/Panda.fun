import { useEffect, useRef } from "react";
import { Link, useSearch as useQueryString } from "wouter";
import { Icon } from "../components/Icon";
import { EmptyState, ErrorState, Img, Skeleton } from "../components/ui";
import { useSearchState, type SearchFilter } from "../lib/useSearchState";
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
          {s.recents.length > 0 && (
            <section className="m-section">
              <div className="m-row-head"><h2 className="m-row-title">Recent Searches</h2><button className="m-link" onClick={s.clearRecents}>Clear All</button></div>
              <ul className="m-recents">
                {s.recents.map((r) => <li key={r}><button onClick={() => s.setQuery(r)}><Icon name="clock" /> <span>{r}</span><Icon name="arrowUpLeft" /></button></li>)}
              </ul>
            </section>
          )}
          <section className="m-section">
            <h2 className="m-row-title">Popular Searches</h2>
            <div className="m-chips m-chips--wrap">
              {s.popular.slice(0, 8).map((it) => <button key={it.id} className="m-chip" onClick={() => { s.setQuery(it.title); s.commit(it.title); }}><Icon name="trend" /> {it.title}</button>)}
            </div>
          </section>
          <section className="m-section">
            <h2 className="m-row-title">Trending Today</h2>
            <div className="m-mosaic" aria-busy={s.popularLoading}>
              {s.popularLoading && Array.from({ length: 9 }, (_, i) => <Skeleton key={i} className="m-poster sk-poster-m" />)}
              {s.popular.map((it) => <MPoster key={it.id} item={it} />)}
            </div>
          </section>
        </>
      )}

      {s.active && (
        <>
          <div className="m-chips" role="radiogroup" aria-label="Filter results">
            {FILTERS.map((f) => <button key={f.id} role="radio" aria-checked={s.filter === f.id} className={`m-chip ${s.filter === f.id ? "is-selected" : ""}`} onClick={() => s.setFilter(f.id)}>{f.label}</button>)}
          </div>
          {s.error && !s.results.length && <ErrorState compact message={s.error.message} onRetry={s.retry} />}
          {s.loading && <div className="m-grid">{Array.from({ length: 9 }, (_, i) => <Skeleton key={i} className="m-poster sk-poster-m" />)}</div>}
          {!s.loading && !s.error && !s.stale && s.results.length === 0 && (
            <EmptyState icon="search" title={`No results for “${s.debounced.trim()}”`} sub="Check the spelling or try a different title, actor or genre." />
          )}
          {top && (
            <div className={s.stale ? "is-stale" : ""}>
              <Link href={titlePath(top)} className="m-top-result" onClick={() => s.commit()}>
                <span className="m-top-media"><Img src={top.backdrop ?? top.poster} alt="" title={top.title} eager /></span>
                <span className="m-top-text"><span className="m-top-title">{top.title}</span><span className="m-top-meta">{itemMeta(top, 3)}</span></span>
              </Link>
              {rest.length > 0 && <h2 className="m-row-title">More Results</h2>}
              <div className="m-grid" onClick={() => s.commit()}>{rest.map((it) => <MPoster key={it.id} item={it} />)}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
