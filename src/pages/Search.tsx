
import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Footer } from '../components/ui/Footer';
import { ArrowRight, Check, Clock3, Filter, Mic, MicOff, Plus, Play, Search as SearchIcon, Sparkles, X } from 'lucide-react';
import { Link, useLocation, useSearch } from 'wouter';
import { updateSEO } from '../lib/seo';
import { trackGAEvent } from '../lib/analytics';
import { buildDetailsHref } from '../lib/mediaRoute';
import { preferencesUtil } from '../lib/preferences';
import { libraryManager } from '../lib/library';
import { optimizeImageUrl } from '../lib/mediaImages';
import '../styles/panda-home.css';
import { api, MovieApiError } from '../lib/api';
import type { AnimeItem } from '../types';
import { ThinkingOrb } from 'thinking-orbs';
import { friendlyNetworkError } from '../lib/networkMessage';

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
  const [inList, setInList] = useState(() => libraryManager.isInWatchlist(item.id));
  const image = item.image ? optimizeImageUrl(item.image, 'w342') || item.image : '';
  const toggleList = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setInList(libraryManager.toggleWatchlist({ id: item.id, title: item.title, image: item.image || '' }));
  };

  return (
    <article className="panda-content-card">
      <Link
        href={item.href}
        className="panda-content-card__link"
        aria-label={`Open ${item.title}`}
        onClick={() => trackGAEvent('search_result_select', { content_type: item.type, title: item.title })}
      >
        <div className="panda-content-card__media">
          {image ? (
            <div className="panda-content-card__image-wrap">
              <div className="panda-content-card__image-skeleton" aria-hidden="true" />
              <img
                src={image}
                srcSet={image.includes('/w500/') ? `${image.replace('/w500/', '/w342/')} 342w, ${image} 500w` : undefined}
                sizes="(max-width: 620px) 44vw, (max-width: 1050px) 24vw, 18vw"
                alt=""
                loading={priority ? 'eager' : 'lazy'}
                fetchPriority={priority ? 'high' : 'auto'}
                decoding="async"
                referrerPolicy="no-referrer"
                onLoad={event => event.currentTarget.previousElementSibling?.classList.add('is-hidden')}
              />
            </div>
          ) : null}
          <div className="panda-content-card__top">
            <span className="panda-content-card__badge">{item.type === 'movie' ? 'Movie' : 'Series'}</span>
          </div>
          <span className="panda-content-card__play" aria-hidden="true"><Play size={17} fill="currentColor" /></span>
        </div>
        <div className="panda-content-card__copy">
          <strong title={item.title}>{item.title}</strong>
          <span>{item.meta}</span>
        </div>
      </Link>
      <button
        type="button"
        className={`panda-content-card__quick${inList ? ' is-added' : ''}`}
        onClick={toggleList}
        aria-label={inList ? `Remove ${item.title} from My List` : `Add ${item.title} to My List`}
        title={inList ? 'Remove from My List' : 'Add to My List'}
      >
        {inList ? <Check size={15} /> : <Plus size={15} />}
      </button>
    </article>
  );
}

export function Search() {
  const [location, setLocation] = useLocation();
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
  // wouter's location excludes the query string; read type/keyword from useSearch so
  // sidebar links like /search?type=series or ?keyword=sports apply while already on Search.
  const searchString = useSearch();
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const requestedType = params.get('type');
    setFilter(requestedType === 'movie' || requestedType === 'series' ? requestedType : 'all');
    const keyword = params.get('keyword')?.trim() || '';
    setSubmittedQuery(previous => (previous === keyword ? previous : keyword));
    if (keyword) setQuery(previous => (previous.trim() === keyword ? previous : keyword));
  }, [searchString]);
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
        setError(friendlyNetworkError(err instanceof MovieApiError ? err : null, 'Search is unavailable right now. Please try again in a moment.'));
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
    if (inputRef.current && submittedQuery) inputRef.current.focus();
  }, [submittedQuery]);

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
    setLocation('/search?keyword=' + encodeURIComponent(clean) + (filter !== 'all' ? '&type=' + filter : ''));
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

  return <div className={"kinoma-search-page" + (isSearching ? " is-searching" : "")}>
    <div className="kinoma-search-page__ambient" aria-hidden="true" />
    <div className="kinoma-search-page__inner">
      <header className="kinoma-search-head">
        <div className="kinoma-search-head__copy">
          <span className="kinoma-eyebrow">{isSearching ? 'Search results' : 'Discover'}</span>
          <h1>{isSearching ? 'Results for “' + submittedQuery + '”' : filter === 'movie' ? 'Movies for tonight' : filter === 'series' ? 'TV shows to get into' : 'Your next favourite starts here.'}</h1>
          <p>{isSearching ? 'Movies, series and anime matching your search.' : 'Discover films, series and anime worth staying up for.'}</p>
        </div>
        <form className="kinoma-search-control is-open" onSubmit={submitSearch} role="search" aria-label="Search the catalogue">
          <SearchIcon size={18} /><input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleInputKeyDown} placeholder="Search movies, series or anime" aria-label="Search movies, series or anime" autoComplete="off" />
          {query && <button type="button" className="kinoma-search-control__clear" onClick={clearQueryInput} aria-label="Clear search"><X size={16} /></button>}
          <button type="button" className={"kinoma-search-control__voice" + (voiceListening ? " is-listening" : "")} onClick={startVoiceSearch} disabled={!voiceSearchSupported} aria-label={voiceListening ? "Listening for search terms" : voiceSearchSupported ? "Search by voice" : "Voice search is not supported on this device"} title={voiceSearchSupported ? "Search by voice" : "Voice search unavailable on this device"}>
            {voiceListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <button type="submit" className="kinoma-search-control__submit"><span className="kinoma-search-control__sheen" aria-hidden="true" /><span>Search</span><ArrowRight size={15} aria-hidden="true" /></button>
        </form>
        {!isSearching && <button type="button" className="panda-search-surprise" onClick={surpriseMe} disabled={!surprisePool.length} aria-label="Pick a surprise title and open its details page"><Sparkles size={15} /> Surprise Me <span>Pick something for me</span></button>}
      </header>
      {!isSearching && recentSearches.length > 0 && <section className="kinoma-search-recent" aria-label="Recent searches"><div className="kinoma-search-recent__label"><Clock3 size={14} /> Recent</div><div className="kinoma-search-recent__items">{recentSearches.slice(0, 5).map(item => <button key={item} type="button" onClick={() => chooseRecent(item)}>{item}</button>)}<button type="button" className="kinoma-search-recent__clear" onClick={clearRecent}>Clear</button></div></section>}
      <section ref={resultsRef} className="kinoma-search-results" id="search-results">
        <div className="kinoma-search-results__heading"><div><span className="kinoma-eyebrow">{isSearching ? 'Your search' : 'Live discovery'}</span><h2>{isSearching ? 'Matches' : filter === 'movie' ? 'Movies' : filter === 'series' ? 'TV shows' : 'Trending now'}</h2></div>{!isSearching && <Sparkles size={18} />}</div>
        {!loading && !error && results.length > 0 && <div className="kinoma-search-toolbar"><div className="kinoma-search-filters" role="group" aria-label="Filter search results"><button type="button" aria-pressed={filter === 'all'} className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}><Filter size={13} aria-hidden="true" /> All <span>{results.length}</span></button><button type="button" aria-pressed={filter === 'movie'} className={filter === 'movie' ? 'is-active' : ''} onClick={() => setFilter('movie')}>Movies <span>{results.filter(item => item.type === 'movie').length}</span></button><button type="button" aria-pressed={filter === 'series'} className={filter === 'series' ? 'is-active' : ''} onClick={() => setFilter('series')}>Series <span>{results.filter(item => item.type === 'series').length}</span></button></div><span className="kinoma-search-toolbar__count" aria-live="polite">{visibleResults.length} {visibleResults.length === 1 ? 'title' : 'titles'}</span></div>}
        {loading ? <div className="kinoma-search-loading" role="status" aria-live="polite"><ThinkingOrb state="searching" size={64} theme="dark" aria-label="Searching the catalogue" /><div className="kinoma-search-loading__copy"><span>Searching the catalogue</span><p>Finding movies, series and anime</p></div></div>
        : error ? <div className="kinoma-search-empty is-error" role="alert"><SearchIcon size={28} aria-hidden="true" /><h3>Search unavailable</h3><p>{error}</p><button type="button" onClick={() => setRetryNonce(value => value + 1)}>Try again</button></div>
        : visibleResults.length ? <div className="kinoma-search-grid">{visibleResults.map((item, index) => <ContentCard key={item.id} item={item} priority={index < 5} />)}</div>
        : <div className="kinoma-search-empty"><SearchIcon size={28} /><h3>{results.length ? 'No titles in this filter' : 'Nothing found yet'}</h3><p>{results.length ? 'Try another filter to see more matches.' : 'Try a different title, spelling, or a broader search.'}</p><button type="button" onClick={results.length ? () => setFilter('all') : clearSearch}>{results.length ? 'Show all results' : 'Back to trending'}</button></div>}
      </section>
      <Footer />
    </div>
  </div>;
}
