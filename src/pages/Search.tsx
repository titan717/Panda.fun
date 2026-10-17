
import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Footer } from '../components/ui/Footer';
import { ArrowRight, Clock3, Filter, Mic, MicOff, Search as SearchIcon, Sparkles, X } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { updateSEO } from '../lib/seo';
import { trackGAEvent } from '../lib/analytics';
import { buildDetailsHref } from '../lib/mediaRoute';
import { preferencesUtil } from '../lib/preferences';
import { api, MovieApiError } from '../lib/api';
import type { AnimeItem } from '../types';

type SearchItem = { key?: React.Key; id: string; title: string; type: 'movie' | 'series'; meta: string; image?: string; href: string; rating?: number; year?: number; };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
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
    href: buildDetailsHref(titleOf(item), type, item.id),
  };
};

function ContentCard({ item, priority = false }: { key?: React.Key; item: SearchItem; priority?: boolean }) {
  return <Link href={item.href} className="kinoma-search-card kinoma-focus" onClick={() => trackGAEvent('search_result_select', { content_type: item.type, title: item.title })}>
    <div className="kinoma-search-card__art" aria-hidden="true">
      {item.image ? <img src={item.image} alt="" srcSet={item.image.includes("/w500/") ? `${item.image.replace("/w500/", "/w342/")} 342w, ${item.image} 500w` : undefined} sizes="(max-width: 700px) 42vw, (max-width: 1100px) 24vw, 18vw" loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async" referrerPolicy="no-referrer" /> : <><span className="kinoma-search-card__orb kinoma-search-card__orb--one" /><span className="kinoma-search-card__orb kinoma-search-card__orb--two" /></>}
      <span className="kinoma-search-card__shine" /><span className="kinoma-search-card__type">{item.type.toUpperCase()}</span>
    </div>
    <div className="kinoma-search-card__copy"><h3>{item.title}</h3><p>{item.meta}</p></div>
  </Link>;
}

export function Search() {
  const [location, setLocation] = useLocation();
  const isAndroidTV = Boolean((window as Window & { isKinomaAndroidTV?: boolean }).isKinomaAndroidTV);
  const initialQuery = useMemo(() => new URLSearchParams(window.location.search).get('keyword')?.trim() || '', []);
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [voiceListening, setVoiceListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [filter, setFilter] = useState<'all' | 'movie' | 'series'>(() => {
    const requestedType = new URLSearchParams(window.location.search).get('type');
    return requestedType === 'movie' || requestedType === 'series' ? requestedType : 'all';
  });
  useEffect(() => {
    const requestedType = new URLSearchParams(location.split('?')[1] || '').get('type');
    setFilter(requestedType === 'movie' || requestedType === 'series' ? requestedType : 'all');
  }, [location]);
  const inputRef = useRef<HTMLInputElement>(null);
  const speechWindow = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
  const SpeechRecognitionApi = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
  const voiceSearchSupported = Boolean(SpeechRecognitionApi);
  const resultsRef = useRef<HTMLElement>(null);
  const isSearching = submittedQuery.length > 0;
  const visibleResults = useMemo(() => {
    const normalized = submittedQuery.toLocaleLowerCase();
    return results
      .filter(item => filter === 'all' || item.type === filter)
      .sort((a, b) => {
        if (!normalized) return b.rating - a.rating;
        const score = (item: SearchItem) => {
          const title = item.title.toLocaleLowerCase();
          return (title === normalized ? 1000 : 0) + (title.startsWith(normalized) ? 300 : 0) + (title.includes(normalized) ? 100 : 0) + item.rating;
        };
        return score(b) - score(a);
      });
  }, [results, filter, submittedQuery]);

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

  useEffect(() => {
    if (!submittedQuery || !isAndroidTV) {
      if (submittedQuery && inputRef.current) inputRef.current.focus();
      return;
    }
    // On TV, move focus to the first result instead of snapping back to the
    // search input while the results rail is scrolling into view.
    if (loading) return;
    const frame = window.requestAnimationFrame(() => {
      const firstCard = resultsRef.current?.querySelector<HTMLAnchorElement>('.kinoma-search-card');
      if (firstCard) {
        firstCard.focus({ preventScroll: true });
        firstCard.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      } else {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [submittedQuery, isAndroidTV, loading, visibleResults.length]);

  useEffect(() => {
    if ((window as Window & { isKinomaAndroidTV?: boolean }).isKinomaAndroidTV) {
      const frame = window.requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
      return () => window.cancelAnimationFrame(frame);
    }
  }, []);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }, []);

  const startVoiceSearch = () => {
    if (!SpeechRecognitionApi) return;
    if (voiceListening) {
      recognitionRef.current?.stop();
      setVoiceListening(false);
      return;
    }
    recognitionRef.current?.stop();
    const recognition = new SpeechRecognitionApi();
    recognitionRef.current = recognition;
    recognition.lang = navigator.language || 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = event => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) setQuery(transcript);
      setVoiceListening(false);
      recognitionRef.current = null;
    };
    recognition.onerror = () => {
      setVoiceListening(false);
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      setVoiceListening(false);
      if (recognitionRef.current === recognition) recognitionRef.current = null;
    };
    try {
      recognition.start();
      setVoiceListening(true);
    } catch {
      setVoiceListening(false);
      recognitionRef.current = null;
    }
  };

  const submitSearch = (event?: FormEvent) => {
    event?.preventDefault();
    const clean = query.trim();
    if (!clean) { setSubmittedQuery(''); setLocation('/search'); return; }
    preferencesUtil.addRecentSearch(clean);
    trackGAEvent('search', { content_type: 'catalog', has_query: true });
    setRecentSearches(preferencesUtil.getRecentSearches());
    setSubmittedQuery(clean);
    setLocation('/search?keyword=' + encodeURIComponent(clean));
  };
  const clearSearch = () => { setQuery(''); setSubmittedQuery(''); setError(null); setFilter('all'); inputRef.current?.focus(); setLocation('/search'); };
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
  const chooseRecent = (value: string) => { setQuery(value); setSubmittedQuery(value); setFilter('all'); trackGAEvent('search', { content_type: 'catalog', has_query: true, source: 'recent_search' }); setLocation('/search?keyword=' + encodeURIComponent(value)); };

  return <main className={"kinoma-search-page" + (isSearching ? " is-searching" : "")}>
    <div className="kinoma-search-page__ambient" aria-hidden="true" />
    <div className="kinoma-search-page__inner">
      <header className="kinoma-search-head">
        <div className="kinoma-search-head__copy">
          <span className="kinoma-eyebrow">{isSearching ? 'Search results' : 'Discover'}</span>
          <h1>{isSearching ? 'Results for “' + submittedQuery + '”' : filter === 'movie' ? 'Movies for tonight' : filter === 'series' ? 'TV shows to get into' : 'What are we watching?'}</h1>
          <p>{isSearching ? 'Movies, series and anime matching your search.' : 'Search by title, genre, or cast. Find your next watch.'}</p>
        </div>
        <form className="kinoma-search-control is-open" onSubmit={submitSearch}>
          <SearchIcon size={18} /><input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleInputKeyDown} placeholder={isAndroidTV ? "Search" : "Search movies, series or anime"} aria-label="Search movies, series or anime" autoComplete="off" />
          {query && <button type="button" className="kinoma-search-control__clear" onClick={clearQueryInput} aria-label="Clear search"><X size={16} /></button>}
          <button type="button" className={"kinoma-search-control__voice" + (voiceListening ? " is-listening" : "")} onClick={startVoiceSearch} disabled={!voiceSearchSupported} aria-label={voiceListening ? "Listening for search terms" : voiceSearchSupported ? "Search by voice" : "Voice search is not supported on this device"} title={voiceSearchSupported ? "Search by voice" : "Voice search unavailable on this device"}>
            {voiceListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <button type="submit" className="kinoma-search-control__submit"><span className="kinoma-search-control__sheen" aria-hidden="true" /><span>Search</span><ArrowRight size={15} aria-hidden="true" /></button>
        </form>
        {!isSearching && <button type="button" className="panda-search-surprise" onClick={surpriseMe} disabled={!surprisePool.length} aria-label="Pick a surprise title and open its details page"><Sparkles size={15} /> Surprise Me <span>Pick something for me</span></button>}
      </header>
      {!isSearching && recentSearches.length > 0 && <section className="kinoma-search-recent" aria-label="Recent searches"><div className="kinoma-search-recent__label"><Clock3 size={14} /> Recent</div><div className="kinoma-search-recent__items">{recentSearches.slice(0, 5).map(item => <button key={item} type="button" onClick={() => chooseRecent(item)}><Clock3 className="kinoma-search-recent__history-icon" size={16} aria-hidden="true" />{item}</button>)}<button type="button" className="kinoma-search-recent__clear" onClick={clearRecent}>Clear</button></div></section>}
      <section ref={resultsRef} className="kinoma-search-results" id="search-results">
        <div className="kinoma-search-results__heading"><div><span className="kinoma-eyebrow">{isSearching ? 'Your search' : 'Live discovery'}</span><h2>{isSearching ? 'Matches' : isAndroidTV ? 'Popular Searches' : filter === 'movie' ? 'Movies' : filter === 'series' ? 'TV shows' : 'Trending now'}</h2></div>{!isSearching && <Sparkles size={18} />}</div>
        {!loading && !error && results.length > 0 && <div className="kinoma-search-toolbar"><div className="kinoma-search-filters" role="tablist" aria-label="Filter search results"><button type="button" role="tab" aria-selected={filter === 'all'} className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}><Filter size={13} /> All <span>{results.length}</span></button><button type="button" role="tab" aria-selected={filter === 'movie'} className={filter === 'movie' ? 'is-active' : ''} onClick={() => setFilter('movie')}>Movies <span>{results.filter(item => item.type === 'movie').length}</span></button><button type="button" role="tab" aria-selected={filter === 'series'} className={filter === 'series' ? 'is-active' : ''} onClick={() => setFilter('series')}>Series <span>{results.filter(item => item.type === 'series').length}</span></button></div><span className="kinoma-search-toolbar__count">{visibleResults.length} {visibleResults.length === 1 ? 'title' : 'titles'}</span></div>}
        {loading ? <div className="kinoma-search-empty"><SearchIcon size={28} /><h3>Searching…</h3><p>Finding movies and series from MovieApi.</p></div>
        : error ? <div className="kinoma-search-empty"><SearchIcon size={28} /><h3>Search unavailable</h3><p>{error}</p><button type="button" onClick={() => setRetryNonce(value => value + 1)}>Try again</button></div>
        : visibleResults.length ? <div className="kinoma-search-grid">{visibleResults.map((item, index) => <ContentCard key={item.id} item={item} priority={index < 5} />)}</div>
        : <div className="kinoma-search-empty"><SearchIcon size={28} /><h3>{results.length ? 'No titles in this filter' : 'Nothing found yet'}</h3><p>{results.length ? 'Try another filter to see more matches.' : 'Try a different title, spelling, or a broader search.'}</p><button type="button" onClick={results.length ? () => setFilter('all') : clearSearch}>{results.length ? 'Show all results' : 'Back to trending'}</button></div>}
      </section>
      <Footer />
    </div>
  </main>;
}
