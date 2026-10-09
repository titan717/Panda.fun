
import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Footer } from '../components/ui/Footer';
import { Clock3, Filter, Search as SearchIcon, Sparkles, X } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { updateSEO } from '../lib/seo';
import { trackEvent, trackGAEvent } from '../lib/analytics';
import { buildDetailsHref } from '../lib/mediaRoute';
import { preferencesUtil } from '../lib/preferences';
import { api, MovieApiError } from '../lib/api';
import type { AnimeItem } from '../types';

type SearchItem = { id: string; title: string; type: 'movie' | 'series'; meta: string; image?: string; href: string; rating?: number; year?: number; genres: string[]; language?: string; duration?: number; };
const titleOf = (item: AnimeItem) => typeof item.title === 'string' ? item.title : item.title.english || item.title.romaji || item.title.native || 'Untitled';
const mapItem = (item: AnimeItem): SearchItem => {
  const type = item.contentType === 'movie' ? 'movie' : 'series';
  return {
    id: item.id,
    title: titleOf(item),
    type,
    meta: [item.releaseDate ? String(item.releaseDate).slice(0, 4) : null, item.rating ? '★ ' + item.rating : null, type === 'movie' ? 'Movie' : 'Series'].filter(Boolean).join(' • ') || 'MovieApi',
    image: item.image,
    rating: Number(item.rating || 0) || 0,
    year: item.releaseDate ? Number(String(item.releaseDate).slice(0, 4)) || undefined : undefined,
    genres: Array.isArray(item.genres) ? item.genres : [],
    language: typeof item.originalLanguage === 'string' ? item.originalLanguage.toLowerCase() : undefined,
    duration: typeof item.runtime === 'number' && Number.isFinite(item.runtime) && item.runtime > 0 ? item.runtime : undefined,
    href: buildDetailsHref(titleOf(item), type, item.id),
  };
};

function ContentCard({ item, priority = false }: { item: SearchItem; priority?: boolean }) {
  return <Link href={item.href} className="kinoma-search-card kinoma-focus" onClick={() => {
      preferencesUtil.recordGenreInteraction(item.genres);
      trackGAEvent('search_result_select', { content_type: item.type, title: item.title, item_id: item.id });
      void trackEvent({ type: 'content_select', animeId: item.id, animeTitle: item.title, metadata: { source: 'search' } });
    }}>
    <div className="kinoma-search-card__art" aria-hidden="true">
      {item.image ? <img src={item.image} alt="" srcSet={item.image.includes("/w500/") ? `${item.image.replace("/w500/", "/w342/")} 342w, ${item.image} 500w` : undefined} sizes="(max-width: 700px) 42vw, (max-width: 1100px) 24vw, 18vw" loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async" referrerPolicy="no-referrer" /> : <><span className="kinoma-search-card__orb kinoma-search-card__orb--one" /><span className="kinoma-search-card__orb kinoma-search-card__orb--two" /></>}
      <span className="kinoma-search-card__shine" /><span className="kinoma-search-card__type">{item.type.toUpperCase()}</span>
    </div>
    <div className="kinoma-search-card__copy"><h3>{item.title}</h3><p>{item.meta}</p></div>
  </Link>;
}

export function Search() {
  const [, setLocation] = useLocation();
  const initialQuery = useMemo(() => new URLSearchParams(window.location.search).get('keyword')?.trim() || '', []);
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [filter, setFilter] = useState<'all' | 'movie' | 'series'>('all');
  const [genreFilter, setGenreFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [durationFilter, setDurationFilter] = useState<'all' | 'under90' | '90to150' | 'over150'>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const isSearching = submittedQuery.length > 0;
  const genreOptions = useMemo(
    () => Array.from(new Set<string>(results.flatMap((item) => item.genres))).filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [results]
  );
  const yearOptions = useMemo(
    () => Array.from(new Set<number>(results.map((item) => item.year).filter((year): year is number => Boolean(year)))).sort((a, b) => b - a),
    [results]
  );
  const languageOptions = useMemo(
    () => Array.from(new Set<string>(results.map((item) => item.language).filter((language): language is string => Boolean(language)))).sort(),
    [results]
  );
  const hasDurationData = results.some((item) => typeof item.duration === 'number' && item.duration > 0);
  const hasAdvancedFilters = genreOptions.length > 0 || yearOptions.length > 0 || languageOptions.length > 0 || hasDurationData;
  const hasActiveAdvancedFilters = genreFilter !== 'all' || yearFilter !== 'all' || languageFilter !== 'all' || durationFilter !== 'all';

  const visibleResults = useMemo(() => {
    const normalized = submittedQuery.toLocaleLowerCase();
    const preferredGenres = preferencesUtil.getTopUserGenres();
    return results
      .filter(item => filter === 'all' || item.type === filter)
      .filter(item => genreFilter === 'all' || item.genres.some((genre) => genre.toLowerCase() === genreFilter.toLowerCase()))
      .filter(item => yearFilter === 'all' || String(item.year || '') === yearFilter)
      .filter(item => languageFilter === 'all' || item.language === languageFilter)
      .filter(item => {
        if (durationFilter === 'all') return true;
        if (typeof item.duration !== 'number' || item.duration <= 0) return false;
        if (durationFilter === 'under90') return item.duration < 90;
        if (durationFilter === '90to150') return item.duration >= 90 && item.duration <= 150;
        return item.duration > 150;
      })
      .sort((a, b) => {
        const score = (item: SearchItem) => {
          const title = item.title.toLocaleLowerCase();
          const textScore = normalized
            ? (title === normalized ? 1000 : 0) + (title.startsWith(normalized) ? 300 : 0) + (title.includes(normalized) ? 100 : 0)
            : 0;
          const tasteScore = item.genres.reduce((total, genre) => total + (preferredGenres.includes(genre) ? 12 : 0), 0);
          return textScore + tasteScore + item.rating;
        };
        return score(b) - score(a);
      });
  }, [results, filter, submittedQuery, genreFilter, yearFilter, languageFilter, durationFilter]);

  useEffect(() => {
    setRecentSearches(preferencesUtil.getRecentSearches());
    updateSEO({ title: isSearching ? 'Search "' + submittedQuery + '"' : 'Search', description: 'Find movies, TV series and anime on Panda.fun.', type: 'website' });
  }, [isSearching, submittedQuery]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const request = isSearching ? api.search(submittedQuery, controller.signal) : api.getTrending();
    request.then(data => active && setResults(data.results.map(mapItem)))
      .catch((err: unknown) => {
        if (!active) return;
        setResults([]);
        setError(err instanceof MovieApiError ? err.message : 'MovieApi is unavailable right now.');
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; controller.abort(); };
  }, [isSearching, submittedQuery, retryNonce]);

  useEffect(() => {
    if (!submittedQuery) return;
    const frame = window.requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [submittedQuery]);

  useEffect(() => { if (inputRef.current && submittedQuery) inputRef.current.focus(); }, [submittedQuery]);

  const submitSearch = (event?: FormEvent) => {
    event?.preventDefault();
    const clean = query.trim();
    if (!clean) { setSubmittedQuery(''); setLocation('/search'); return; }
    preferencesUtil.addRecentSearch(clean);
    trackGAEvent('search', { search_term: clean, content_type: 'catalog', has_query: true });
    void trackEvent({ type: 'search', metadata: { searchTerm: clean, contentType: 'catalog' } });
    setRecentSearches(preferencesUtil.getRecentSearches());
    setSubmittedQuery(clean);
    setLocation('/search?keyword=' + encodeURIComponent(clean));
  };
  const clearAdvancedFilters = () => { setGenreFilter('all'); setYearFilter('all'); setLanguageFilter('all'); setDurationFilter('all'); };
  const clearSearch = () => { setQuery(''); setSubmittedQuery(''); setError(null); setFilter('all'); clearAdvancedFilters(); inputRef.current?.focus(); setLocation('/search'); };
  const clearQueryInput = () => { setQuery(''); inputRef.current?.focus(); };
  const clearRecent = () => { preferencesUtil.clearRecentSearches(); setRecentSearches([]); };
  const surprisePool = useMemo(() => results.filter(item => item.id && item.title), [results]);
  const surpriseMe = () => {
    if (!surprisePool.length) return;
    const pick = surprisePool[Math.floor(Math.random() * surprisePool.length)];
    trackGAEvent('surprise_me', { source: 'search', content_type: pick.type, item_id: pick.id, title: pick.title });
    setLocation(pick.href);
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && query) { setQuery(''); return; }
    if (event.key === 'Escape' && !query) inputRef.current?.blur();
  };
  const chooseRecent = (value: string) => { setQuery(value); setSubmittedQuery(value); setFilter('all'); clearAdvancedFilters(); trackGAEvent('search', { content_type: 'catalog', has_query: true, source: 'recent_search' }); setLocation('/search?keyword=' + encodeURIComponent(value)); };

  return <main className={"kinoma-search-page" + (isSearching ? " is-searching" : "")}>
    <div className="kinoma-search-page__ambient" aria-hidden="true" />
    <div className="kinoma-search-page__inner">
      <header className="kinoma-search-head">
        <div className="kinoma-search-head__copy">
          <span className="kinoma-eyebrow">{isSearching ? 'Search results' : 'Discover'}</span>
          <h1>{isSearching ? 'Results for “' + submittedQuery + '”' : 'What are we watching?'}</h1>
          <p>{isSearching ? 'Movies, series and anime matching your search.' : 'Tell Panda what you feel like watching. We’ll bring the leaves... and the good stuff.'}</p>
        </div>
        {!isSearching && (
          <div className="panda-search-companion" aria-label="A panda happily eating bamboo leaves">
            <div className="panda-search-bamboo" aria-hidden="true">
              <span className="panda-search-stem" />
              <span className="panda-search-leaf panda-search-leaf--one">🍃</span>
              <span className="panda-search-leaf panda-search-leaf--two">🍃</span>
              <span className="panda-search-leaf panda-search-leaf--three">🍃</span>
            </div>
            <div className="panda-search-panda" aria-hidden="true">
              <span className="panda-search-ear panda-search-ear--left" />
              <span className="panda-search-ear panda-search-ear--right" />
              <span className="panda-search-head">
                <span className="panda-search-eye panda-search-eye--left" />
                <span className="panda-search-eye panda-search-eye--right" />
                <span className="panda-search-muzzle"><span className="panda-search-nose" /></span>
              </span>
              <span className="panda-search-body" />
              <span className="panda-search-paw panda-search-paw--left" />
              <span className="panda-search-paw panda-search-paw--right" />
            </div>
            <span className="panda-search-caption">Panda is already looking.</span>
          </div>
        )}
        <form className="kinoma-search-control is-open" onSubmit={submitSearch}>
          <SearchIcon size={18} /><input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleInputKeyDown} placeholder="Search movies, series or anime" aria-label="Search movies, series or anime" autoComplete="off" />
          {query && <button type="button" className="kinoma-search-control__clear" onClick={clearQueryInput} aria-label="Clear search"><X size={16} /></button>}
          <button type="submit" className="kinoma-search-control__submit">Search</button>
        </form>
        {!isSearching && <button type="button" className="panda-search-surprise" onClick={surpriseMe} disabled={!surprisePool.length} aria-label="Pick a surprise title and open its details page"><Sparkles size={15} /> Surprise Me <span>Pick something for me</span></button>}
      </header>
      {!isSearching && recentSearches.length > 0 && <section className="kinoma-search-recent" aria-label="Recent searches"><div className="kinoma-search-recent__label"><Clock3 size={14} /> Recent</div><div className="kinoma-search-recent__items">{recentSearches.slice(0, 5).map(item => <button key={item} type="button" onClick={() => chooseRecent(item)}>{item}</button>)}<button type="button" className="kinoma-search-recent__clear" onClick={clearRecent}>Clear</button></div></section>}
      <section ref={resultsRef} className="kinoma-search-results" id="search-results">
        <div className="kinoma-search-results__heading"><div><span className="kinoma-eyebrow">{isSearching ? 'Your search' : 'Live discovery'}</span><h2>{isSearching ? 'Matches' : 'Trending now'}</h2></div>{!isSearching && <Sparkles size={18} />}</div>
        {!loading && !error && results.length > 0 && <div className="kinoma-search-toolbar"><div className="kinoma-search-filters" role="tablist" aria-label="Filter search results"><button type="button" role="tab" aria-selected={filter === 'all'} className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}><Filter size={13} /> All <span>{results.length}</span></button><button type="button" role="tab" aria-selected={filter === 'movie'} className={filter === 'movie' ? 'is-active' : ''} onClick={() => setFilter('movie')}>Movies <span>{results.filter(item => item.type === 'movie').length}</span></button><button type="button" role="tab" aria-selected={filter === 'series'} className={filter === 'series' ? 'is-active' : ''} onClick={() => setFilter('series')}>Series <span>{results.filter(item => item.type === 'series').length}</span></button></div><span className="kinoma-search-toolbar__count">{visibleResults.length} {visibleResults.length === 1 ? 'title' : 'titles'}</span></div>}
        {!loading && !error && results.length > 0 && hasAdvancedFilters && (
          <div className="kinoma-search-advanced-filters" aria-label="Refine search results">
            <span className="kinoma-search-advanced-filters__label"><Filter size={13} aria-hidden="true" /> Refine</span>
            {genreOptions.length > 0 && (
              <label>Genre
                <select value={genreFilter} onChange={(event) => setGenreFilter(event.target.value)}>
                  <option value="all">All genres</option>
                  {genreOptions.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
                </select>
              </label>
            )}
            {yearOptions.length > 0 && (
              <label>Year
                <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
                  <option value="all">Any year</option>
                  {yearOptions.map((year) => <option key={year} value={String(year)}>{year}</option>)}
                </select>
              </label>
            )}
            {languageOptions.length > 0 && (
              <label>Language
                <select value={languageFilter} onChange={(event) => setLanguageFilter(event.target.value)}>
                  <option value="all">Any language</option>
                  {languageOptions.map((language) => <option key={language} value={language}>{language.toUpperCase()}</option>)}
                </select>
              </label>
            )}
            {hasDurationData && (
              <label>Runtime
                <select value={durationFilter} onChange={(event) => setDurationFilter(event.target.value as typeof durationFilter)}>
                  <option value="all">Any length</option>
                  <option value="under90">Under 90 min</option>
                  <option value="90to150">90–150 min</option>
                  <option value="over150">Over 150 min</option>
                </select>
              </label>
            )}
            {hasActiveAdvancedFilters && <button type="button" onClick={clearAdvancedFilters} className="kinoma-search-advanced-filters__clear">Clear filters</button>}
          </div>
        )}
        {loading ? <div className="kinoma-search-empty"><SearchIcon size={28} /><h3>Searching…</h3><p>Finding movies and series from MovieApi.</p></div>
        : error ? <div className="kinoma-search-empty"><SearchIcon size={28} /><h3>Search unavailable</h3><p>{error}</p><button type="button" onClick={() => setRetryNonce(value => value + 1)}>Try again</button></div>
        : visibleResults.length ? <div className="kinoma-search-grid">{visibleResults.map((item, index) => <React.Fragment key={item.id}><ContentCard item={item} priority={index < 5} /></React.Fragment>)}</div>
        : <div className="kinoma-search-empty"><SearchIcon size={28} /><h3>{results.length ? 'No titles in this filter' : 'Nothing found yet'}</h3><p>{results.length ? 'Try changing a filter or clear the filters to see more matches.' : 'Try a different title, spelling, or a broader search.'}</p><button type="button" onClick={results.length ? () => setFilter('all') : clearSearch}>{results.length ? 'Show all results' : 'Back to trending'}</button></div>}
      </section>
      <Footer />
    </div>
  </main>;
}
