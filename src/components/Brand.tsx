/**
 * Brand images (docs/BRAND.md). Every logo or mascot drawn by the app goes through these two components, which read
 * src/lib/brand.ts — so replacing an asset is one file under public/brand/ or one path there.
 *
 * Each <img> carries intrinsic width/height (no layout shift), decoding="async", and falls back to a text wordmark
 * if the file fails to load.
 */
import { useState, type CSSProperties } from "react";
import { BRAND, BRAND_SIZE } from "../lib/brand";

type LogoVariant = "horizontal" | "vertical" | "wordmark" | "mark";
type MascotPose = "wave" | "play" | "peek";

const LOGO = {
  horizontal: "logoHorizontal",
  vertical: "logoVertical",
  wordmark: "wordmark",
  mark: "mark"
} as const satisfies Record<LogoVariant, keyof typeof BRAND_SIZE>;

const POSE = { play: "mascot", wave: "mascotWave", peek: "mascotPeek" } as const satisfies Record<MascotPose, keyof typeof BRAND_SIZE>;

interface Props {
  /** CSS size. Give one of width/height and the other follows the asset's aspect ratio. Numbers are px. */
  width?: number | string;
  height?: number | string;
  className?: string;
  /** Accessible name; pass "" for decorative use next to visible text. */
  alt?: string;
  /** Above-the-fold images: load eagerly with high priority. */
  priority?: boolean;
  style?: CSSProperties;
}

function BrandImg({ asset, kind, width, height, className, alt, priority, style }: Props & { asset: keyof typeof BRAND_SIZE; kind: string }) {
  const [failed, setFailed] = useState(false);
  const [w, h] = BRAND_SIZE[asset];
  const css: CSSProperties = { ...style };
  if (width !== undefined) css.width = width;
  if (height !== undefined) css.height = height;
  if (width !== undefined && height === undefined) css.height = "auto";
  if (height !== undefined && width === undefined) css.width = "auto";
  const label = alt ?? BRAND.name;
  if (failed) {
    return (
      <span className={`brand-fallback brand-fallback--${kind} ${className ?? ""}`} style={css} role={label ? "img" : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true}>
        {kind === "mark" ? "P" : <>Panda<b>.fun</b></>}
      </span>
    );
  }
  return (
    <img className={`brand-img brand-img--${kind} ${className ?? ""}`} src={BRAND[asset]} width={w} height={h} alt={label}
      decoding="async" loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} draggable={false} style={css}
      onError={() => setFailed(true)} />
  );
}

/** The Panda.fun logo: horizontal (mascot + wordmark), vertical (peek mascot over wordmark), wordmark only, or the square mark. */
export function BrandLogo({ variant = "horizontal", ...rest }: Props & { variant?: LogoVariant }) {
  return <BrandImg asset={LOGO[variant]} kind={variant} {...rest} />;
}

/** The mascot: waving with the play button ("play"), flat waving ("wave", for light surfaces), or head and paws ("peek"). */
export function Mascot({ pose = "play", alt = "", ...rest }: Props & { pose?: MascotPose }) {
  return <BrandImg asset={POSE[pose]} kind={`mascot-${pose}`} alt={alt} {...rest} />;
}
