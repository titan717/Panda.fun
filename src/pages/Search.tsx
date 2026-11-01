
import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Footer } from '../components/ui/Footer';
import { Link, useLocation, useSearch } from 'wouter';
import { ArrowRight, Check, Clock3, Filter, Mic, MicOff, Plus, Play, Search as SearchIcon, Sparkles, WifiOff, X } from 'lucide-react';
import { updateSEO } from '../lib/seo';
import { trackGAEvent } from '../lib/analytics';
import { buildDetailsHref } from '../lib/mediaRoute';
import { preferencesUtil } from '../lib/preferences';
import { libraryManager } from '../lib/library';
import { optimizeImageUrl } from '../lib/mediaImages';
import { api, MovieApiError } from '../lib/api';
import type { AnimeItem } from '../types';
import { ThinkingOrb } from 'thinking-orbs';
import { friendlyNetworkError } from '../lib/networkMessage';
import { Pressable, Reveal, Stagger } from '../motion';
import './search-ott.css';

type SearchKind = 'movie' | 'series' | 'anime';
type SearchFilter = 'all' | SearchKind;

type SearchItem = {
  id: string;
  title: string;
  type: SearchKind;
  meta: string;
  image?: string;
  href: string;
  rating?: number;
  year?: number;
};

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

const titleOf = (item: AnimeItem) =>
  typeof item.title === 'string'
    ? item.title
    : item.title.english || item.title.romaji || item.title.native || 'Untitled';

const mapItem = (item: AnimeItem): SearchItem => {
  const type: SearchKind = item.contentType === 'movie' ? 'movie' : item.contentType === 'anime' ? 'anime' : 'series';
  return {
    id: item.id,
    title: titleOf(item),
    type,
    meta: [
      item.releaseDate ? String(item.releaseDate).slice(0, 4) : null,
      item.rating ? `★ ${item.rating}` : null,
      type === 'movie' ? 'Movie' : type === 'anime' ? 'Anime' : 'Series'
    ].filter(Boolean).join(' • ') || 'Panda.fun',
    image: item.image,
    rating: Number(item.rating || 0) || 0,
    year: item.releaseDate ? Number(String(item.releaseDate).slice(0, 4)) || undefined : undefined,
    href: buildDetailsHref(titleOf(item), type === 'movie' ? 'movie' : 'series', item.id)
  };
};

function HighlightedTitle({ title, query }: { title: string; query: string }) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return <>{title}</>;
  const index = title.toLocaleLowerCase().indexOf(normalized);
  if (index < 0) return <>{title}</>;
  return (
    <>
      {title.slice(0, index)}
      <mark>{title.slice(index, index + normalized.length)}</mark>
      {title.slice(index + normalized.length)}
    </>
  );
}

const GENRE_TILES: Array<{ label: string; query: string; className: string }> = [
  { label: 'Action', query: 'action', className: 'is-action' },
  { label: 'Comedy', query: 'comedy', className: 'is-comedy' },
  { label: 'Sci-Fi', query: 'science fiction', className: 'is-scifi' },
  { label: 'Romance', query: 'romance', className: 'is-romance' },
  { label: 'Thriller', query: 'thriller', className: 'is-thriller' },
  { label: 'Anime', query: 'anime', className: 'is-anime' }
];

function ResultCard({ item, query, priority }: { item: SearchItem; query: string; priority: boolean }) {
  const [inList, setInList] = useState(() => libraryManager.isInWatchlist(item.id));
  const image = item.image ? optimizeImageUrl(item.image, 'w342') || item.image : '';

  const toggleList = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setInList(libraryManager.toggleWatchlist({ id: item.id, title: item.title, image: item.image || '' }));
  };

  return (
    <article className="panda-search-card">
      <Link
        href={item.href}
        className="panda-search-card__link"
        aria-label={`Open ${item.title}`}
        onClick={() => trackGAEvent('search_result_select', { content_type: item.type, title: item.title })}
      >
        <span className="panda-search-card__poster">
          {image ? <img src={image} alt="" loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async" referrerPolicy="no-referrer" /> : <Play aria-hidden="true" size={20} />}
          <span className="panda-search-card__badge">{item.type === 'movie' ? 'Movie' : item.type === 'anime' ? 'Anime' : 'TV'}</span>
        </span>
        <strong><HighlightedTitle title={item.title} query={query} /></strong>
        <span>{item.meta}</span>
      </Link>
      <button
        type="button"
        className={`panda-search-card__list ${inList ? 'is-added' : ''}`}
        onClick={toggleList}
        aria-pressed={inList}
        aria-label={inList ? `Remove ${item.title} from My List` : `Add ${item.title} to My List`}
      >
        {inList ? <Check size={15} /> : <Plus size={15} />}
      </button>
    </article>
  );
}

export function Search() {
  const [location, setLocation] = useLocation();
  const searchString = useSearch();
  const initialQuery = useMemo(() => new URLSearchParams(window.location.search).get('keyword')?.trim() || '', []);
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [voiceListening, setVoiceListening] = useState(false);
  const [filter, setFilter] = useState<SearchFilter>(() => {
    const requested = new URLSearchParams(window.location.search).get('type');
    return requested === 'movie' || requested === 'series' || requested === 'anime' ? requested : 'all';
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  const SpeechRecognitionApi = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
  const voiceSearchSupported = Boolean(SpeechRecognitionApi);
  const isSearching = submittedQuery.length > 0;

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const requestedType = params.get('type');
    setFilter(requestedType === 'movie' || requestedType === 'series' || requestedType === 'anime' ? requestedType : 'all');
    const keyword = params.get('keyword')?.trim() || '';
    setSubmittedQuery(previous => (previous === keyword ? previous : keyword));
    if (keyword) setQuery(previous => (previous.trim() === keyword ? previous : keyword));
  }, [searchString]);

  const visibleResults = useMemo(() => {
    const normalized = submittedQuery.toLocaleLowerCase();
    return results
      .filter(item => filter === 'all' || item.type === filter)
      .sort((a, b) => {
        if (!normalized) return b.rating - a.rating;
        const score = (item: SearchItem) => {
          const title = item.title.toLocaleLowerCase();
          return (title === normalized ? 1000 : 0)
            + (title.startsWith(normalized) ? 300 : 0)
            + (title.includes(normalized) ? 100 : 0)
            + item.rating;
        };
        return score(b) - score(a);
      });
  }, [results, filter, submittedQuery]);

  useEffect(() => {
    setRecentSearches(preferencesUtil.getRecentSearches());
    updateSEO({
      title: isSearching ? `Search “${submittedQuery}”` : 'Search',
      description: 'Find movies, TV series and anime on Panda.fun.',
      type: 'website'
    });
  }, [isSearching, submittedQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSubmittedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const request = isSearching ? api.search(submittedQuery, controller.signal) : api.getTrending();

    request.then(data => {
      if (active) setResults(data.results.map(mapItem));
    }).catch((err: unknown) => {
      if (!active) return;
      setResults([]);
      setError(friendlyNetworkError(err instanceof MovieApiError ? err : null, 'Search is unavailable right now. Please try again in a moment.'));
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [isSearching, submittedQuery, retryNonce]);

  useEffect(() => {
    if (!isSearching) return;
    setLocation(`/search?keyword=${encodeURIComponent(submittedQuery)}${filter !== 'all' ? `&type=${filter}` : ''}`, { replace: true });
  }, [submittedQuery, filter, isSearching, setLocation]);

  useEffect(() => {
    const onPopState = () => {
      if (query) {
        setQuery('');
        setSubmittedQuery('');
        setFilter('all');
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [query]);

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
    inputRef.current?.blur();
    const clean = query.trim();
    if (!clean) return;
    preferencesUtil.addRecentSearch(clean);
    setRecentSearches(preferencesUtil.getRecentSearches());
    setSubmittedQuery(clean);
    trackGAEvent('search', { content_type: 'catalog', has_query: true });
  };

  const clearAll = () => {
    setQuery('');
    setSubmittedQuery('');
    setError(null);
    setFilter('all');
    setLocation('/search', { replace: true });
    inputRef.current?.focus();
  };

  const clearInput = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  const removeRecent = (value: string) => {
    preferencesUtil.removeRecentSearch(value);
    setRecentSearches(preferencesUtil.getRecentSearches());
  };

  const clearRecent = () => {
    preferencesUtil.clearRecentSearches();
    setRecentSearches([]);
  };

  const runSearch = (value: string) => {
    setQuery(value);
    setSubmittedQuery(value);
    setFilter('all');
    preferencesUtil.addRecentSearch(value);
    setRecentSearches(preferencesUtil.getRecentSearches());
  };

  const surprisePool = useMemo(() => results.filter(item => item.id && item.title), [results]);
  const surpriseMe = () => {
    if (!surprisePool.length) return;
    const pick = surprisePool[Math.floor(Math.random() * surprisePool.length)];
    trackGAEvent('surprise_me', { source: 'search', content_type: pick.type, item_id: pick.id, title: pick.title });
    setLocation(pick.href);
  };

  const filters: Array<{ id: SearchFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'movie', label: 'Movies' },
    { id: 'series', label: 'TV' },
    { id: 'anime', label: 'Anime' }
  ];
  const activeFilterIndex = Math.max(0, filters.findIndex(item => item.id === filter));
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;

  return (
    <div className={`panda-search ${isSearching ? 'is-searching' : ''}`}>
      <header className="panda-search__top">
        <form className="panda-search__field" onSubmit={submitSearch} role="search" aria-label="Search the catalogue">
          <SearchIcon size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Escape' && query) {
                setQuery('');
                return;
              }
              if (event.key === 'Enter') submitSearch();
            }}
            placeholder="Search movies, series or anime"
            aria-label="Search movies, series or anime"
            autoComplete="off"
            enterKeyHint="search"
          />
          {query && (
            <button type="button" onClick={clearInput} aria-label="Clear search">
              <X size={17} />
            </button>
          )}
          {voiceSearchSupported && (
            <button
              type="button"
              className={voiceListening ? 'is-listening' : ''}
              onClick={startVoiceSearch}
              aria-pressed={voiceListening}
              aria-label={voiceListening ? 'Stop voice search' : 'Search by voice'}
            >
              {voiceListening ? <MicOff size={17} /> : <Mic size={17} />}
            </button>
          )}
          <button type="submit" className="panda-search__submit" aria-label="Search">
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </form>
      </header>

      <div className="panda-search__body">
        {!isSearching && (
          <section className="panda-search__idle" aria-label="Discovery">
            {!!recentSearches.length && (
              <section aria-label="Recent searches">
                <div className="panda-search__section-head">
                  <h2><Clock3 size={15} aria-hidden="true" /> Recent searches</h2>
                  <button type="button" onClick={clearRecent}>Clear all</button>
                </div>
                <div className="panda-search__chips">
                  {recentSearches.slice(0, 8).map(value => (
                    <span key={value} className="panda-search__chip">
                      <button type="button" onClick={() => runSearch(value)}>{value}</button>
                      <button type="button" onClick={() => removeRecent(value)} aria-label={`Remove ${value} from recent searches`}>
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              </section>
            )}

            <section aria-label="Trending searches">
              <div className="panda-search__section-head">
                <h2><Sparkles size={15} aria-hidden="true" /> Trending searches</h2>
                <Pressable className="panda-search__surprise" onClick={surpriseMe} disabled={!surprisePool.length} aria-label="Pick a surprise title and open its details page">
                  <Sparkles size={14} aria-hidden="true" /> Surprise Me
                </Pressable>
              </div>
              <div className="panda-search__chips">
                {results.slice(0, 8).map(item => (
                  <button key={item.id} type="button" className="panda-search__chip" onClick={() => runSearch(item.title)}>
                    {item.title}
                  </button>
                ))}
              </div>
            </section>

            <section aria-label="Browse by mood or genre">
              <div className="panda-search__section-head">
                <h2>Browse by mood</h2>
              </div>
              <div className="panda-search__tiles">
                {GENRE_TILES.map(tile => (
                  <Pressable
                    key={tile.label}
                    className={`panda-search__tile ${tile.className}`}
                    onClick={() => runSearch(tile.query)}
                  >
                    {tile.label}
                  </Pressable>
                ))}
              </div>
            </section>
          </section>
        )}

        <section aria-label={isSearching ? 'Search results' : 'Trending titles'}>
          <div className="panda-search__section-head">
            <h2>{isSearching ? `Results for “${submittedQuery}”` : 'Trending now'}</h2>
            {isSearching && !loading && <span aria-live="polite">{visibleResults.length} {visibleResults.length === 1 ? 'result' : 'results'}</span>}
          </div>

          {(isSearching || results.length > 0) && (
            <div className="panda-search__filters" role="group" aria-label="Filter search results">
              <span
                className="panda-search__filter-indicator"
                style={{ transform: `translateX(${activeFilterIndex * 100}%)` }}
                aria-hidden="true"
              />
              {filters.map(item => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={filter === item.id}
                  className={filter === item.id ? 'is-active' : ''}
                  onClick={() => setFilter(item.id)}
                >
                  <Filter size={13} aria-hidden="true" /> {item.label}
                </button>
              ))}
            </div>
          )}

          {offline ? (
            <div className="panda-search__state" role="alert">
              <WifiOff size={26} aria-hidden="true" />
              <h3>You’re offline</h3>
              <p>Check your connection and try again.</p>
              <button type="button" onClick={() => setRetryNonce(value => value + 1)}>Retry</button>
            </div>
          ) : loading ? (
            <div className="panda-search__loading" role="status" aria-live="polite">
              <ThinkingOrb state="searching" size={64} theme="dark" aria-label="Searching the catalogue" />
              <div className="panda-search__loading-copy">
                <span>Searching the catalogue</span>
                <p>Finding movies, series and anime</p>
              </div>
            </div>
          ) : error ? (
            <div className="panda-search__state" role="alert">
              <SearchIcon size={26} aria-hidden="true" />
              <h3>Search unavailable</h3>
              <p>{error}</p>
              <button type="button" onClick={() => setRetryNonce(value => value + 1)}>Try again</button>
            </div>
          ) : visibleResults.length ? (
            <Stagger className="panda-search__grid">
              {visibleResults.map((item, index) => (
                <ResultCard key={item.id} item={item} query={submittedQuery} priority={index < 6} />
              ))}
            </Stagger>
          ) : (
            <div className="panda-search__state">
              <SearchIcon size={26} aria-hidden="true" />
              <h3>{results.length ? 'No results in this filter' : `No results for “${submittedQuery}”`}</h3>
              <p>Try a different spelling, a broader title, or browse a mood below.</p>
              <button type="button" onClick={results.length ? () => setFilter('all') : clearAll}>
                {results.length ? 'Show all results' : 'Back to discovery'}
              </button>
            </div>
          )}
        </section>
      </div>

      <Footer />
    </div>
  );
}
