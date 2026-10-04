import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { KinomaLogo } from './ui/KinomaLogo';
import {
  House,
  Search,
  Library,
  Settings,
  Info,
  UserRound,
  Pin,
  PinOff,
  ChevronRight,
  X,
} from 'lucide-react';

export const ITEMS = [
  { href: '/home', label: 'Home', Icon: House },
  { href: '/search', label: 'Search', Icon: Search },
  { href: '/library', label: 'My List', Icon: Library },
  { href: '/settings', label: 'Settings', Icon: Settings },
];

export const ABOUT_ITEMS = [
  { href: '/about', label: 'About Panda.fun' },
  { href: '/docs', label: 'API Docs' },
  { href: '/terms', label: 'Terms of Service' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/contact', label: 'Contact / Support' },
];

const STORAGE_EXPANDED = 'panda_sidebar_expanded';
const STORAGE_PINNED = 'panda_sidebar_pinned';

function readStorage(key: string, fallback: boolean) {
  try {
    if (typeof window === 'undefined') return fallback;
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value === 'true';
  } catch {
    return fallback;
  }
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [pinned, setPinned] = useState(() => readStorage(STORAGE_PINNED, false));
  const [expanded, setExpanded] = useState(() => readStorage(STORAGE_EXPANDED, false));
  const [aboutOpen, setAboutOpen] = useState(() =>
    ['/about', '/terms', '/privacy', '/contact'].includes(window.location.pathname)
  );
  const collapseTimer = useRef<number | null>(null);
  const expandTimer = useRef<number | null>(null);
  const aboutTriggerRef = useRef<HTMLButtonElement | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);

  const clearTimers = () => {
    if (collapseTimer.current !== null) window.clearTimeout(collapseTimer.current);
    if (expandTimer.current !== null) window.clearTimeout(expandTimer.current);
    collapseTimer.current = null;
    expandTimer.current = null;
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_PINNED, String(pinned));
      window.localStorage.setItem(STORAGE_EXPANDED, String(expanded));
    } catch {}
  }, [expanded, pinned]);

  useEffect(() => {
    if (!['/about', '/terms', '/privacy', '/contact'].includes(location)) {
      setAboutOpen(false);
    }
  }, [location]);

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, [location]);

  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !aboutOpen) return;
      setAboutOpen(false);
      window.requestAnimationFrame(() => aboutTriggerRef.current?.focus());
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [aboutOpen]);

  const canHoverExpand = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const expandWithDelay = () => {
    if (pinned || !canHoverExpand()) return;
    if (collapseTimer.current !== null) window.clearTimeout(collapseTimer.current);
    expandTimer.current = window.setTimeout(() => {
      setExpanded(true);
      expandTimer.current = null;
    }, 120);
  };

  const collapseWithDelay = () => {
    if (pinned || !canHoverExpand()) return;
    if (expandTimer.current !== null) window.clearTimeout(expandTimer.current);
    collapseTimer.current = window.setTimeout(() => {
      setExpanded(false);
      setAboutOpen(false);
      collapseTimer.current = null;
    }, 320);
  };

  const togglePinned = () => {
    clearTimers();
    setPinned(value => {
      const next = !value;
      setExpanded(next);
      return next;
    });
  };

  const aboutActive = ['/about', '/terms', '/privacy', '/contact'].includes(location);

  return (
    <div
      className="panda-app-shell kinoma-app-shell"
      aria-label="Panda.fun application"
      style={{ '--sidebar-width': expanded ? '236px' : '72px' } as React.CSSProperties}
    >
      <a className="panda-skip-link" href="#panda-main-content">
        Skip to main content
      </a>

      <div className="panda-mobile-topbar" aria-label="Panda.fun mobile navigation">
        <Link href="/home" className="panda-mobile-topbar__brand" aria-label="Panda.fun home">
          <KinomaLogo size="sm" variant="mark" className="panda-mobile-topbar__logo" />
        </Link>
        <div className="panda-mobile-topbar__actions">
          <Link href="/search" className={`panda-mobile-topbar__action ${location === '/search' ? 'is-active' : ''}`} aria-label="Search">
            <Search size={18} strokeWidth={1.8} aria-hidden="true" />
          </Link>
          <Link href="/profile" className={`panda-mobile-topbar__action ${location === '/profile' ? 'is-active' : ''}`} aria-label="Profile">
            <UserRound size={18} strokeWidth={1.8} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <aside
        className={`kinoma-sidebar ${expanded ? 'is-expanded' : 'is-collapsed'} ${pinned ? 'is-pinned' : ''}`}
        aria-label="Panda.fun primary navigation"
        onPointerEnter={expandWithDelay}
        onPointerLeave={collapseWithDelay}
      >
        <div className="kinoma-sidebar__top">
          <Link href="/home" className="kinoma-sidebar__brand kinoma-focus" aria-label="Panda.fun home">
            <KinomaLogo
              size={expanded ? 'md' : 'sm'}
              variant={expanded ? 'full' : 'mark'}
              className="kinoma-sidebar__logo"
            />
          </Link>

          {expanded && (
            <button
              type="button"
              className="kinoma-sidebar__pin kinoma-focus"
              onClick={togglePinned}
              aria-label={pinned ? 'Unpin sidebar' : 'Pin sidebar'}
              aria-pressed={pinned}
              data-tooltip={pinned ? 'Unpin sidebar' : 'Pin sidebar'}
            >
              {pinned ? <PinOff size={16} strokeWidth={1.8} /> : <Pin size={16} strokeWidth={1.8} />}
            </button>
          )}
        </div>

        <nav className="kinoma-sidebar__nav" aria-label="Main navigation">
          <div className="kinoma-sidebar__nav-group">
            {ITEMS.map(({ href, label, Icon }) => {
              const active =
                location === href ||
                (href === '/search' && (location === '/explore' || location === '/whats-new'));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`kinoma-sidebar__item ${active ? 'is-active' : ''}`}
                  aria-label={label}
                  aria-current={active ? 'page' : undefined}
                  data-tooltip={label}
                >
                  <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              );
            })}

            <div className={`kinoma-sidebar__about ${aboutActive ? 'is-active' : ''}`}>
              <button
                ref={aboutTriggerRef}
                type="button"
                className={`kinoma-sidebar__item kinoma-sidebar__about-trigger kinoma-focus ${aboutActive ? 'is-active' : ''}`}
                aria-label="About"
                aria-expanded={aboutOpen}
                aria-controls="kinoma-about-menu"
                data-tooltip="About"
                onClick={() => {
                  if (!expanded) {
                    setExpanded(true);
                    setAboutOpen(true);
                    return;
                  }
                  setAboutOpen(value => !value);
                }}
              >
                <Info size={19} strokeWidth={1.8} aria-hidden="true" />
                <span>About</span>
                {expanded && (
                  <ChevronRight
                    className="kinoma-sidebar__about-chevron"
                    size={15}
                    strokeWidth={1.7}
                    aria-hidden="true"
                  />
                )}
              </button>

              <div
                id="kinoma-about-menu"
                className={`kinoma-sidebar__submenu ${aboutOpen && expanded ? 'is-open' : ''}`}
                aria-hidden={!aboutOpen || !expanded}
              >
                {ABOUT_ITEMS.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className={`kinoma-sidebar__submenu-item ${location === href ? 'is-active' : ''}`}
                    tabIndex={aboutOpen && expanded ? 0 : -1}
                    aria-current={location === href ? 'page' : undefined}
                  >
                    <span>{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </nav>

        <div className="kinoma-sidebar__profile-area">
          <Link
            href="/profile"
            className="kinoma-sidebar__profile kinoma-focus"
            aria-label="Profile"
            aria-current={location === '/profile' ? 'page' : undefined}
            data-tooltip="Profile"
          >
            <div className="kinoma-sidebar__avatar" aria-hidden="true">
              <UserRound size={18} strokeWidth={1.7} />
            </div>
            <span>My Panda</span>
          </Link>
        </div>

        <button
          type="button"
          className="kinoma-sidebar__mobile-close kinoma-focus"
          onClick={() => {
            setAboutOpen(false);
            setExpanded(false);
          }}
          aria-label="Collapse sidebar"
        >
          <X size={17} />
        </button>
      </aside>

      <div className="panda-app-content">
        <main
          id="panda-main-content"
          ref={mainRef}
          className="kinoma-app-main"
          tabIndex={-1}
          aria-label="Main content"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
