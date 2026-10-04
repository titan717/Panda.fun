import React, { useEffect, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { House, Search, Library, Settings, Info, UserRound } from 'lucide-react';

export const ITEMS = [
  { href: '/home', label: 'Home', Icon: House },
  { href: '/search', label: 'Search', Icon: Search },
  { href: '/library', label: 'My List', Icon: Library },
  { href: '/settings', label: 'Settings', Icon: Settings },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, [location]);

  return (
    <div className="panda-app-shell kinoma-app-shell">
      <a className="panda-skip-link" href="#panda-main-content">Skip to main content</a>

      <div className="panda-mobile-topbar" aria-label="Panda.fun mobile navigation">
        <div className="panda-mobile-topbar__actions">
          <Link href="/search" className={`panda-mobile-topbar__action ${location === '/search' ? 'is-active' : ''}`} aria-label="Search">
            <Search size={18} strokeWidth={1.8} aria-hidden="true" />
          </Link>
          <Link href="/profile" className={`panda-mobile-topbar__action ${location === '/profile' ? 'is-active' : ''}`} aria-label="Profile">
            <UserRound size={18} strokeWidth={1.8} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <aside className="kinoma-sidebar kinoma-sidebar--icons" aria-label="Panda.fun navigation">
        <nav className="kinoma-sidebar__nav" aria-label="Main navigation">
          {ITEMS.map(({ href, label, Icon }) => {
            const active = location === href || (href === '/search' && (location === '/explore' || location === '/whats-new'));
            return (
              <Link
                key={href}
                href={href}
                className={`kinoma-sidebar__item ${active ? 'is-active' : ''}`}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                data-tooltip={label}
              >
                <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
              </Link>
            );
          })}
          <Link href="/profile" className={`kinoma-sidebar__item ${location === '/profile' ? 'is-active' : ''}`} aria-label="Profile" aria-current={location === '/profile' ? 'page' : undefined} data-tooltip="Profile">
            <UserRound size={20} strokeWidth={1.8} aria-hidden="true" />
          </Link>
          <Link href="/about" className={`kinoma-sidebar__item ${location === '/about' ? 'is-active' : ''}`} aria-label="About" aria-current={location === '/about' ? 'page' : undefined} data-tooltip="About">
            <Info size={20} strokeWidth={1.8} aria-hidden="true" />
          </Link>
        </nav>
      </aside>

      <div className="panda-app-content">
        <main id="panda-main-content" ref={mainRef} className="kinoma-app-main" tabIndex={-1} aria-label="Main content">
          {children}
        </main>
      </div>
    </div>
  );
}
