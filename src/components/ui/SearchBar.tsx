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

  const { data, isLoading } = useSWR(
    debouncedQuery.length >= 2 ? `search-${debouncedQuery}` : null,
    () => api.search(debouncedQuery)
  );

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
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search anime..."
          className="w-full rounded-xl bg-[#18181f] border border-[#272733] focus:border-[#9c27b0] focus:ring-2 focus:ring-[#9c27b0]/20 hover:border-[#383848] py-2.5 pl-10 pr-12 text-sm text-white placeholder-gray-500 outline-none transition-all duration-200"
          autoComplete="off"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-auto px-1.5 h-5 rounded bg-[#252530] text-[10px] font-bold text-gray-400 border border-[#333342] pointer-events-none">
          Ctrl K
        </div>
      </form>

      {/* Suggestion Dropdown */}
      <AnimatePresence>
        {isOpen && debouncedQuery.length >= 2 && (
          <motion.div 
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute top-full left-0 right-0 mt-2 bg-[#171720]/95 backdrop-blur-xl border border-[#2b2b3b] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.7)] overflow-hidden z-50 flex flex-col max-h-[400px]"
          >
            {isLoading ? (
              <div className="p-4 flex items-center justify-center text-gray-400 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#9c27b0]" />
                <span className="text-sm font-medium">Searching...</span>
              </div>
            ) : data?.results?.length > 0 ? (
              <div className="overflow-y-auto no-scrollbar py-2">
                {data.results.slice(0, 6).map((item: any) => {
                  const itemTitle = typeof item.title === 'string'
                    ? item.title
                    : item.title?.english || item.title?.romaji || item.title?.native || 'Untitled';
                  return (
                  <div 
                    key={item.id}
                    onClick={() => {
                      setLocation(buildDetailsHref(itemTitle, item.type === 'movie' ? 'movie' : 'series', item.id));
                      setIsOpen(false);
                      setQuery('');
                    }}
                    className="flex items-center gap-3 p-2.5 mx-2 rounded-lg hover:bg-[#252533] cursor-pointer transition-colors group/item"
                  >
                    <img src={item.image || DEFAULT_POSTER} alt="cover" className="w-10 h-14 object-cover rounded-md shadow-sm group-hover/item:scale-105 transition-transform" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-gray-200 group-hover/item:text-[#c084fc] transition-colors truncate">
                        {typeof item.title === 'string' ? item.title : (item.title?.english || item.title?.romaji)}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                        {item.releaseDate && <span>{item.releaseDate}</span>}
                        {item.type && <span className="px-1.5 py-0.5 bg-[#252532] rounded text-[10px] font-bold text-gray-300">{item.type}</span>}
                      </div>
                    </div>
                  </div>
                  );
                })}
                <div 
                  onClick={handleSubmit}
                  className="mt-1 p-3 text-center text-xs font-bold text-[#c084fc] hover:text-white cursor-pointer border-t border-[#262635] hover:bg-[#252533] transition-colors tracking-wide"
                >
                  View all results for "{debouncedQuery}"
                </div>
              </div>
            ) : (
              <div className="p-5 text-center text-sm text-gray-400">
                No results found for "{debouncedQuery}"
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
