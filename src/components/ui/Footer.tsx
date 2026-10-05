import React from 'react';
import { Link } from 'wouter';
import { Github, Instagram, Youtube, ArrowUp, Home as HomeIcon, Search, Bookmark, Info, FileText, Shield, BookOpen } from 'lucide-react';

const linkGroups = [
  {
    label: 'Explore',
    links: [
      { href: '/browse', label: 'Home', icon: HomeIcon },
      { href: '/search', label: 'Search', icon: Search },
      { href: '/library', label: 'My List', icon: Bookmark },
    ],
  },
  {
    label: 'Panda',
    links: [
      { href: '/about', label: 'About', icon: Info },
      { href: '/docs', label: 'API Docs', icon: BookOpen },
      { href: '/contact', label: 'Contact', icon: FileText },
    ],
  },
  {
    label: 'Legal',
    links: [
      { href: '/terms', label: 'Terms of Service', icon: FileText },
      { href: '/privacy', label: 'Privacy Policy', icon: Shield },
    ],
  },
];

export function Footer() {
  return (
    <footer className="panda-shared-footer">
      <div className="panda-shared-footer__inner">
        <div className="panda-shared-footer__brand">
          <span className="panda-shared-footer__mark" aria-hidden="true">P</span>
          <div>
            <strong>Panda.fun</strong>
            <span>Find something good. Stay a little longer.</span>
          </div>
        </div>

        <div className="panda-shared-footer__groups">
          {linkGroups.map(group => (
            <nav key={group.label} className="panda-shared-footer__group" aria-label={group.label}>
              <span>{group.label}</span>
              {group.links.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href}><Icon size={13} aria-hidden="true" />{label}</Link>
              ))}
            </nav>
          ))}
        </div>

        <div className="panda-shared-footer__social" aria-label="Social links">
          <a href="https://github.com/titan717/Panda.fun" target="_blank" rel="noreferrer" aria-label="Source on GitHub">
            <Github size={14} aria-hidden="true" /><span>Source</span>
          </a>
          <span className="panda-shared-footer__social-link is-disabled" aria-label="YouTube coming soon">
            <Youtube size={14} aria-hidden="true" /><span>YouTube</span>
          </span>
          <span className="panda-shared-footer__social-link is-disabled" aria-label="Instagram coming soon">
            <Instagram size={14} aria-hidden="true" /><span>Instagram</span>
          </span>
        </div>
      </div>
      <div className="panda-shared-footer__bottom"><button type="button" className="panda-shared-footer__top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Back to top"><ArrowUp size={13} /> Top</button>
        <span>© {new Date().getFullYear()} Panda.fun</span>
        <span>Made for your next great watch.</span>
      </div>
    </footer>
  );
}
