import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ChevronDown, CircleUserRound, Search, Shield, FileText, Info, MessageCircle, LogIn, UserPlus } from 'lucide-react';
import { KinomaLogo } from '../KinomaLogo';
import { SearchBar } from '../SearchBar';
import { useAuth } from '../../../lib/AuthContext';

const NAV = [
  { href: '/home', label: 'Home' },
  { href: '/search', label: 'Discover' },
  { href: '/library', label: 'My List' },
  { href: '/whats-new', label: "What's new" },
];

const ABOUT = [
  { href: '/about', label: 'About Panda.fun', Icon: Info },
  { href: '/terms', label: 'Terms of Service', Icon: FileText },
  { href: '/privacy-policy', label: 'Privacy Policy', Icon: Shield },
  { href: '/contact', label: 'Contact support', Icon: MessageCircle },
];

export function ModernNavbar() {
  const [location] = useLocation();
  const [openMenu, setOpenMenu] = useState(false);
  const { user, openAuthModal } = useAuth();

  useEffect(() => setOpenMenu(false), [location]);

  return (
    <header className="panda-header">
      <div className="panda-header__inner">
        <Link href="/home" aria-label="Panda.fun home" className="panda-header__brand panda-focus">
          <KinomaLogo size="lg" variant="full" className="panda-header__logo" />
        </Link>

        <nav className="panda-header__nav" aria-label="Primary navigation">
          {NAV.map((item) => {
            const active = location === item.href ||
              (item.href === '/search' && (location === '/explore' || location.startsWith('/details/')));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`panda-header__link ${active ? 'is-active' : ''}`}
                aria-current={location === item.href ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}

          <div className="panda-header__dropdown">
            <button
              type="button"
              className={`panda-header__link panda-header__about-trigger ${(['/about', '/terms', '/privacy-policy', '/privacy', '/contact'].includes(location) ? 'is-active' : '')}`}
              aria-expanded={openMenu}
              aria-controls="panda-header-about-menu"
              onClick={() => setOpenMenu((current) => !current)}
              onKeyDown={(event) => { if (event.key === 'Escape') setOpenMenu(false); }}
            >
              About <ChevronDown size={14} aria-hidden="true" className={openMenu ? 'is-rotated' : ''} />
            </button>
            <div id="panda-header-about-menu" className={`panda-header__menu ${openMenu ? 'is-open' : ''}`}>
              {ABOUT.map(({ href, label, Icon }) => (
                <Link key={href} href={href} className="panda-header__menu-item" onClick={() => setOpenMenu(false)}>
                  <Icon size={15} aria-hidden="true" /><span>{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </nav>

        <div className="panda-header__search" aria-label="Search Panda.fun">
          <SearchBar />
        </div>

        <div className="panda-header__actions">
          {user ? (
            <Link href="/profile" className="panda-header__account" aria-label="Open your Panda profile">
              {user.photoURL
                ? <img src={user.photoURL} alt="" />
                : <CircleUserRound size={18} aria-hidden="true" />}
              <span>My Panda</span>
            </Link>
          ) : (
            <>
              <button type="button" className="panda-header__login" onClick={() => openAuthModal('signin')}>
                <LogIn size={15} aria-hidden="true" /><span>Log in</span>
              </button>
              <button type="button" className="panda-header__signup" onClick={() => openAuthModal('signup')}>
                <UserPlus size={15} aria-hidden="true" /><span>Sign up</span>
              </button>
            </>
          )}
          <Link href="/search" className="panda-header__mobile-search" aria-label="Search titles">
            <Search size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}
