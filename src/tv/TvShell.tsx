import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Icon, PandaMark, type IconName } from "../components/Icon";
import { Avatar } from "../components/ui";
import { useProfile } from "../lib/store";
import { focusEl, focusFirst } from "../lib/focus";
import { useUpdateAvailable } from "../lib/updates";

/**
 * TV sidebar (BLUEPRINT_SPEC §4, measured from tv1#15, tv1#22, tv2#11, tv2#12, blueprinttvpanda#21).
 * Collapsed: logo, UPDATE pill under it, the top-level icons (Search, Home, Categories) centred on the
 * left edge and the avatar at the bottom, no panel. Expanded (any rail item focused): a dark panel
 * slides over the content (content never moves), the pill moves beside the logo, Home's sub-items
 * (TV, Movies, New & Hot) unfold under it, labels fade in. Only transform and opacity animate.
 */
interface Item { id: string; href: string; label: string; icon: IconName | "avatar"; sub?: boolean; match: (p: string) => boolean }
const ITEMS: Item[] = [
  { id: "rail-search", href: "/search", label: "Search", icon: "search", match: (p) => p.startsWith("/search") },
  { id: "rail-home", href: "/", label: "Home", icon: "home", match: (p) => p === "/" },
  { id: "rail-tv", href: "/tv", label: "TV", icon: "tv", sub: true, match: (p) => p === "/tv" || p.startsWith("/browse/tv") },
  { id: "rail-movies", href: "/movies", label: "Movies", icon: "movie", sub: true, match: (p) => p === "/movies" || p.startsWith("/browse/movie") },
  { id: "rail-new", href: "/new", label: "New & Hot", icon: "flame", sub: true, match: (p) => p.startsWith("/new") || p.startsWith("/browse/trending") || p.startsWith("/calendar") },
  { id: "rail-categories", href: "/categories", label: "Categories", icon: "grid", match: (p) => p.startsWith("/categories") || p.startsWith("/browse/") },
  { id: "rail-myspace", href: "/my-space", label: "My Space", icon: "avatar", match: (p) => p.startsWith("/my-space") || p.startsWith("/my-list") || p.startsWith("/list") || p.startsWith("/continue-watching") || p.startsWith("/settings") || p.startsWith("/profiles") }
];
const LIST = ITEMS.filter((i) => i.icon !== "avatar");
const TOP = LIST.filter((i) => !i.sub);
const ORDER = ["rail-update", ...ITEMS.map((i) => i.id)];

/** Row offsets (in rows from the list centre) for the collapsed and expanded states. */
function offsets(item: Item) {
  const e = LIST.indexOf(item) - (LIST.length - 1) / 2;
  const home = TOP.findIndex((i) => i.id === "rail-home");
  const c = (item.sub ? home : TOP.indexOf(item)) - (TOP.length - 1) / 2;
  return { c, e };
}

let lastContent: HTMLElement | null = null;

export function TvShell({ children }: { children: ReactNode }) {
  const [path] = useLocation();
  const profile = useProfile();
  const nav = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const currentItem = ITEMS.find((i) => i.match(path)) ?? ITEMS[1]!;
  const current = currentItem.id;
  // collapsed, a sub-page lights its parent (Home), as in the blueprint
  const lit = currentItem.sub ? "rail-home" : current;

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement;
      const inRail = Boolean(nav.current?.contains(t));
      if (!inRail) { lastContent = t; setOpen(false); return; }
      setOpen(true);
      // entering from the content (Left from the leftmost item): land on the current section
      const from = e.relatedTarget as Node | null;
      if (!from || !nav.current!.contains(from)) {
        const want = document.getElementById(current);
        if (want && t !== want && t.id !== "rail-update") focusEl(want);
      }
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [current]);

  useEffect(() => { nav.current?.setAttribute("data-focus", current); }, [current]);

  const leave = () => {
    if (lastContent && document.contains(lastContent)) focusEl(lastContent);
    else { const main = document.getElementById("main"); if (main) focusFirst(main); }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const id = (document.activeElement as HTMLElement | null)?.id ?? "";
    const i = ORDER.indexOf(id);
    if (e.key === "ArrowRight") { e.preventDefault(); leave(); return; }
    if (e.key === "Escape" || e.key === "Backspace" || e.key === "GoBack" || e.key === "BrowserBack") { e.preventDefault(); leave(); return; }
    if (e.key === "ArrowLeft") { e.preventDefault(); return; }
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && i >= 0) {
      e.preventDefault();
      const next = ORDER[Math.max(0, Math.min(ORDER.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))]!;
      focusEl(document.getElementById(next));
    }
  };

  const updateReady = useUpdateAvailable();
  const row = (item: Item) => {
    const { c, e } = offsets(item);
    const isCurrent = item.id === current;
    return (
      <Link key={item.id} href={item.href} id={item.id} style={{ "--c": c, "--e": e } as CSSProperties}
        className={`rail-item ${item.sub ? "is-sub" : ""} ${isCurrent ? "is-current" : ""} ${item.id === lit ? "is-lit" : ""}`}
        aria-current={isCurrent ? "page" : undefined} tabIndex={item.sub && !open ? -1 : 0} aria-hidden={item.sub && !open ? true : undefined} data-hover-focus>
        {item.icon === "avatar"
          ? <Avatar kind={profile?.avatar ?? "smile"} className="rail-avatar" />
          : <Icon name={item.icon} className="rail-icon" filled={item.id === lit && (item.icon === "home" || item.icon === "grid" || item.icon === "flame")} />}
        <span className="rail-label">{item.label}</span>
      </Link>
    );
  };
  return (
    <div className={`tv-shell ${open ? "is-rail-open" : ""}`}>
      <nav ref={nav} className={`rail ${open ? "is-open" : ""}`} aria-label="Main" data-focus={current} data-block-exit="up down left" onKeyDown={onKeyDown}
        onMouseLeave={() => { if (!nav.current?.contains(document.activeElement)) setOpen(false); }}>
        <div className="rail-panel" aria-hidden="true" />
        <div className="rail-top">
          <PandaMark size="100%" className="rail-mark" />
          <Link href="/settings/updates" id="rail-update" className={`rail-update ${updateReady ? "has-update" : ""}`} data-hover-focus aria-label={updateReady ? "Update available. Check for Updates" : "Check for Updates"}>UPDATE</Link>
        </div>
        <div className="rail-list">{LIST.map(row)}</div>
        <div className="rail-bottom">{row(ITEMS[ITEMS.length - 1]!)}</div>
      </nav>
      <main className="tv-main" id="main">{children}</main>
    </div>
  );
}
