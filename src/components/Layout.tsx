import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { House, Search, Library, Settings, Info, UserRound, FileText, Shield, Tv, Clapperboard, Trophy, Grid2X2 } from 'lucide-react';
import { KinomaLogo } from './ui/KinomaLogo';
import './mobile/mobile-shell.css';
import '../styles/android-tv.css';
import { getCurrentDeviceMode } from '../lib/deviceCapabilities';
import { m } from 'motion/react';
import { useMotionPreference } from '../motion';

export const ABOUT_ITEMS = [
  { href: '/about', label: 'About' },
  { href: '/docs', label: 'Docs' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/contact', label: 'Contact' },
];

export const ITEMS = [
  { href: '/home', label: 'Home', Icon: House },
  { href: '/search', label: 'Search', Icon: Search },
  { href: '/library', label: 'My List', Icon: Library },
  { href: '/settings', label: 'Settings', Icon: Settings },
];

const TV_ITEMS = [
  { href: '/search', label: 'Search', Icon: Search },
  { href: '/home', label: 'Home', Icon: House },
  { href: '/search?type=series', label: 'TV', Icon: Tv },
  { href: '/search?type=movie', label: 'Movies', Icon: Clapperboard },
  { href: '/search?keyword=sports', label: 'Sports', Icon: Trophy },
  { href: '/search', label: 'Categories', Icon: Grid2X2 },
  { href: '/profile', label: 'My Space', Icon: UserRound },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const motionPreference = useMotionPreference();
  const [expanded, setExpanded] = useState(false);
  const [deviceMode, setDeviceMode] = useState(() => getCurrentDeviceMode());
  const tvMode = deviceMode === 'tv';
  const collapseTimer = useRef<number | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const isPlayerRoute = location.startsWith('/watch/');
  const navItems = tvMode ? TV_ITEMS : ITEMS;

  useEffect(() => {
    const syncDeviceMode = () => {
      const nextMode = getCurrentDeviceMode();
      setDeviceMode(nextMode);
      (window as Window & { isKinomaAndroidTV?: boolean }).isKinomaAndroidTV = nextMode === 'tv';
      document.documentElement.classList.toggle('tv-mode', nextMode === 'tv');
      document.documentElement.dataset.deviceMode = nextMode;
    };
    syncDeviceMode();
    window.addEventListener('resize', syncDeviceMode);
    return () => window.removeEventListener('resize', syncDeviceMode);
  }, []);

  useEffect(() => {
    // TV screens manage their own initial focus so the remote lands on the
    // primary action/search field instead of an invisible main landmark.
    if (!tvMode) mainRef.current?.focus({ preventScroll: true });
  }, [location, tvMode]);
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
    <div className={`panda-app-shell kinoma-app-shell${isPlayerRoute ? ' panda-app-shell--player' : ''}${tvMode ? ' panda-tv-app-shell' : ''}`} style={{ '--sidebar-width': expanded ? '260px' : '64px' } as React.CSSProperties}>
      <a className="panda-skip-link" href="#panda-main-content">Skip to main content</a>
      {!isPlayerRoute && (
        <header className="panda-mobile-header">
          <Link href="/home" className="panda-mobile-header__brand" aria-label="MYpanda.fun home"><KinomaLogo size="md" variant="full" /></Link>
          <nav className="panda-mobile-header__actions" aria-label="Quick actions"><Link href="/settings" className={`panda-mobile-header__action${location.split("?")[0] === "/settings" ? " is-active" : ""}`} aria-label="Settings" aria-current={location.split("?")[0] === "/settings" ? "page" : undefined} title="Settings"><Settings size={20} strokeWidth={1.8} /></Link></nav>
        </header>
      )}
      {!isPlayerRoute && (
        <nav className="panda-mobile-bottom-nav" aria-label="MYpanda.fun mobile navigation">
          {ITEMS.filter(({ href }) => href !== '/settings').map(({ href, label, Icon }) => {
            const mobileLabel = href === '/library' ? 'Library' : label;
            const pathname = location.split('?')[0];
            const active = (href === '/home' && (pathname === '/home' || pathname === '/browse')) ||
              (href === '/search' && (pathname === '/search' || pathname === '/explore' || pathname === '/whats-new')) ||
              (href === '/library' && (pathname === '/library' || pathname === '/history'));
            return <Link key={href} href={href} className={`panda-mobile-bottom-nav__item ${active ? 'is-active' : ''}`} aria-label={mobileLabel} aria-current={active ? 'page' : undefined}>
              {active && motionPreference === 'full' && <m.span layoutId="panda-bottom-nav-active" className="panda-mobile-bottom-nav__active-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} aria-hidden="true" />}
              <m.span className="panda-mobile-bottom-nav__icon" animate={active && motionPreference === 'full' ? { scale: [1, 1.12, 1], y: [0, -2, 0] } : { scale: 1, y: 0 }} transition={{ duration: 0.28 }}><Icon size={21} strokeWidth={1.9} fill={active && (href === '/home' || href === '/library') ? 'currentColor' : 'none'} /></m.span>
              <span className="panda-mobile-bottom-nav__label">{mobileLabel}</span>
            </Link>;
          })}
        </nav>
      )}
      {!isPlayerRoute && (
        <aside className={`kinoma-sidebar kinoma-sidebar--icons ${expanded ? 'is-expanded' : 'is-collapsed'}`} aria-label="Panda.fun navigation" onPointerEnter={expand} onPointerLeave={collapse} onFocusCapture={expand} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) collapse(); }}>
          <div className="kinoma-sidebar__top"><Link href="/home" className="kinoma-sidebar__brand" aria-label="Panda.fun home"><KinomaLogo size={expanded ? 'md' : 'sm'} variant={expanded ? 'full' : 'mark'} className="kinoma-sidebar__logo" /></Link></div>
          <nav className="kinoma-sidebar__nav" aria-label="Main navigation">
            {navItems.map(({ href, label, Icon }) => {
              const pathname = location.split('?')[0];
              const query = new URLSearchParams(location.split('?')[1] || '');
              const active = (href === '/home' && (pathname === '/home' || pathname === '/browse')) ||
                (href === '/profile' && pathname === '/profile') ||
                (href === '/library' && (pathname === '/library' || pathname === '/history')) ||
                (href === '/settings' && pathname === '/settings') ||
                (href === '/search' && pathname === '/search' && !query.get('keyword')) ||
                (href === '/search?type=series' && pathname === '/search' && query.get('type') === 'series') ||
                (href === '/search?type=movie' && pathname === '/search' && query.get('type') === 'movie') ||
                (href === '/search?keyword=sports' && pathname === '/search' && query.get('keyword') === 'sports');
              return <Link key={label} href={href} className={`kinoma-sidebar__item ${active ? 'is-active' : ''}`} aria-label={label} aria-current={active ? 'page' : undefined} data-tooltip={label}><Icon size={tvMode ? 23 : 20} strokeWidth={1.8} /><span>{label}</span></Link>;
            })}
            {!tvMode && (
              <>
                <Link href="/profile" className={`kinoma-sidebar__item ${location === '/profile' ? 'is-active' : ''}`} aria-label="Profile" data-tooltip="My Panda"><UserRound size={20} strokeWidth={1.8} /><span>My Panda</span></Link>
                <div className="kinoma-sidebar__about-group">
                  <Link href="/about" className={`kinoma-sidebar__item ${location === '/about' || location === '/terms' || location === '/privacy-policy' ? 'is-active' : ''}`} aria-label="About" data-tooltip="About"><Info size={20} strokeWidth={1.8} /><span>About</span></Link>
                  <div className="kinoma-sidebar__about-submenu" aria-label="About links"><Link href="/terms" className={`kinoma-sidebar__about-subitem ${location === '/terms' ? 'is-active' : ''}`}><FileText size={15} strokeWidth={1.8} /><span>Terms of Service</span></Link><Link href="/privacy-policy" className={`kinoma-sidebar__about-subitem ${location === '/privacy-policy' ? 'is-active' : ''}`}><Shield size={15} strokeWidth={1.8} /><span>Privacy Policy</span></Link></div>
                </div>
              </>
            )}
          </nav>
        </aside>
      )}
      <div className="panda-app-content"><main id="panda-main-content" ref={mainRef} className="kinoma-app-main" tabIndex={-1} aria-label="Main content">{children}</main></div>
    </div>
  );
}
