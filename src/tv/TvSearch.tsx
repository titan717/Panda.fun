import React, { useEffect, useRef, useState } from 'react';
import { api, MovieApiError } from '../lib/api';
import { useDpadFocus } from './useDpadFocus';
import { MediaPoster } from '../components/ui/MediaPoster';
import { buildDetailsHref } from '../lib/mediaRoute';
import type { AnimeItem } from '../types';
import { preferencesUtil } from '../lib/preferences';

const KEYS = [
  ['1','2','3','4','5','6','7','8','9','0'],
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['Z','X','C','V','B','N','M','Space','⌫'],
];

type Filter = 'all' | 'movie' | 'series' | 'anime';

export function TvSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AnimeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const inputRef = useDpadFocus('tv-search-input');
  const controllerRef = useRef<AbortController | null>(null);
  const [recent, setRecent] = useState<string[]>(() => preferencesUtil.getRecentSearches());

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = window.setTimeout(async () => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setLoading(true); setError(null);
      try {
        const data = await api.search(query.trim(), controller.signal);
        setResults(data.results);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof MovieApiError ? err.message : 'Search unavailable');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const filtered = results.filter(item =>
    filter === 'all' ? true :
    filter === 'movie' ? item.contentType === 'movie' :
    filter === 'series' ? item.contentType === 'series' :
    item.contentType === 'anime'
  );

  return (
    <div className="tv-search">
      <input
        ref={inputRef as any}
        className="tv-search__input"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search movies, series or anime"
        aria-label="Search"
      />
      <div className="tv-keyboard" role="group" aria-label="On-screen keyboard">
        {KEYS.flat().map(key => (
          <TvKey key={key} label={key} onPress={() => {
            if (key === '⌫') setQuery(q => q.slice(0, -1));
            else if (key === 'Space') setQuery(q => q + ' ');
            else setQuery(q => q + key);
          }} />
        ))}
      </div>
      <div className="tv-search__filters">
        {(['all','movie','series','anime'] as const).map(f => (
          <TvFilterButton key={f} label={f} active={filter === f} onClick={() => setFilter(f)} />
        ))}
      </div>
      {recent.length > 0 && !query && (
        <div className="tv-search__recent">
          {recent.slice(0, 6).map(r => (
            <button key={r} className="tv-search__recent-chip" onClick={() => setQuery(r)}>{r}</button>
          ))}
        </div>
      )}
      {loading && <div className="tv-search__loading" role="status">Searching…</div>}
      {error && <div className="tv-search__error" role="alert"><p>{error}</p><button type="button" onClick={() => setQuery(q => q)}>Retry</button></div>}
      {!loading && !error && !filtered.length && query && (
        <div className="tv-search__empty"><p>No results for “{query}”</p></div>
      )}
      <div className="tv-search__grid">
        {filtered.map(item => <TvSearchResultCard key={item.id} item={item} />)}
      </div>
    </div>
  );
}

function TvKey({ label, onPress }: { label: string; onPress: () => void }) {
  const ref = useDpadFocus(`key-${label}`);
  return <button ref={ref as any} className="tv-key" onClick={onPress}>{label}</button>;
}

function TvFilterButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const ref = useDpadFocus(`filter-${label}`);
  return <button ref={ref as any} className={`tv-filter${active ? ' is-active' : ''}`} onClick={onClick}>{label}</button>;
}

function TvSearchResultCard({ item }: { item: AnimeItem }) {
  const ref = useDpadFocus(`result-${item.id}`);
  const title = typeof item.title === 'string' ? item.title : item.title.english || 'Untitled';
  return (
    <button
      ref={ref as any}
      className="tv-search__card"
      onClick={() => window.location.assign(buildDetailsHref({ title, id: item.id }, item.contentType === 'movie' ? 'movie' : 'series'))}
    >
      <MediaPoster src={item.image} alt={title} layoutId={`poster-${item.id}`} size="tv" />
      <span>{title}</span>
    </button>
  );
}
