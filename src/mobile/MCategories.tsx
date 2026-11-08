import { Link } from "wouter";
import { PageHeader } from "../components/PageHeader";
import { ErrorState, Img, Skeleton } from "../components/ui";
import { useAnime, useCategories, usePage } from "../lib/hooks";
import { browseHref } from "../lib/format";

/** Mobile Categories (spec 9 adapted to touch): genre and language tiles. */
export function MCategories() {
  const { data, error, mutate } = useCategories();
  const anime = useAnime().data;
  const home = usePage("home").data;
  return (
    <div className="m-page">
      <PageHeader title="Categories" />
      {error && !data && <ErrorState message={error.message} onRetry={() => mutate()} />}
      {!data && !error && <div className="m-tiles">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="m-tile" />)}</div>}
      {data && (
        <>
          <h2 className="m-row-title m-pad">Popular Genres</h2>
          <div className="m-tiles">
            {data.genres.map((g, i) => (
              <Link key={g.id} href={browseHref("movie", { genre: String(g.id), title: g.name })} className={`m-tile tint-${i % 6}`}>
                <Img src={g.image} alt="" title={g.name} /><span className="m-tile-label">{g.name}</span>
              </Link>
            ))}
          </div>
          <h2 className="m-row-title m-pad">Explore</h2>
          <div className="m-tiles">
            <Link id="mc-anime" href="/anime" className="m-tile tint-0">
              <Img src={anime?.hero?.backdrop ?? anime?.rows[0]?.items[0]?.backdrop ?? null} alt="" title="Anime" /><span className="m-tile-label">Anime</span>
            </Link>
            <Link id="mc-trending" href={browseHref("trending", { title: "Trending Now" })} className="m-tile tint-5">
              <Img src={home?.hero[4]?.backdrop ?? home?.hero[0]?.backdrop ?? null} alt="" title="Trending" /><span className="m-tile-label">Trending</span>
            </Link>
          </div>
          <h2 className="m-row-title m-pad">Popular Languages</h2>
          <div className="m-tiles">
            {data.languages.map((l, i) => (
              <Link key={l.code} href={browseHref("movie", { lang: l.code, title: `${l.name} Movies` })} className={`m-tile tint-${(i + 3) % 6}`}>
                <Img src={l.image} alt="" title={l.name} /><span className="m-tile-label">{l.name}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
