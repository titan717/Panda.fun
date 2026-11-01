import { act, type ReactNode, type ButtonHTMLAttributes, type HTMLAttributes, type AnchorHTMLAttributes } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  getTrending: vi.fn(),
  getDetails: vi.fn(),
  getRecommendations: vi.fn(),
  getDetailsMediaId: vi.fn(),
  toggleFavorite: vi.fn(),
  toggleWatchlist: vi.fn(),
  isFavorite: vi.fn(),
  isInWatchlist: vi.fn(),
  getRecentSearches: vi.fn(),
  addRecentSearch: vi.fn(),
  removeRecentSearch: vi.fn(),
  clearRecentSearches: vi.fn(),
  saveMeta: vi.fn(),
  getAnimeProgress: vi.fn(),
  getAnimeEpisodesProgress: vi.fn(),
  setLocation: vi.fn(),
  updateSEO: vi.fn(),
  trackGAEvent: vi.fn()
}));

vi.mock('../lib/api', () => ({
  api: {
    search: mocks.search,
    getTrending: mocks.getTrending,
    getDetails: mocks.getDetails,
    getRecommendations: mocks.getRecommendations,
    getDetailsMediaId: mocks.getDetailsMediaId
  },
  MovieApiError: class MovieApiError extends Error {},
  resolveMediaIdFromSlug: vi.fn(() => Promise.resolve('movie-123'))
}));

vi.mock('../lib/library', () => ({
  libraryManager: {
    toggleFavorite: mocks.toggleFavorite,
    toggleWatchlist: mocks.toggleWatchlist,
    isFavorite: mocks.isFavorite,
    isInWatchlist: mocks.isInWatchlist
  }
}));

vi.mock('../lib/preferences', () => ({
  preferencesUtil: {
    getRecentSearches: mocks.getRecentSearches,
    addRecentSearch: mocks.addRecentSearch,
    removeRecentSearch: mocks.removeRecentSearch,
    clearRecentSearches: mocks.clearRecentSearches
  }
}));

vi.mock('../lib/history', () => ({
  historyUtil: {
    saveMeta: mocks.saveMeta,
    getAnimeProgress: mocks.getAnimeProgress,
    getAnimeEpisodesProgress: mocks.getAnimeEpisodesProgress
  }
}));

vi.mock('../lib/seo', () => ({ updateSEO: mocks.updateSEO }));
vi.mock('../lib/analytics', () => ({ trackGAEvent: mocks.trackGAEvent }));
vi.mock('../lib/mediaImages', () => ({ optimizeImageUrl: (url: string) => url }));
vi.mock('../lib/mediaRoute', () => ({
  buildDetailsHref: () => '/details/the-matrix',
  buildWatchHref: () => '/watch/movie-123',
  parseDetailsRouteSearch: () => ({ type: 'movie', mediaId: 'movie-123' })
}));
vi.mock('../components/ui/Footer', () => ({ Footer: () => null }));

vi.mock('../motion', async () => {
  const ReactModule = await import('react');
  const Pressable = ReactModule.forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
    (props, ref) => ReactModule.createElement('button', { ...props, ref })
  );
  const Wrapper = ({ children, ...props }: HTMLAttributes<HTMLDivElement>) =>
    ReactModule.createElement('div', props, children);
  return {
    Pressable,
    Reveal: Wrapper,
    Stagger: Wrapper,
    ProgressRing: () => null,
    useMotionPreference: () => 'minimal'
  };
});

vi.mock('thinking-orbs', async () => {
  const ReactModule = await import('react');
  return { ThinkingOrb: (props: React.HTMLAttributes<HTMLDivElement>) => ReactModule.createElement('div', props) };
});

vi.mock('wouter', async () => {
  const ReactModule = await import('react');
  return {
    Link: ({ href, children, ...props }: { href: string; children?: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) =>
      ReactModule.createElement('a', { href, ...props }, children),
    useLocation: () => ['/search', mocks.setLocation],
    useSearch: () => window.location.search.slice(1),
    useRoute: () => [true, { id: 'the-matrix' }]
  };
});

import { Details } from './Details';
import { Search } from './Search';

type MountedView = {
  container: HTMLDivElement;
  root: Root;
  unmount: () => Promise<void>;
};

async function mount(node: ReactNode): Promise<MountedView> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
  });
  await act(async () => {
    await new Promise(resolve => window.setTimeout(resolve, 0));
  });
  return {
    container,
    root,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    }
  };
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mocks.search.mockResolvedValue({ results: [] });
  mocks.getTrending.mockResolvedValue({ results: [] });
  mocks.getDetails.mockResolvedValue({
    title: 'The Matrix',
    contentType: 'movie',
    description: 'A computer hacker learns the truth.',
    image: 'https://images.example/matrix-poster.jpg',
    cover: 'https://images.example/matrix-backdrop.jpg',
    releaseDate: '1999',
    genres: [],
    trailer: null
  });
  mocks.getRecommendations.mockResolvedValue({ results: [] });
  mocks.getDetailsMediaId.mockReturnValue({ type: 'movie' });
  mocks.getRecentSearches.mockReturnValue([]);
  mocks.isFavorite.mockReturnValue(false);
  mocks.isInWatchlist.mockReturnValue(false);
  mocks.toggleFavorite.mockReturnValue(true);
  mocks.toggleWatchlist.mockReturnValue(true);
  mocks.getAnimeProgress.mockReturnValue(null);
  mocks.getAnimeEpisodesProgress.mockReturnValue({});
  window.history.replaceState({}, '', '/search?keyword=matrix');
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('OTT page behavior', () => {
  it('renders Search result cards from the search API', async () => {
    mocks.search.mockResolvedValue({
      results: [{
        id: 'movie-123',
        title: 'The Matrix',
        contentType: 'movie',
        releaseDate: '1999',
        rating: 8.7,
        image: 'https://images.example/matrix-poster.jpg'
      }]
    });

    const view = await mount(<Search />);
    try {
      expect(mocks.search).toHaveBeenCalledWith('matrix', expect.any(AbortSignal));
      expect(view.container.querySelector('.panda-search-card')).not.toBeNull();
      expect(view.container.textContent).toContain('The Matrix');
    } finally {
      await view.unmount();
    }
  });

  it('renders the Search empty state when the API returns no matches', async () => {
    window.history.replaceState({}, '', '/search?keyword=unknown-title');
    mocks.search.mockResolvedValue({ results: [] });

    const view = await mount(<Search />);
    try {
      expect(view.container.textContent).toContain('No results for “unknown-title”');
      expect(view.container.querySelector('.panda-search__state')).not.toBeNull();
    } finally {
      await view.unmount();
    }
  });

  it('toggles Favourite and My List using the current Details media ID', async () => {
    window.history.replaceState({}, '', '/details/the-matrix?type=movie&mediaId=movie-123');
    const view = await mount(<Details />);
    try {
      const favourite = view.container.querySelector<HTMLButtonElement>('button[aria-label="Add to favourites"]');
      const myList = view.container.querySelector<HTMLButtonElement>('button[aria-label="Add to My List"]');
      expect(favourite).not.toBeNull();
      expect(myList).not.toBeNull();

      await act(async () => favourite?.click());
      await act(async () => myList?.click());

      expect(mocks.toggleFavorite).toHaveBeenCalledWith({
        id: 'movie-123',
        title: 'The Matrix',
        image: 'https://images.example/matrix-poster.jpg'
      });
      expect(mocks.toggleWatchlist).toHaveBeenCalledWith({
        id: 'movie-123',
        title: 'The Matrix',
        image: 'https://images.example/matrix-poster.jpg'
      });
    } finally {
      await view.unmount();
    }
  });
});
