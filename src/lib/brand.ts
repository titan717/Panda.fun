/**
 * v1.4.0 Branding and Asset Manager — the ONE place that names Panda.fun's brand assets.
 *
 * Source of truth: "mascot and logo assests.pdf" (docs/BRAND.md). Every component, the landing page and the
 * intro read these paths; replacing a logo means replacing the file under public/brand/ (same name) or
 * changing the path here. Paths are relative to Vite's BASE_URL so they work on the web ("/") and inside
 * the Android WebView ("./").
 */
const base = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/";
const at = (p: string) => `${base}${p}`;

export const BRAND = {
  name: "Panda.fun",
  shortName: "Panda",
  tagline: "Movies, shows and anime — picked for you",
  colors: { black: "#000000", white: "#ffffff", purple: "#8b2cff", magenta: "#d42cff", violet: "#4d1cff" },
  /** Waving mascot holding the play button (PDF page 1), transparent. */
  mascot: at("brand/mascot.webp"),
  /** Standalone waving panda without the play button (PDF page 4), transparent. */
  mascotWave: at("brand/mascot-wave.webp"),
  /** Head-and-paws mascot from the vertical logo (PDF page 2), transparent. */
  mascotPeek: at("brand/mascot-peek.webp"),
  /** Compact square mark for small places (nav, avatars, toasts). */
  mark: at("brand/mark.webp"),
  /** Horizontal wordmark with mascot (PDF page 3), transparent, for dark backgrounds. */
  logoHorizontal: at("brand/logo-horizontal.webp"),
  /** Vertical mascot-over-wordmark composition (PDF page 2), transparent. */
  logoVertical: at("brand/logo-vertical.webp"),
  /** Wordmark only ("Panda.fun" text), transparent. */
  wordmark: at("brand/wordmark.webp"),
  /** Social sharing card 1200 × 630. */
  ogImage: at("brand/og-image.png")
} as const;

/** Intrinsic pixel sizes of the files above (scripts/brand/build.py). Used for width/height attributes so images never shift layout. */
export const BRAND_SIZE = {
  mascot: [785, 800],
  mascotWave: [779, 800],
  mascotPeek: [640, 609],
  mark: [256, 256],
  logoHorizontal: [1200, 377],
  logoVertical: [796, 800],
  wordmark: [1000, 177],
  ogImage: [1200, 630]
} as const satisfies Record<string, readonly [number, number]>;

export type BrandAsset = Exclude<keyof typeof BRAND, "name" | "shortName" | "tagline" | "colors">;
