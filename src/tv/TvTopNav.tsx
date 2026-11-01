import React from 'react';
import { Link, useLocation } from 'wouter';
import { House, Clapperboard, Tv, Sparkles, Search, Library } from 'lucide-react';
import { useDpadFocus } from './useDpadFocus';

const ITEMS = [
  { href: '/home', label: 'Home', Icon: House },
  { href: '/search?type=movie', label: 'Movies', Icon: Clapperboard },
  { href: '/search?type=series', label: 'TV Shows', Icon: Tv },
  { href: '/search?type=anime', label: 'Anime', Icon: Sparkles },
  { href: '/search', label: 'Search', Icon: Search },
  { href: '/library', label: 'My List', Icon: Library },
];

export function TvTopNav() {
  const [location] = useLocation();
  const params = new URLSearchParams(location.split('?')[1] || '');
  return (
    <nav className="tv-topnav" aria-label="TV navigation">
      {ITEMS.map(({ href, label, Icon }) => (
        <TvNavItem key={label} href={href} label={label} Icon={Icon} active={isItemActive(href, location, params)} />
      ))}
    </nav>
  );
}

function isItemActive(href: string, location: string, params: URLSearchParams) {
  const [path, query] = href.split('?');
  const currentPath = location.split('?')[0];
  if (path !== currentPath) return false;
  if (!query) return true;
  const wanted = new URLSearchParams(query);
  return [...wanted.entries()].every(([k, v]) => params.get(k) === v);
}

function TvNavItem({ href, label, Icon, active }: { href: string; label: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; active: boolean }) {
  const ref = useDpadFocus(`nav-${label}`);
  return (
    <Link href={href} ref={ref as any} className={`tv-topnav__item${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>
      <Icon size={22} strokeWidth={1.8} />
      <span>{label}</span>
    </Link>
  );
}
