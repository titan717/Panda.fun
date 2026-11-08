import type { CSSProperties } from "react";

/** Inline stroke icon set (own artwork, see docs/ASSETS.md). 24×24 grid, currentColor. */
const PATHS = {
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.2-4.2",
  home: "M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-8.5Z",
  tv: "M4 7h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Zm4-4 4 4 4-4",
  movie: "M4 5h16v14H4zM4 9h16M8 5l2 4M13 5l2 4M18 5l2 4",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  flame: "M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.6 1.2 2.5 2 2.5-.5-3 0-5.5 1-8Z",
  plus: "M12 5v14M5 12h14",
  check: "m5 12.5 4.5 4.5L19 7.5",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z",
  thumbUp: "M7 11v9H4v-9h3Zm0 0 4-7c1.5 0 2.5 1 2.2 2.6L12.6 10H19a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.8 20H7",
  thumbDown: "M17 13V4h3v9h-3Zm0 0-4 7c-1.5 0-2.5-1-2.2-2.6l.6-3.4H5a2 2 0 0 1-2-2.3l1.2-6A2 2 0 0 1 6.2 4H17",
  play: "M8 5.5v13a.5.5 0 0 0 .77.42l10-6.5a.5.5 0 0 0 0-.84l-10-6.5A.5.5 0 0 0 8 5.5Z",
  close: "M6 6l12 12M18 6 6 18",
  arrowUpLeft: "M17 17 7 7m0 8V7h8",
  chevronDown: "m6 9 6 6 6-6",
  chevronUp: "m6 15 6-6 6 6",
  chevronLeft: "m15 6-6 6 6 6",
  chevronRight: "m9 6 6 6-6 6",
  back: "M20 12H5m6-6-6 6 6 6",
  mic: "M12 4a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V7a3 3 0 0 0-3-3Zm-6 8a6 6 0 0 0 12 0M12 18v3",
  share: "M12 4v11M8 8l4-4 4 4M5 13v6h14v-6",
  star: "m12 4 2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6L12 4Z",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm7.4 3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2.2-1.3L14.3 3h-4l-.4 2.4a7.5 7.5 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2.2 1.3l.4 2.4h4l.4-2.4a7.5 7.5 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3Z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  clock: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4v4l3 2",
  trend: "m4 16 5-5 4 4 7-7M15 8h5v5",
  volume: "M5 10v4h3l4 4V6L8 10H5Zm11-1a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12",
  volumeOff: "M5 10v4h3l4 4V6L8 10H5Zm11 0 5 5m0-5-5 5",
  volumeDown: "M5 10v4h3l4 4V6L8 10H5Zm11-1a4 4 0 0 1 0 6",
  next: "M6 6v12l9-6-9-6Zm11 0v12",
  prev: "M18 6v12L9 12l9-6ZM7 6v12",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  edit: "M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2Zm4 4h4",
  info: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 7v5m0-8h.01",
  shield: "M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z",
  globe: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-8 8h16M12 4c2.2 2.3 3.2 5 3.2 8s-1 5.7-3.2 8c-2.2-2.3-3.2-5-3.2-8s1-5.7 3.2-8Z",
  download: "M12 4v11m-4-4 4 4 4-4M5 19h14",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6",
  more: "M12 6h.01M12 12h.01M12 18h.01",
  sort: "M7 5v14m0 0-3-3m3 3 3-3M17 19V5m0 0-3 3m3-3 3 3",
  trash: "M5 7h14M10 7V5h4v2m-7 0 1 12h8l1-12",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z",
  signal: "M5 19v-3M10 19v-7M15 19V9M20 19V5",
  file: "M7 3h7l5 5v13H7zM14 3v5h5",
  episodes: "M4 6h11v12H4zM18 8v8M21 9v6",
  sparkle: "M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4Zm6 10 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z"
} as const;

export type IconName = keyof typeof PATHS;

const FILLED = new Set<IconName>(["play", "heart", "star"]);

export function Icon({ name, size, className, filled, style, strokeWidth = 2 }: { name: IconName; size?: number | string; className?: string; filled?: boolean; style?: CSSProperties; strokeWidth?: number }) {
  const fill = filled ?? FILLED.has(name);
  return (
    <svg className={`icon ${className ?? ""}`} viewBox="0 0 24 24" width={size ?? "1em"} height={size ?? "1em"} aria-hidden="true" focusable="false" style={style}
      fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth={fill ? 0 : strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name]} />
    </svg>
  );
}

/** The Panda mark: a white panda face, own artwork replacing the blueprint's star mark (DECISIONS D-001). */
export function PandaMark({ size = 32, className }: { size?: number | string; className?: string }) {
  return (
    <svg className={`panda-mark ${className ?? ""}`} viewBox="0 0 64 64" width={size} height={size} role="img" aria-label="Panda">
      <circle cx="16" cy="15" r="10" fill="#171820" stroke="#f7f5ff" strokeWidth="2.5" />
      <circle cx="48" cy="15" r="10" fill="#171820" stroke="#f7f5ff" strokeWidth="2.5" />
      <rect x="11" y="12" width="42" height="42" rx="20" fill="#f7f5ff" />
      <ellipse cx="22" cy="30" rx="8" ry="11" transform="rotate(28 22 30)" fill="#171820" />
      <ellipse cx="42" cy="30" rx="8" ry="11" transform="rotate(-28 42 30)" fill="#171820" />
      <circle cx="24" cy="29" r="2.4" fill="#f7f5ff" />
      <circle cx="40" cy="29" r="2.4" fill="#f7f5ff" />
      <path d="M29 39c1.8-2.2 4.2-2.2 6 0-1 3.4-5 4.1-6 0Z" fill="#171820" />
      <circle cx="18" cy="40" r="3" fill="#d9ccff" />
      <circle cx="46" cy="40" r="3" fill="#d9ccff" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return <span className={`wordmark ${className ?? ""}`}>Panda</span>;
}
