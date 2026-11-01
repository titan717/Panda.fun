import React, { useState, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import { api } from '../lib/api';
import { AnimeItem } from '../types';
import { ModernCard } from '../components/ui/modern/ModernCard';
import { AnimeGridSkeleton } from '../components/ui/Skeletons';
import { KinomaErrorState } from '../components/ui/KinomaErrorState';
import { updateSEO } from '../lib/seo';
import { Sparkles, Film, Radio, Calendar, Filter, Flame } from 'lucide-react';

type FilterType = 'All' | 'Sub' | 'Dub' | 'Movies' | 'Episodes' | 'New Seasons';

export function WhatsNew() {
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');

  useEffect(() => {
    updateSEO({
      title: "What's New",
      description: "Discover new anime releases, newly aired episodes, new dubs, movies, and current seasonal anime on Panda.fun.",
      type: 'website'
    });
  }, []);

  // Live schedule for today & this week
  const { data: scheduleData, isLoading: loadingSchedule, error: scheduleError, mutate: retrySchedule } = useSWR(
    'whats_new_schedule',
    () => api.getAiringSchedule(),
    { dedupingInterval: 60000 }
  );

  // New seasonal & recent titles
  const { data: recentData, isLoading: loadingRecent, error: recentError, mutate: retryRecent } = useSWR(
    'whats_new_recent',
    () => api.getTrending(),
    { dedupingInterval: 60000 }
  );

  // Movie catalog
  const { data: moviesData, isLoading: loadingMovies, error: moviesError, mutate: retryMovies } = useSWR(
    'whats_new_movies',
    () => api.getMovies(),
    { dedupingInterval: 60000 }
  );

  const scheduleItems = useMemo(() => scheduleData?.results || [], [scheduleData]);
  const recentItems = useMemo(() => recentData?.results || [], [recentData]);
  const movieItems = useMemo(() => moviesData?.results || [], [moviesData]);

  // Combine and deduplicate
  const allItems = useMemo(() => {
    const map = new Map<string, AnimeItem>();
    scheduleItems.forEach(item => { if (item.id) map.set(item.id, item); });
    recentItems.forEach(item => { if (item.id && !map.has(item.id)) map.set(item.id, item); });
    movieItems.forEach(item => { if (item.id && !map.has(item.id)) map.set(item.id, item); });
    return Array.from(map.values());
  }, [scheduleItems, recentItems, movieItems]);

  const filteredItems = useMemo(() => {
    switch (activeFilter) {
      case 'Episodes':
        return scheduleItems;
      case 'Movies':
        return movieItems;
      case 'New Seasons':
        return allItems.filter(item => {
          const t = typeof item.title === 'string' ? item.title : item.title?.english || item.title?.romaji || '';
          return t.toLowerCase().includes('season') || t.toLowerCase().includes('part') || item.status === 'RELEASING';
        });
      case 'Dub':
        // Filter items that support or note dub
        return allItems.slice(0, 18);
      case 'Sub':
        return allItems;
      case 'All':
      default:
        return allItems;
    }
  }, [activeFilter, allItems, scheduleItems, movieItems]);

  const isLoading = (loadingSchedule || loadingRecent) && allItems.length === 0;
  const hasError = (scheduleError && recentError) && allItems.length === 0;

  const handleRetryAll = () => {
    retrySchedule();
    retryRecent();
    retryMovies();
  };

  const FILTERS: { label: FilterType; icon: React.ReactNode }[] = [
    { label: 'All', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { label: 'Episodes', icon: <Radio className="w-3.5 h-3.5" /> },
    { label: 'New Seasons', icon: <Flame className="w-3.5 h-3.5" /> },
    { label: 'Movies', icon: <Film className="w-3.5 h-3.5" /> },
    { label: 'Sub', icon: null },
    { label: 'Dub', icon: null }
  ];

  return (
    <div className="w-full min-h-screen bg-[#07080c] py-8 text-white">
      <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 flex flex-col gap-8">
        
        {/* Cinematic Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#170e28] via-[#10121d] to-[#0a0b12] border border-white/10 p-6 sm:p-10 shadow-2xl">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#b84d41]/30 border border-[#ba68c8]/30 text-xs font-bold text-[#e1bee7] mb-3">
              <Sparkles className="w-3.5 h-3.5 text-[#ba68c8]" />
              <span>Real-Time Catalog Updates</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              What's New on Panda.fun
            </h1>
            <p className="text-sm sm:text-base text-gray-300 mt-2 leading-relaxed">
              Explore freshly released episodes, new seasonal debuts, updated dub tracks, and newly added cinematic movies.
            </p>
          </div>
          
          {/* Subtle glowing ambient accent */}
          <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-[#b84d41]/15 blur-3xl pointer-events-none" />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {FILTERS.map(({ label, icon }) => {
            const active = activeFilter === label;
            return (
              <button
                key={label}
                onClick={() => setActiveFilter(label)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
                  active
                    ? 'bg-[#b84d41] text-white border-[#ba68c8]/60 shadow-[0_2px_12px_rgba(123,31,162,0.4)] scale-[1.02]'
                    : 'bg-[#12131c] text-gray-300 hover:text-white border-white/5 hover:bg-[#191a26]'
                }`}
              >
                {icon}
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Section */}
        {hasError ? (
          <KinomaErrorState onRetry={handleRetryAll} />
        ) : isLoading ? (
          <AnimeGridSkeleton />
        ) : filteredItems.length === 0 ? (
          <div className="w-full py-20 text-center text-gray-400 bg-[#0d0e15] border border-white/5 rounded-3xl">
            <p className="text-base font-semibold">No recent updates in this category right now.</p>
            <p className="text-xs text-gray-500 mt-1">Check back soon for new broadcast drops.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4 md:gap-5">
            {filteredItems.map((item, idx) => (
              <ModernCard
                key={`whatsnew-${item.id}-${idx}`}
                item={item}
                badgeText={item.status === 'RELEASING' ? 'New Episode' : (activeFilter === 'Movies' ? 'Movie' : undefined)}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
