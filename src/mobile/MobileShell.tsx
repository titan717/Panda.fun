import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Icon, PandaMark } from "../components/Icon";
import { Avatar } from "../components/ui";
import { Sheet } from "../components/Sheet";
import { useProfile } from "../lib/store";
import { useCategories } from "../lib/hooks";
import { browseHref } from "../lib/format";
import { useNav } from "../lib/nav";

const HOME_PATHS = new Set(["/", "/tv", "/movies"]);

/** Bottom navigation (spec 11.5). */
function BottomNav({ path }: { path: string }) {
  const profile = useProfile();
  const isHome = HOME_PATHS.has(path) || path.startsWith("/new") || path.startsWith("/categories");
  const isSearch = path.startsWith("/search");
  const isMine = path.startsWith("/my-") || path.startsWith("/settings") || path.startsWith("/profiles") || path.startsWith("/continue-watching");
  return (
    <nav className="m-nav" aria-label="Main">
      <Link href="/" className={`m-nav-item ${isHome ? "is-active" : ""}`} aria-current={isHome ? "page" : undefined}>
        <PandaMark size={26} /><span>Home</span>
      </Link>
      <Link href="/search" className={`m-nav-item ${isSearch ? "is-active" : ""}`} aria-current={isSearch ? "page" : undefined}>
        <Icon name="search" size={24} /><span>Search</span>
      </Link>
      <Link href="/my-space" className={`m-nav-item ${isMine ? "is-active" : ""}`} aria-current={isMine ? "page" : undefined}>
        <Avatar kind={profile?.avatar ?? "smile"} className="m-nav-avatar" /><span>My Space</span>
      </Link>
    </nav>
  );
}

function CategorySheet({ onClose }: { onClose: () => void }) {
  const { data } = useCategories();
  const { go } = useNav();
  const pick = (href: string) => { onClose(); go(href); };
  return (
    <Sheet title="Categories" onClose={onClose} className="sheet--cats">
      <p className="sheet-group">Browse</p>
      <div className="m-chips m-chips--wrap">
        <button className="m-chip" onClick={() => pick("/tv")}>TV</button>
        <button className="m-chip" onClick={() => pick("/movies")}>Movies</button>
        <button className="m-chip" onClick={() => pick("/new")}>New & Hot</button>
        <button className="m-chip" onClick={() => pick("/categories")}>All Categories</button>
      </div>
      <p className="sheet-group">Genres</p>
      <div className="m-chips m-chips--wrap">
        {(data?.genres ?? []).map((g) => <button key={g.id} className="m-chip" onClick={() => pick(browseHref("movie", { genre: String(g.id), title: g.name }))}>{g.name}</button>)}
      </div>
      <p className="sheet-group">Languages</p>
      <div className="m-chips m-chips--wrap">
        {(data?.languages ?? []).map((l) => <button key={l.code} className="m-chip" onClick={() => pick(browseHref("movie", { lang: l.code, title: `${l.name} Movies` }))}>{l.name}</button>)}
      </div>
    </Sheet>
  );
}

/** Floating pill above the nav (spec 11.6). */
function FloatingPill({ path }: { path: string }) {
  const [open, setOpen] = useState(false);
  const { go } = useNav();
  const chosen = path === "/tv" ? "TV" : path === "/movies" ? "Movies" : null;
  return (
    <div className="m-float">
      {chosen ? (
        <button className="m-float-pill m-float-chip" onClick={() => go("/", { replace: true })} aria-label={`Clear ${chosen} filter`}>
          {chosen} <Icon name="close" />
        </button>
      ) : (
        <div className="m-float-pill" role="group" aria-label="Browse">
          <Link href="/tv">TV</Link>
          <Link href="/movies">Movies</Link>
          <button onClick={() => setOpen(true)} aria-haspopup="dialog">Categories <Icon name="chevronUp" /></button>
        </div>
      )}
      <Link href="/search?voice=1" className="m-float-search" aria-label="Voice and text search"><Icon name="mic" /></Link>
      {open && <CategorySheet onClose={() => setOpen(false)} />}
    </div>
  );
}

export function MobileShell({ children }: { children: ReactNode }) {
  const [path] = useLocation();
  const showFloat = HOME_PATHS.has(path);
  return (
    <div className="m-shell">
      <main className="m-main" id="main">{children}</main>
      {showFloat && <FloatingPill path={path} />}
      <BottomNav path={path} />
    </div>
  );
}
