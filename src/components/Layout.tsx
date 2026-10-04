import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { House, Search, Library, Settings, Info, UserRound } from 'lucide-react';
import { KinomaLogo } from './ui/KinomaLogo';

export const ITEMS = [
  { href: '/home', label: 'Home', Icon: House },
  { href: '/search', label: 'Search', Icon: Search },
  { href: '/library', label: 'My List', Icon: Library },
  { href: '/settings', label: 'Settings', Icon: Settings },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [expanded, setExpanded] = useState(false);
  const collapseTimer = useRef<number | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => { mainRef.current?.focus({ preventScroll: true }); }, [location]);
  useEffect(() => () => { if (collapseTimer.current !== null) window.clearTimeout(collapseTimer.current); }, []);

  const expand = () => {
    if (collapseTimer.current !== null) window.clearTimeout(collapseTimer.current);
    setExpanded(true);
  };
  const collapse = () => {
    if (collapseTimer.current !== null) window.clearTimeout(collapseTimer.current);
    collapseTimer.current = window.setTimeout(() => setExpanded(false), 160);
  };

  return (
    <div className="panda-app-shell kinoma-app-shell" style={{ '--sidebar-width': expanded ? '228px' : '64px' } as React.CSSProperties}>
      <a className="panda-skip-link" href="#panda-main-content">Skip to main content</a>
      <div className="panda-mobile-topbar" aria-label="Panda.fun mobile navigation">
        <div className="panda-mobile-topbar__actions">
          <Link href="/search" className={`panda-mobile-topbar__action ${location === '/search' ? 'is-active' : ''}`} aria-label="Search"><Search size={18} strokeWidth={1.8} /></Link>
          <Link href="/profile" className={`panda-mobile-topbar__action ${location === '/profile' ? 'is-active' : ''}`} aria-label="Profile"><UserRound size={18} strokeWidth={1.8} /></Link>
        </div>
      </div>
      <aside className={`kinoma-sidebar kinoma-sidebar--icons ${expanded ? 'is-expanded' : 'is-collapsed'}`} aria-label="Panda.fun navigation" onPointerEnter={expand} onPointerLeave={collapse}>
        <div className="kinoma-sidebar__top">
          <Link href="/home" className="kinoma-sidebar__brand" aria-label="Panda.fun home">
            <KinomaLogo size={expanded ? 'md' : 'sm'} variant={expanded ? 'full' : 'mark'} className="kinoma-sidebar__logo" />
          </Link>
        </div>
        <nav className="kinoma-sidebar__nav" aria-label="Main navigation">
          {ITEMS.map(({ href, label, Icon }) => {
            const active = location === href || (href === '/search' && (location === '/explore' || location === '/whats-new'));
            return <Link key={href} href={href} className={`kinoma-sidebar__item ${active ? 'is-active' : ''}`} aria-label={label} aria-current={active ? 'page' : undefined} data-tooltip={label}><Icon size={20} strokeWidth={1.8} /><span>{label}</span></Link>;
          })}
          <Link href="/profile" className={`kinoma-sidebar__item ${location === '/profile' ? 'is-active' : ''}`} aria-label="Profile" data-tooltip="My Panda"><UserRound size={20} strokeWidth={1.8} /><span>My Panda</span></Link>
          <Link href="/about" className={`kinoma-sidebar__item ${location === '/about' ? 'is-active' : ''}`} aria-label="About" data-tooltip="About"><Info size={20} strokeWidth={1.8} /><span>About</span></Link>
        </nav>
      </aside>
      <div className="panda-app-content"><main id="panda-main-content" ref={mainRef} className="kinoma-app-main" tabIndex={-1} aria-label="Main content">{children}</main></div>
    </div>
  );
}
