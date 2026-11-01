import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');
const layout = read('../Layout.tsx');
const mobileShell = read('./mobile-shell.css');
const mobileHome = read('../../pages/MobileHome.tsx');
const home = read('../../pages/Home.tsx');
const homeStyles = read('../../pages/mobile-home.css');
const search = read('../../pages/Search.tsx');

describe('Panda.fun mobile shell contract', () => {
  it('uses a scroll-aware brand header, quick actions and home category filters', () => {
    expect(layout).toContain('panda-mobile-header');
    expect(layout).toContain('headerScrolled ?');
    expect(layout).toContain('href="/search"');
    expect(layout).toContain('href="/profile"');
    expect(layout).toContain('panda-mobile-category-row');
    expect(layout).toContain('panda_home_category_select');
    expect(layout).toContain("location.split('?')[0] === '/home'");
  });

  it('uses four route-aware navigation items and hides them on the player route', () => {
    expect(layout).toContain('panda-mobile-bottom-nav');
    expect(layout).toContain("href === '/settings' && pathname === '/settings'");
    expect(layout).toContain("href === '/library' ? 'Library' : label");
    expect(layout).toContain("location.startsWith('/watch/')");
    expect(layout).toContain('native?.setPlayerPage?.(isPlayerRoute)');
    expect(layout).toContain('navigator.vibrate?.(8)');
    expect(layout).toContain('panda-mobile-bottom-nav__active-pill');
  });

  it('keeps near-black mobile surfaces, safe insets and a three-button fallback', () => {
    expect(mobileShell).toContain('background: #000 !important');
    expect(mobileShell).toContain('.panda-app-shell--player .panda-mobile-header');
    expect(mobileShell).toContain('height: 100dvh !important');
    expect(mobileShell).toContain('width: 100vw !important');
    expect(mobileShell).toContain('var(--safe-top, 0px)');
    expect(mobileShell).toContain('var(--safe-bottom, env(safe-area-inset-bottom, 0px))');
    expect(mobileShell).toContain('bottom: calc(8px + var(--safe-bottom, env(safe-area-inset-bottom, 0px))) !important');
    expect(mobileShell).toContain('.system-nav-visible .panda-mobile-bottom-nav');
    expect(mobileShell).toContain('.panda-mobile-bottom-nav__active-pill');
  });

  it('includes the complete Home catalogue and lazily loads genre shelves', () => {
    for (const section of ['Top 10', 'Trending Now', 'New on Netflix', 'New on Disney+', 'Popular Movies', 'Popular TV Shows', 'Airing Today', 'Coming Soon', 'Because You Watched']) {
      expect(home + mobileHome).toContain(section);
    }
    expect(mobileHome).toContain('<ModernContinueWatching />');
    expect(mobileHome).toContain('function LazyGenreRail');
    expect(mobileHome).toContain('IntersectionObserver');
    expect(mobileHome).toContain('api.getGenreMedia');
    expect(mobileHome).toContain('api.getGenreAnime');
    expect(home).toContain('getUpcomingMovies');
    expect(home).toContain('getUpcomingTv');
    expect(home).toContain('getRecommendations');
    expect(home).toContain('getGenreMedia');
    expect(home).toContain('getGenreAnime');
    expect(mobileHome).toContain('buildDetailsHref');
    expect(mobileHome).toContain('buildWatchHref(featured.id');
    expect(mobileHome).toContain('panda-mobile-featured__segment');
    expect(mobileHome).toContain('aria-label="Featured title progress"');
    expect(mobileHome).not.toContain('Previous featured title');
    expect(mobileHome).not.toContain('Next featured title');
    expect(homeStyles).toContain('prefers-reduced-motion: reduce');
  });

  it('keeps the shared motion system and reduced-motion support on the mobile billboard', () => {
    expect(mobileHome).toContain("from '../motion'");
    expect(mobileHome).toContain('useMotionPreference');
    expect(mobileHome).toContain('motionPreference === \'full\'');
    expect(mobileHome).toContain('<Reveal');
    expect(mobileHome).toContain('<Pressable');
    expect(mobileHome).toContain('<Shimmer');
  });

  it('uses the branded search layout and preserves the search API and recent searches', () => {
    expect(search).toContain("import { ThinkingOrb } from 'thinking-orbs'");
    expect(search).toContain('<ThinkingOrb state="searching"');
    expect(search).toContain('panda-search__loading');
    expect(search).not.toContain('panda-search-companion');
    expect(search).toContain('role="search" aria-label="Search the catalogue"');
    expect(search).toContain('aria-label="Search movies, series or anime"');
    expect(search).toContain('api.search(submittedQuery, controller.signal)');
    expect(search).toContain('api.getTrending()');
    expect(search).toContain('getGenreSearchResults(genreFilter)');
    expect(search).toContain("params.get('genre')");
    expect(search).toContain('api.getGenreMedia');
    expect(search).toContain('api.getGenreAnime');
    expect(search).toContain('preferencesUtil.addRecentSearch(clean)');
    expect(search).toContain('preferencesUtil.removeRecentSearch');
    expect(search).toContain('preferencesUtil.clearRecentSearches');
    expect(search).toContain("{ id: 'all', label: 'All' }");
    expect(search).toContain("{ id: 'movie', label: 'Movies' }");
    expect(search).toContain("{ id: 'series', label: 'TV' }");
    expect(search).toContain("{ id: 'anime', label: 'Anime' }");
  });
});
