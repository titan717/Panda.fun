import { useEffect, useRef, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Icon, PandaMark, type IconName } from "../components/Icon";
import { Avatar } from "../components/ui";
import { useProfile } from "../lib/store";
import { focusEl } from "../lib/focus";
import { useUpdateAvailable } from "../lib/updates";

const ITEMS: { id: string; href: string; label: string; icon: IconName | "avatar"; match: (p: string) => boolean }[] = [
  { id: "rail-search", href: "/search", label: "Search", icon: "search", match: (p) => p.startsWith("/search") },
  { id: "rail-home", href: "/", label: "Home", icon: "home", match: (p) => p === "/" },
  { id: "rail-tv", href: "/tv", label: "TV", icon: "tv", match: (p) => p === "/tv" || p.startsWith("/browse/tv") },
  { id: "rail-movies", href: "/movies", label: "Movies", icon: "movie", match: (p) => p === "/movies" || p.startsWith("/browse/movie") },
  { id: "rail-new", href: "/new", label: "New & Hot", icon: "flame", match: (p) => p.startsWith("/new") || p.startsWith("/browse/trending") },
  { id: "rail-categories", href: "/categories", label: "Categories", icon: "grid", match: (p) => p.startsWith("/categories") },
  { id: "rail-myspace", href: "/my-space", label: "My Space", icon: "avatar", match: (p) => p.startsWith("/my-space") || p.startsWith("/my-list") || p.startsWith("/continue-watching") || p.startsWith("/settings") || p.startsWith("/profiles") }
];

let lastContent: HTMLElement | null = null;

/** TV navigation rail (BLUEPRINT_SPEC 4). */
export function TvShell({ children }: { children: ReactNode }) {
  const [path] = useLocation();
  const profile = useProfile();
  const nav = useRef<HTMLElement>(null);
  const current = ITEMS.find((i) => i.match(path))?.id ?? "rail-home";

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement;
      if (!nav.current?.contains(t)) lastContent = t;
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);

  useEffect(() => { nav.current?.setAttribute("data-focus", current); }, [current]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" && lastContent && document.contains(lastContent)) {
      e.preventDefault();
      focusEl(lastContent);
    }
  };

  const updateReady = useUpdateAvailable();
  return (
    <div className="tv-shell">
      <nav ref={nav} className="rail" aria-label="Main" data-focus={current} data-block-exit="up down left" onKeyDown={onKeyDown}
        onBlur={(e) => { if (!nav.current?.contains(e.relatedTarget as Node)) nav.current?.setAttribute("data-focus", current); }}>
        <div className="rail-top">
          <PandaMark size="100%" className="rail-mark" />
          <Link href="/settings/updates" id="rail-update" className={`rail-update ${updateReady ? "has-update" : ""}`} data-hover-focus aria-label={updateReady ? "Update available. Check for Updates" : "Check for Updates"}>UPDATE</Link>
        </div>
        <ul className="rail-list">
          {ITEMS.map((i) => (
            <li key={i.id} className={i.icon === "avatar" ? "rail-bottom" : undefined}>
              <Link href={i.href} id={i.id} className={`rail-item ${i.id === current ? "is-current" : ""}`} aria-current={i.id === current ? "page" : undefined} data-hover-focus>
                {i.icon === "avatar" ? <Avatar kind={profile?.avatar ?? "smile"} className="rail-avatar" /> : <Icon name={i.icon} className="rail-icon" />}
                <span className="rail-label">{i.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="rail-scrim" aria-hidden="true" />
      <main className="tv-main" id="main">{children}</main>
    </div>
  );
}
