import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');
const layout = read('../Layout.tsx');
const mobileShell = read('./mobile-shell.css');
const mobileHome = read('../../pages/MobileHome.tsx');
const homeStyles = read('../../pages/mobile-home.css');
const search = read('../../pages/Search.tsx');

describe('MYpanda.fun mobile shell contract', () => {
  it('uses a shared mobile header and route-aware three-item navigation', () => {
    expect(layout).toContain('panda-mobile-header');
    expect(layout).toContain('aria-label="Settings"');
    expect(layout).toContain('href="/settings"');
    const mobileHeader = layout.slice(layout.indexOf('<header className="panda-mobile-header">'), layout.indexOf('</header>'));
    expect(mobileHeader).toContain('aria-label="Settings"');
    expect(mobileHeader).not.toContain('Profile');
    expect(layout).not.toContain('aria-label="Search movies and shows"');
    expect(layout).toContain('panda-mobile-bottom-nav');
    expect(layout).toContain("location.startsWith('/watch/')");
    expect(layout).toContain("href === '/library' ? 'Library' : label");
    expect(layout).toContain("const pathname = location.split('?')[0]");
    expect(layout).toContain("pathname === '/search'");
  });

  it('keeps the mobile page surfaces black and makes Watch a viewport-filling shell-free player', () => {
    expect(mobileShell).toContain('background: #000 !important');
    expect(mobileShell).toContain('.panda-app-shell--player .panda-mobile-header');
    expect(mobileShell).toContain('height: 100dvh !important');
    expect(mobileShell).toContain('width: 100vw !important');
    expect(mobileShell).toContain('display: block !important;');
    expect(mobileShell).toContain('flex: none !important;');
    expect(mobileShell).toContain('.panda-mobile-featured__loading');
    expect(mobileShell).toContain('right: 12px !important');
    expect(mobileShell).toContain('border-radius: 22px');
    expect(mobileShell).toContain('bottom: calc(8px + env(safe-area-inset-bottom, 0px)) !important');
  });

  it('includes Top 10 and the planned catalogue rows without replacing the existing API', () => {
    for (const section of ['Top 10', 'Trending Now', 'New on Netflix', 'New on Disney+', 'Popular Movies', 'Popular TV Shows', 'Airing Today']) {
      expect(mobileHome).toContain(section);
    }
    expect(mobileHome).toContain('<ModernContinueWatching />');
    expect(mobileHome).toContain('buildDetailsHref');
    expect(homeStyles).toContain('overflow-x: clip');
    expect(mobileHome).toContain('panda-mobile-featured__spotlight');
    expect(mobileHome).not.toContain('PANDA SPOTLIGHT');
    expect(mobileHome).toContain('onTouchStart={handleFeaturedTouchStart}');
    expect(mobileHome).toContain('onTouchEnd={handleFeaturedTouchEnd}');
    expect(homeStyles).toContain('panda-mobile-featured__spotlight-track');
    expect(homeStyles).toContain('touch-action: pan-y');
    expect(homeStyles).toContain('panda-featured-swipe-in');
    expect(homeStyles).not.toContain('panda-mobile-featured__viewport');
    expect(homeStyles).toContain('background: #fff');
    expect(mobileHome).toContain('buildWatchHref(featured.id');
    expect(mobileHome).toContain('panda-mobile-featured__segment');
    expect(mobileHome).toContain('aria-label="Featured title progress"');
    expect(mobileHome).toContain("aria-current={index === activeIndex ? 'true' : undefined}");
    expect(mobileHome).not.toContain('Previous featured title');
    expect(mobileHome).not.toContain('Next featured title');
    expect(homeStyles).toContain('panda-mobile-featured__art::after');
    expect(homeStyles).toContain('prefers-reduced-motion: reduce');
  });

  it('uses the Thinking Orbs searching state in the redesigned search layout', () => {
    expect(search).toContain("import { ThinkingOrb } from 'thinking-orbs'");
    expect(search).toContain('<ThinkingOrb state="searching"');
    expect(search).toContain('panda-search__loading');
    expect(search).not.toContain('<h3>Searching…</h3>');
  });

  it('keeps search mascot-free with a sticky accessible search field', () => {
    expect(search).not.toContain('panda-search-companion');
    expect(search).toContain('role="search" aria-label="Search the catalogue"');
    expect(search).toContain('aria-label="Search movies, series or anime"');
    expect(search).toContain('panda-search__field');
  });

  it('preserves the existing search API, recent searches, and supported filters', () => {
    expect(search).toContain('api.search(submittedQuery, controller.signal)');
    expect(search).toContain('api.getTrending()');
    expect(search).toContain('preferencesUtil.addRecentSearch(clean)');
    expect(search).toContain("filter === 'movie'");
    expect(search).toContain("filter === 'series'");
    expect(search).toContain("{ id: 'anime', label: 'Anime' }");
    expect(search).toContain('Try again');
  });
});
