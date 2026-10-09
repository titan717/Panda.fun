import React from 'react';
import { Link } from 'wouter';
import {
  Github, Instagram, Youtube, ArrowUp, Home as HomeIcon, Search, Bookmark,
  Info, FileText, Shield, BookOpen, MessageCircle, Sparkles
} from 'lucide-react';

const linkGroups = [
  {
    label: 'Discover',
    description: 'Find your next favourite',
    links: [
      { href: '/home', label: 'Home', icon: HomeIcon },
      { href: '/search', label: 'Search titles', icon: Search },
      { href: '/library', label: 'My List', icon: Bookmark },
      { href: '/history', label: 'Watch history', icon: Sparkles },
    ],
  },
  {
    label: 'Panda.fun',
    description: 'A little more about us',
    links: [
      { href: '/about', label: 'About', icon: Info },
      { href: '/docs', label: 'API documentation', icon: BookOpen },
      { href: '/contact', label: 'Contact support', icon: MessageCircle },
    ],
  },
  {
    label: 'Your trust',
    description: 'Clear, transparent policies',
    links: [
      { href: '/terms', label: 'Terms of Service', icon: FileText },
      { href: '/privacy-policy', label: 'Privacy Policy', icon: Shield },
      { href: '/settings', label: 'Preferences', icon: Sparkles },
    ],
  },
];

export function Footer() {
  return (
    <footer className="panda-shared-footer">
      <div className="panda-shared-footer__inner">
        <div className="panda-shared-footer__brand">
          <span className="panda-shared-footer__mark" aria-hidden="true">🐼</span>
          <div>
            <strong>PANDA.FUN</strong>
            <span>Find something good. Stay a little longer.</span>
          </div>
          <p className="panda-shared-footer__mission">A calmer way to discover the stories you’ll love.</p>
        </div>

        <div className="panda-shared-footer__groups">
          {linkGroups.map((group) => (
            <nav key={group.label} className="panda-shared-footer__group" aria-label={group.label}>
              <strong>{group.label}</strong>
              <span className="panda-shared-footer__group-note">{group.description}</span>
              {group.links.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href}><Icon size={15} aria-hidden="true" /><span>{label}</span></Link>
              ))}
            </nav>
          ))}
        </div>

        <div className="panda-shared-footer__social-block">
          <span className="panda-shared-footer__social-title">Follow the journey</span>
          <div className="panda-shared-footer__social" aria-label="Social links">
            <a href="https://github.com/titan717/Panda.fun" target="_blank" rel="noreferrer" aria-label="Source on GitHub">
              <Github size={17} aria-hidden="true" /><span>Source</span>
            </a>
            <span className="panda-shared-footer__social-link is-disabled" aria-label="YouTube coming soon" title="YouTube channel coming soon">
              <Youtube size={17} aria-hidden="true" /><span>YouTube</span>
            </span>
            <span className="panda-shared-footer__social-link is-disabled" aria-label="Instagram coming soon" title="Instagram page coming soon">
              <Instagram size={17} aria-hidden="true" /><span>Instagram</span>
            </span>
          </div>
          <p className="panda-shared-footer__support-note">Need a hand? <Link href="/contact">Contact support <span aria-hidden="true">↗</span></Link></p>
        </div>
      </div>

      <div className="panda-shared-footer__bottom">
        <span>© {new Date().getFullYear()} Panda.fun</span>
        <span>Made for your next great watch.</span>
        <button type="button" className="panda-shared-footer__top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Back to top">
          Back to top <ArrowUp size={14} aria-hidden="true" />
        </button>
      </div>
    </footer>
  );
}
