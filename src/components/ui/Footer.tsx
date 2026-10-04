import React from 'react';
import { Link } from 'wouter';
import { Github, Instagram, Youtube } from 'lucide-react';

const links = [
  { href: '/about', label: 'About' },
  { href: '/docs', label: 'API Docs' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/contact', label: 'Contact' },
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

        <nav className="panda-shared-footer__links" aria-label="Footer navigation">
          {links.map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}
        </nav>

        <div className="panda-shared-footer__social" aria-label="Social links">
          <a href="https://github.com/titan717/Panda.fun" target="_blank" rel="noreferrer" aria-label="Source on GitHub">
            <Github size={14} aria-hidden="true" /><span>Source</span>
          </a>
          <a href="#" aria-label="Panda.fun on YouTube">
            <Youtube size={14} aria-hidden="true" /><span>YouTube</span>
          </a>
          <a href="#" aria-label="Panda.fun on Instagram">
            <Instagram size={14} aria-hidden="true" /><span>Instagram</span>
          </a>
        </div>
      </div>
      <div className="panda-shared-footer__bottom">
        <span>© {new Date().getFullYear()} Panda.fun</span>
        <span>Built for the next thing you want to watch.</span>
      </div>
    </footer>
  );
}
