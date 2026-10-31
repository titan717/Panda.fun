import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import useSWR from 'swr';
import { Search, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../../lib/api';
import { DEFAULT_POSTER } from '../../types';
import { buildDetailsHref } from '../../lib/mediaRoute';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [, setLocation] = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce the input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  // Handle clicking outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle Ctrl+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const { data, isLoading, error, mutate } = useSWR(
    debouncedQuery.length >= 2 ? `search-${debouncedQuery}` : null,
    () => api.search(debouncedQuery)
  );

  const isDebouncing = query.trim().length >= 2 && query.trim() !== debouncedQuery.trim();
  const suggestions = !isDebouncing && !error ? data?.results?.slice(0, 6) || [] : [];
  useEffect(() => setActiveIndex(-1), [debouncedQuery]);
  const selectSuggestion = (item: any) => {
    const itemTitle = typeof item.title === 'string'
      ? item.title
      : item.title?.english || item.title?.romaji || item.title?.native || 'Untitled';
    setLocation(buildDetailsHref(itemTitle, item.type === 'movie' ? 'movie' : 'series', item.id));
    setIsOpen(false);
    setQuery('');
    setActiveIndex(-1);
  };
  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && suggestions.length) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex(index => Math.min(index + 1, suggestions.length - 1));
    } else if (event.key === 'ArrowUp' && suggestions.length) {
      event.preventDefault();
      setActiveIndex(index => Math.max(index - 1, -1));
    } else if (event.key === 'Enter' && activeIndex >= 0 && suggestions[activeIndex]) {
      event.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (event.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setLocation(`/search?keyword=${encodeURIComponent(query)}`);
      setIsOpen(false);
    }
  };

  return (
    <div ref={ref} className="w-full relative group">
      <form onSubmit={handleSubmit} className="w-full relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 group-hover:text-gray-300 transition-colors pointer-events-none">
          <Search className="h-4 w-4" />
        </div>
        <input 
          ref={inputRef}
          type="text" 
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(-1);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          id="global-search"
          name="search"
          placeholder="Search movies, shows and anime…"
          aria-label="Search movies, shows and anime"
          className="w-full rounded-xl bg-[#18181f] border border-[#272733] focus:border-[#9c27b0] focus:ring-2 focus:ring-[#9c27b0]/20 hover:border-[#383848] py-2.5 pl-10 pr-12 text-sm text-white placeholder-gray-500 outline-none transition-all duration-200"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen && query.trim().length >= 2}
          aria-controls={suggestions.length ? "panda-global-search-suggestions" : undefined}
          aria-activedescendant={activeIndex >= 0 && suggestions[activeIndex] ? `panda-search-option-${activeIndex}` : undefined}
          onKeyDown={handleInputKeyDown}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-auto px-1.5 h-5 rounded bg-[#252530] text-[10px] font-bold text-gray-400 border border-[#333342] pointer-events-none">
          Ctrl K
        </div>
      </form>

      {/* Suggestion Dropdown */}
      <AnimatePresence>
        {isOpen && query.trim().length >= 2 && (
          <motion.div 
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute top-full left-0 right-0 mt-2 bg-[#171720]/95 backdrop-blur-xl border border-[#2b2b3b] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.7)] overflow-hidden z-50 flex flex-col max-h-[400px]"
          >
            {isDebouncing || isLoading ? (
              <div className="p-4 flex items-center justify-center text-gray-400 gap-2" role="status" aria-live="polite">
                <Loader2 className="w-4 h-4 animate-spin text-[#9c27b0]" />
                <span className="text-sm font-medium">Searching...</span>
              </div>
            ) : error ? (
              <div className="p-5 text-center" role="alert">
                <p className="text-sm font-semibold text-white">Search suggestions unavailable</p>
                <p className="mt-1 text-xs text-gray-400">Check your connection and try again.</p>
                <button type="button" onClick={() => void mutate()} className="mt-3 min-h-11 rounded-full border border-white/20 px-4 text-xs font-bold text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">Try again</button>
              </div>
            ) : data?.results?.length > 0 ? (
              <div id="panda-global-search-suggestions" className="overflow-y-auto no-scrollbar py-2" role="listbox" aria-label="Search suggestions" aria-busy={isLoading}>
                {data.results.slice(0, 6).map((item: any, index: number) => {
                  const itemTitle = typeof item.title === 'string'
                    ? item.title
                    : item.title?.english || item.title?.romaji || item.title?.native || 'Untitled';
                  return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    id={`panda-search-option-${index}`}
                    aria-label={`Open ${itemTitle} details`}
                    aria-selected={activeIndex === index}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectSuggestion(item)}
                    className={`flex w-[calc(100%-16px)] items-center gap-3 p-2.5 mx-2 rounded-lg text-left transition-colors group/item focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c084fc] ${activeIndex === index ? 'bg-[#252533]' : 'hover:bg-[#252533]'}`}
                  >
                    <img src={item.image || DEFAULT_POSTER} alt="" className="w-10 h-14 object-cover rounded-md shadow-sm group-hover/item:scale-105 transition-transform" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-gray-200 group-hover/item:text-[#c084fc] transition-colors truncate">
                        {typeof item.title === 'string' ? item.title : (item.title?.english || item.title?.romaji)}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                        {item.releaseDate && <span>{item.releaseDate}</span>}
                        {item.type && <span className="px-1.5 py-0.5 bg-[#252532] rounded text-[10px] font-bold text-gray-300">{item.type}</span>}
                      </div>
                    </div>
                  </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setLocation('/search?keyword=' + encodeURIComponent(query.trim() || debouncedQuery));
                    setIsOpen(false);
                  }}
                  className="mt-1 w-full p-3 text-center text-xs font-bold text-[#c084fc] hover:text-white border-t border-[#262635] hover:bg-[#252533] transition-colors tracking-wide focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#c084fc]"
                >
                  View all results for "{debouncedQuery}"
                </button>
              </div>
            ) : (
              <div className="p-5 text-center text-sm text-gray-400" role="status">
                No results found for "{debouncedQuery}"
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
