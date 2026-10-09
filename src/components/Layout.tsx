import React, { useEffect, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { House, Search, Library, Settings } from 'lucide-react';
import { ModernNavbar } from './ui/modern/ModernNavbar';

export const ITEMS = [
  { href: '/home', label: 'Home', Icon: House },
  { href: '/search', label: 'Search', Icon: Search },
  { href: '/library', label: 'My List', Icon: Library },
  { href: '/settings', label: 'Settings', Icon: Settings },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const mainRef = useRef<HTMLElement | null>(null);
  const isPlayerRoute = location.startsWith('/watch');

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, [location]);

  return (
    <div className={`panda-app-shell ${isPlayerRoute ? 'panda-app-shell--player' : ''}`}>
      {!isPlayerRoute && (
        <>
          <a className="panda-skip-link" href="#panda-main-content">Skip to main content</a>
          <ModernNavbar />
          <nav className="panda-mobile-bottom-nav" aria-label="Panda.fun mobile navigation">
            {ITEMS.map(({ href, label, Icon }) => {
              const active = location === href ||
                (href === '/search' && (location === '/explore' || location === '/whats-new' || location.startsWith('/details/')));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`panda-mobile-bottom-nav__item ${active ? 'is-active' : ''}`}
                  aria-label={label}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="panda-mobile-bottom-nav__icon"><Icon size={21} strokeWidth={1.9} /></span>
                  <span className="panda-mobile-bottom-nav__label">{label}</span>
                </Link>
              );
            })}
          </nav>
        </>
      )}
      <div className="panda-app-content">
        <div
          id="panda-main-content"
          ref={mainRef}
          className={`kinoma-app-main ${isPlayerRoute ? 'kinoma-app-main--player' : ''}`}
          tabIndex={-1}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export const ABOUT_ITEMS = [
  { href: '/about', label: 'About' },
  { href: '/docs', label: 'Docs' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy-policy', label: 'Privacy' },
  { href: '/contact', label: 'Contact' },
];
