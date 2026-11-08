import { memo, useMemo } from "react";
import { useLiteMotion, useReducedMotion, useTrending, useWall } from "../lib/hooks";

/**
 * Drifting poster wall behind "Who's watching?" (§4.D). Columns of small real posters move
 * at different speeds in alternating directions under a slight tilt. Each column gets a unique
 * slice of the backend wall (no poster appears twice on screen); the slice is rendered twice so a
 * translateY(-50%) loop is seamless. Transform-only animation; fewer columns on weak devices.
 */
export const PosterWall = memo(function PosterWall({ tv }: { tv: boolean }) {
  const wall = useWall();
  const trending = useTrending("all", "week");
  const lite = useLiteMotion();
  const reduce = useReducedMotion();
  // tv1#33: a centred band of about seven upright columns (four on phones)
  const cols = tv ? (lite ? 6 : 7) : 4;

  const columns = useMemo(() => {
    const src = wall.data?.posters.length
      ? wall.data.posters.map((p) => p.poster)
      : (trending.data?.results ?? []).map((i) => i.poster).filter((p): p is string => Boolean(p));
    const uniq = [...new Set(src)];
    const per = Math.floor(uniq.length / cols);
    if (per < 4) return [];
    return Array.from({ length: cols }, (_, c) => uniq.slice(c * per, (c + 1) * per));
  }, [wall.data, trending.data, cols]);

  if (!columns.length) return <div className="poster-wall" aria-hidden="true" />;
  return (
    <div className={`poster-wall ${reduce ? "is-static" : ""}`} aria-hidden="true" style={{ ["--wall-cols" as string]: cols }}>
      <div className="poster-wall-tilt">
        {columns.map((col, c) => (
          <div key={c} className={`poster-wall-col ${c % 2 ? "is-down" : "is-up"}`}
            style={{ animationDuration: `${(tv ? 70 : 55) + ((c * 37) % 5) * 12}s`, animationDelay: `${-((c * 53) % 40)}s` }}>
            {[0, 1].map((dup) => (
              <div key={dup} className="poster-wall-run">
                {col.map((src) => <img key={src} src={src} alt="" loading={dup ? "lazy" : "eager"} decoding="async" draggable={false} />)}
              </div>
            ))}
          </div>
        ))}
      </div>
      <span className="poster-wall-shade" />
    </div>
  );
});
