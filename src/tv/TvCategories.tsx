import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ErrorState, Img, Skeleton } from "../components/ui";
import { useAnime, useCategories, usePage } from "../lib/hooks";
import { focusFirst } from "../lib/focus";
import { browseHref } from "../lib/format";

interface Tile { id: string; label: string; image: string | null; href: string; tint: number }

/** TV Categories (spec 9). */
export function TvCategories() {
  const { data, error, mutate } = useCategories();
  const home = usePage("home").data;
  const anime = useAnime().data;
  const [art, setArt] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { if (data && root.current) focusFirst(root.current); }, [data]);

  if (error && !data) return <div className="tv-page tv-page--center"><ErrorState message={error.message} onRetry={() => mutate()} /></div>;

  const heroImg = (n: number) => home?.hero[n]?.backdropLarge ?? null;
  const rows: { id: string; title: string; tiles: Tile[] }[] = data ? [
    { id: "genres", title: "Popular Genres", tiles: data.genres.map((g, i) => ({ id: `g-${g.id}`, label: g.name, image: g.image, href: browseHref("movie", { genre: String(g.id), title: g.name }), tint: i })) },
    { id: "langs", title: "Popular Languages", tiles: data.languages.map((l, i) => ({ id: `l-${l.code}`, label: l.name, image: l.image, href: browseHref("movie", { lang: l.code, title: `${l.name} Movies` }), tint: i + 3 })) },
    { id: "browse", title: "Browse", tiles: [
      { id: "b-tv", label: "TV Shows", image: heroImg(1), href: "/tv", tint: 1 },
      { id: "b-movies", label: "Movies", image: heroImg(2), href: "/movies", tint: 2 },
      { id: "b-new", label: "New & Hot", image: heroImg(3), href: "/new", tint: 4 },
      { id: "b-anime", label: "Anime", image: anime?.hero?.backdrop ?? anime?.rows[0]?.items[0]?.backdrop ?? null, href: "/anime", tint: 0 },
      { id: "b-trending", label: "Trending", image: heroImg(4), href: browseHref("trending", { title: "Trending Now" }), tint: 5 }
    ] }
  ] : [];

  return (
    <div ref={root} className="tv-page tv-cats" data-scroll-y="row" data-scroll-offset="0.42">
      <div className="tv-cats-art" aria-hidden="true">{(art ?? heroImg(0)) && <Img key={art ?? "h"} src={art ?? heroImg(0)} alt="" title="" />}</div>
      <h1 className="tv-page-title">Categories</h1>
      {!data && <section className="tv-row"><Skeleton className="sk-row-title" /><div className="tv-row-track">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="sk-tile" />)}</div></section>}
      {rows.map((r) => (
        <section key={r.id} className="tv-row tv-row--tiles" data-row aria-label={r.title}>
          <h2 className="tv-row-title">{r.title}</h2>
          <div className="tv-row-track" data-scroll-x>
            {r.tiles.map((t) => (
              <Link key={t.id} id={t.id} href={t.href} className={`tv-card tv-tile tint-${t.tint % 6}`} data-hover-focus onFocus={() => setArt(t.image)}>
                <Img src={t.image} alt="" title={t.label} />
                <span className="tv-tile-label">{t.label}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
