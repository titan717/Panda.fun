import { memo, useMemo } from "react";
import { useLiteMotion, useReducedMotion, useTrending, useWall } from "../lib/hooks";

/**
 * Poster wall behind "Who's watching?" (§4.D, v1.3.0 depth layers, D-179). The near layer is the blueprint's
 * upright centred band (tv1#33: seven columns on TV, six in lite mode, four on phones). Behind it, wider bands of
 * smaller, softly blurred posters drift more slowly (parallax), so the band reads as the front of a deep wall.
 * TV draws three layers, phones two, lite mode only the near band. Each column is a slice rendered twice so a
 * translateY(-50%) loop is seamless. Only transforms animate; blur is a static filter on the images, painted once
 * into each column's layer. The near band has an opaque backing so the far layers never muddy it.
 */
type Layer = { key: "far" | "mid" | "near"; cols: number; speed: number };

export function wallLayers(tv: boolean, lite: boolean): Layer[] {
  if (lite) return [{ key: "near", cols: tv ? 6 : 4, speed: 1 }];
  return tv
    ? [{ key: "far", cols: 12, speed: 2.2 }, { key: "mid", cols: 9, speed: 1.5 }, { key: "near", cols: 7, speed: 1 }]
    : [{ key: "far", cols: 6, speed: 2 }, { key: "near", cols: 4, speed: 1 }];
}

/** Splits posters into columns per layer: the near band gets unique posters first; deeper layers reuse the rest. */
export function splitWall(src: string[], layers: Layer[]): string[][][] {
  const uniq = [...new Set(src)];
  const near = layers[layers.length - 1]!;
  const per = Math.min(10, Math.floor(uniq.length / near.cols));
  if (per < 4) return [];
  let cursor = 0;
  // front to back, so the band in focus never shows a poster twice
  const out = [...layers].reverse().map((l) => Array.from({ length: l.cols }, () => {
    const col: string[] = [];
    for (let i = 0; i < per; i++) col.push(uniq[(cursor++) % uniq.length]!);
    return col;
  }));
  return out.reverse();
}

export const PosterWall = memo(function PosterWall({ tv }: { tv: boolean }) {
  const wall = useWall();
  const trending = useTrending("all", "week");
  const lite = useLiteMotion();
  const reduce = useReducedMotion();
  const layers = useMemo(() => wallLayers(tv, lite), [tv, lite]);

  const columns = useMemo(() => {
    const src = wall.data?.posters.length
      ? wall.data.posters.map((p) => p.poster)
      : (trending.data?.results ?? []).map((i) => i.poster).filter((p): p is string => Boolean(p));
    return splitWall(src, layers);
  }, [wall.data, trending.data, layers]);

  if (!columns.length) return <div className="poster-wall" aria-hidden="true" />;
  const base = tv ? 70 : 55;
  return (
    <div className={`poster-wall ${reduce ? "is-static" : ""}`} aria-hidden="true">
      {layers.map((l, li) => (
        <div key={l.key} className={`poster-wall-layer poster-wall-layer--${l.key}`}>
          <div className="poster-wall-tilt" style={{ ["--wall-cols" as string]: l.cols }}>
            {columns[li]!.map((col, c) => (
              <div key={c} className={`poster-wall-col ${(c + li) % 2 ? "is-down" : "is-up"}`}
                style={{ animationDuration: `${Math.round((base + ((c * 37) % 5) * 12) * l.speed)}s`, animationDelay: `${-((c * 53 + li * 17) % 40)}s` }}>
                {[0, 1].map((dup) => (
                  <div key={dup} className="poster-wall-run">
                    {col.map((src, i) => <img key={`${src}-${i}`} src={src} alt="" loading={dup || l.key !== "near" ? "lazy" : "eager"} decoding="async" draggable={false} />)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
      <span className="poster-wall-shade" />
    </div>
  );
});
