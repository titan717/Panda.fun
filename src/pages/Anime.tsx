import "./anime.css";
import "../lib/validateLazy"; // validators for this page's payloads, loaded with the page
import { useEffect, useMemo, useRef } from "react";
import { PageHeader } from "../components/PageHeader";
import { Icon } from "../components/Icon";
import { ErrorState, Img, Skeleton } from "../components/ui";
import { useIsTv } from "../lib/layout";
import { useAnime } from "../lib/hooks";
import { useProfile } from "../lib/store";
import { isKidsSafe } from "../lib/rows";
import { focusEl, focusFirst } from "../lib/focus";
import { useNav } from "../lib/nav";
import { titlePath, watchPath } from "../lib/format";
import { TvPoster } from "../tv/TvCards";
import { MPoster } from "../mobile/MCards";
import type { AnimeCard } from "../lib/types";

/** "Ep 6 in 2d" / "Ep 6 in 5h" / "Ep 6 airs soon" from AniList's next airing episode. */
export function airingLabel(a: AnimeCard["airing"], now = Date.now()): string | null {
  if (!a) return null;
  const ms = Date.parse(a.at) - now;
  if (!Number.isFinite(ms) || ms < 0) return null;
  const h = ms / 3_600_000;
  return h < 1 ? `Ep ${a.episode} airs soon` : h < 24 ? `Ep ${a.episode} in ${Math.round(h)}h` : `Ep ${a.episode} in ${Math.round(h / 24)}d`;
}

/** Second line under an anime poster: airing countdown, else AniList score and studio. */
export function animeCaption(c: AnimeCard, now = Date.now()) {
  return airingLabel(c.airing, now) ?? [c.score ? `★ ${c.score.toFixed(1)}` : null, c.studio].filter(Boolean).join(" · ");
}

const seasonName = (s: { name: string; year: number }) => (s.name ? `${s.name[0]}${s.name.slice(1).toLowerCase()} ${s.year}` : "");

/** Anime page (v1.2.0): AniList's trending, seasonal and all-time rows; every card opens the Panda title page. */
export function AnimePage() {
  const tv = useIsTv();
  const { go } = useNav();
  const profile = useProfile();
  const { data, error, mutate } = useAnime();
  const root = useRef<HTMLDivElement>(null);
  const rows = useMemo(() => (data?.rows ?? []).map((r) => ({ ...r, items: r.items.filter((x) => !profile?.kids || isKidsSafe(x)) })).filter((r) => r.items.length), [data, profile?.kids]);
  const hero = data?.hero && (!profile?.kids || isKidsSafe(data.hero)) ? data.hero : rows[0]?.items.find((x) => x.backdropLarge) ?? null;

  useEffect(() => { if (tv && data && root.current && !root.current.contains(document.activeElement)) focusFirst(root.current); }, [tv, data]);

  const cls = tv ? "tv-page tv-anime" : "m-page m-anime";
  if (error && !data) return <div className={cls}><PageHeader title="Anime" /><ErrorState message={error.message} onRetry={() => mutate()} /></div>;
  if (!data) {
    return (
      <div className={cls} aria-busy="true">
        {!tv && <PageHeader title="Anime" />}
        <Skeleton className="anime-hero-sk" />
        <div className="anime-sk-row">{Array.from({ length: tv ? 7 : 3 }, (_, i) => <Skeleton key={i} className={tv ? "sk-poster" : "sk-poster-m"} />)}</div>
      </div>
    );
  }

  return (
    <div ref={root} className={cls} data-scroll-y={tv ? "item" : undefined} data-scroll-offset="0.3">
      {!tv && <PageHeader title="Anime" />}
      {hero && (
        <section className="anime-hero" style={hero.color ? { ["--anime-accent" as string]: hero.color } : undefined}>
          {hero.backdropLarge && <Img src={hero.backdropLarge} alt="" className="anime-backdrop" eager />}
          <div className="anime-scrim" aria-hidden="true" />
          <div className="anime-text">
            <p className="anime-kicker">Anime{data.season.name ? ` · ${seasonName(data.season)}` : ""} · Trending now</p>
            <h1 className="anime-name">{hero.title}</h1>
            <p className="anime-facts">
              {[hero.year, hero.format === "MOVIE" ? "Movie" : hero.episodes ? `${hero.episodes} episodes` : "Series", hero.studio, hero.score ? `★ ${hero.score.toFixed(1)} on AniList` : null].filter(Boolean).join(" • ")}
              {airingLabel(hero.airing) && <span className="anime-airing"> • {airingLabel(hero.airing)}</span>}
            </p>
            {hero.overview && <p className="anime-overview">{hero.overview}</p>}
            <div className="anime-actions" onKeyDown={tv ? (e) => {
              // Down from the hero goes to the first row, not the sidebar beside it
              if (e.key !== "ArrowDown" || !rows[0]) return;
              const first = document.getElementById(`anime-${rows[0].id}-0`);
              if (first) { e.preventDefault(); focusEl(first); }
            } : undefined}>
              <button id="anime-play" className={tv ? "tv-btn tv-btn--primary anime-btn" : "btn btn--primary anime-btn"} data-autofocus data-hover-focus onClick={() => go(watchPath(hero.type, hero.tmdbId))}>
                <Icon name="play" /> Play
              </button>
              <button id="anime-info" className={tv ? "tv-btn anime-btn" : "btn anime-btn"} data-hover-focus onClick={() => go(titlePath(hero))}>
                <Icon name="info" /> More Info
              </button>
            </div>
          </div>
        </section>
      )}
      {rows.map((r) => (
        <section key={r.id} className={tv ? "tv-row anime-row" : "m-row anime-row"} data-row aria-labelledby={`anime-${r.id}-title`}>
          <h2 className={tv ? "tv-row-title" : "m-row-title"} id={`anime-${r.id}-title`}>{r.title}</h2>
          <div className={tv ? "tv-row-track" : "m-row-track"} data-scroll-x={tv ? true : undefined}>
            {r.items.map((it, i) => {
              const cap = animeCaption(it);
              return (
                <div key={it.id} className="anime-card">
                  {tv ? <TvPoster item={it} id={`anime-${r.id}-${i}`} expand={false} pos={[i + 1, r.items.length]} /> : <MPoster item={it} id={`anime-${r.id}-${i}`} />}
                  {cap && <span className={`anime-cap ${it.airing ? "is-airing" : ""}`}>{cap}</span>}
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <p className="anime-credit">Anime rows from AniList. Japanese animation can also play from Vidy Anime, which follows AniList's episode numbering.</p>
    </div>
  );
}
