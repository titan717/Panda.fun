import type { Rating } from "../lib/store";

/**
 * v1.2.9 rating emoji (blueprints tvnewblueprint p.3, mobile pp.26-27): Love = red disc with a white heart,
 * Like = smiling face with a thumbs-up, Not for me = thumbs-down with a frowning face. Pure SVG so no font or
 * image is needed; the motion (`.rate-emoji--live`) is CSS only and switches off under reduced motion.
 */
export function RateEmoji({ kind, live = false, size }: { kind: Rating; live?: boolean; size?: number }) {
  const cls = `rate-emoji rate-emoji--${kind}${live ? " rate-emoji--live" : ""}`;
  const dim = size ? { width: size, height: size } : {};
  if (kind === "love") {
    return (
      <svg className={cls} viewBox="0 0 32 32" aria-hidden="true" {...dim}>
        <circle cx="16" cy="16" r="14.5" fill="#E8263B" />
        <circle cx="16" cy="16" r="14.5" fill="url(#re-shine)" />
        <path className="re-heart" d="M16 24.2s-8-4.9-8-10.4A4.4 4.4 0 0 1 16 11.3a4.4 4.4 0 0 1 8 2.5c0 5.5-8 10.4-8 10.4Z" fill="#fff" />
        <Shine />
      </svg>
    );
  }
  const like = kind === "like";
  return (
    <svg className={cls} viewBox="0 0 32 32" aria-hidden="true" {...dim}>
      <Shine />
      <g className="re-face">
        <circle cx={like ? 19 : 18} cy={like ? 13 : 17} r="11" fill="#FFC93C" />
        <circle cx={like ? 19 : 18} cy={like ? 13 : 17} r="11" fill="url(#re-shine)" />
        <circle cx={like ? 15.5 : 14.5} cy={like ? 11.5 : 15.5} r="1.4" fill="#5B3A12" />
        <circle cx={like ? 22.5 : 21.5} cy={like ? 11.5 : 15.5} r="1.4" fill="#5B3A12" />
        {like
          ? <path d="M14.6 15.6c1.1 2.3 2.6 3.4 4.4 3.4s3.3-1.1 4.4-3.4" stroke="#5B3A12" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          : <path d="M14.2 22c1.1-1.6 2.4-2.4 3.8-2.4s2.7.8 3.8 2.4" stroke="#5B3A12" strokeWidth="1.6" fill="none" strokeLinecap="round" />}
      </g>
      <g transform={like ? undefined : "matrix(1 0 0 -1 0 36)"}><g className="re-thumb">
        <path d="M5 16.5h3.6v10H5z" fill={like ? "#2BB7A5" : "#D93445"} />
        <path d="M8.6 26.5V16.8l3.6-6.3c.4-.8 1.2-1.2 2-1 1 .3 1.5 1.3 1.3 2.3l-.7 3.4h4.4c1.3 0 2.2 1.2 1.9 2.5l-1.5 6.3c-.3 1.4-1.5 2.5-3 2.5H8.6Z" fill={like ? "#38D4BF" : "#F0485A"} stroke="#fff" strokeWidth="1" strokeLinejoin="round" />
      </g></g>
    </svg>
  );
}

/** One shared radial highlight; repeated ids are harmless because every copy is identical. */
function Shine() {
  return (
    <defs>
      <radialGradient id="re-shine" cx="0.35" cy="0.3" r="0.75">
        <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
        <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.18" />
      </radialGradient>
    </defs>
  );
}
