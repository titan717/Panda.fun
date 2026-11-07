import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Icon, PandaMark, Wordmark } from "../components/Icon";
import { ErrorState, Img, Skeleton, TitleArt, toast } from "../components/ui";
import { useHomeRows, type HomeRow } from "../lib/rows";
import { actions, useInWatchlist, usePrefs } from "../lib/store";
import { itemMeta, isNew, titlePath, watchPath } from "../lib/format";
import { useNav } from "../lib/nav";
import { useReducedMotion } from "../lib/hooks";
import type { PageKind, PandaItem } from "../lib/types";
import { MContinue, MLand, MPoster } from "./MCards";

const TOP10_LANGS = [{ code: "ml", name: "Malayalam" }, { code: "hi", name: "Hindi" }, { code: "ta", name: "Tamil" }, { code: "te", name: "Telugu" }, { code: "kn", name: "Kannada" }, { code: "en", name: "English" }, { code: "ko", name: "Korean" }];

function HeroCard({ item, index, kind }: { item: PandaItem; index: number; kind: PageKind }) {
  const inList = useInWatchlist(item.id);
  const { go } = useNav();
  const badge = kind === "home" ? `#${index + 1} in Trending Today` : isNew(item) ? "Newly Added" : null;
  return (
    <div className="m-hero-card">
      <Link href={titlePath(item)} className="m-hero-media" aria-label={item.title}>
        <Img src={item.posterLarge ?? item.poster} alt="" title={item.title} eager={index < 2} />
      </Link>
      {badge && <span className="m-glass-badge"><Icon name={kind === "home" ? "trend" : "sparkle"} /> {badge}</span>}
      <div className="m-hero-info">
        <TitleArt logo={item.logo} title={item.title} className="m-hero-logo" />
        <p className="m-hero-meta">{itemMeta(item)}</p>
        <div className="m-hero-actions">
          <button className="m-glass-btn" onClick={() => go(watchPath(item.type, item.tmdbId))}><Icon name="play" /> Watch Now</button>
          <button className={`m-glass-sq ${inList ? "is-on" : ""}`} aria-pressed={inList} aria-label={inList ? "Remove from Watchlist" : "Add to Watchlist"}
            onClick={() => { const added = actions.toggleWatchlist(item); toast(added ? "Added to Watchlist" : "Removed from Watchlist"); }}>
            <Icon name={inList ? "check" : "plus"} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Hero carousel with scroll-snap and 6 s auto-advance (spec 12.1). */
function HeroCarousel({ items, kind }: { items: PandaItem[]; kind: PageKind }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [touching, setTouching] = useState(false);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (items.length < 2 || touching || reduce) return;
    const t = setTimeout(() => {
      const el = track.current;
      if (!el) return;
      const nextI = (index + 1) % items.length;
      const card = el.children[nextI] as HTMLElement | undefined;
      if (card) el.scrollTo({ left: card.offsetLeft - el.offsetLeft - 12, behavior: "smooth" });
    }, 6000);
    return () => clearTimeout(t);
  }, [index, items.length, touching, reduce]);
  const onScroll = () => {
    const el = track.current;
    if (!el || !el.firstElementChild) return;
    const w = (el.firstElementChild as HTMLElement).offsetWidth + 10;
    setIndex(Math.round(el.scrollLeft / w));
  };
  return (
    <section className="m-hero" aria-roledescription="carousel" aria-label="Featured">
      <div ref={track} className="m-hero-track" onScroll={onScroll} onTouchStart={() => setTouching(true)} onTouchEnd={() => setTouching(false)}>
        {items.map((it, i) => <div key={it.id} className={`m-hero-slide ${i === index ? "is-active" : ""}`}><HeroCard item={it} index={i} kind={kind} /></div>)}
      </div>
    </section>
  );
}

function Top10Chips() {
  const prefs = usePrefs();
  return (
    <div className="m-chips" role="radiogroup" aria-label="Top 10 language">
      {TOP10_LANGS.map((l) => (
        <button key={l.code} role="radio" aria-checked={prefs.top10Lang === l.code} className={`m-chip ${prefs.top10Lang === l.code ? "is-selected" : ""}`} onClick={() => actions.setPrefs({ top10Lang: l.code })}>{l.name}</button>
      ))}
    </div>
  );
}

function MRow({ row }: { row: HomeRow }) {
  return (
    <section className={`m-row m-row--${row.kind}`} aria-label={row.title}>
      <div className="m-row-head">
        <h2 className="m-row-title">{row.title}</h2>
        {row.link && <Link href={row.link} className="m-row-more" aria-label={`See all ${row.title}`}><Icon name="chevronRight" /></Link>}
      </div>
      {row.kind === "top10" && <Top10Chips />}
      <div className="m-row-track">
        {row.kind === "continue" && row.entries.map((h) => <MContinue key={h.item.id} entry={h} />)}
        {row.kind === "landscape" && row.items.map((it) => <MLand key={it.id} item={it} />)}
        {row.kind === "poster" && row.items.map((it) => <MPoster key={it.id} item={it} />)}
        {row.kind === "top10" && row.items.map((it, i) => <MPoster key={it.id} item={it} rank={i + 1} top10 />)}
      </div>
    </section>
  );
}

/** Mobile Home / TV / Movies (spec 11, 12). */
export function MHome({ kind }: { kind: PageKind }) {
  const { rows, hero, page } = useHomeRows(kind);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 48);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [kind]);
  const label = kind === "tv" ? "TV" : kind === "movies" ? "Movies" : kind === "new" ? "New & Hot" : "For You";

  return (
    <div className="m-page m-home">
      {kind === "home" && (
        <div className={`m-brand-pills ${scrolled ? "is-hidden" : ""}`}>
          <Link href="/" className="m-brand-pill" aria-label="Panda home"><PandaMark size={22} /><Wordmark /></Link>
          <Link href="/new" className="m-hot-pill"><Icon name="flame" filled /> NEW & HOT</Link>
        </div>
      )}
      <header className={`m-head ${scrolled || kind !== "home" ? "is-solid" : ""}`}>
        {scrolled || kind !== "home" ? <span className="m-head-left"><PandaMark size={26} />{kind !== "home" && <span className="m-head-title">{label}</span>}</span> : <h1 className="m-head-title">{label}</h1>}
        <Link href="/settings/updates" className="m-whats-new">WHAT'S NEW</Link>
      </header>
      {page.error && !page.data && <ErrorState message={page.error.message} onRetry={() => page.mutate()} />}
      {!page.data && !page.error && (
        <>
          <div className="m-hero"><div className="m-hero-track"><Skeleton className="m-hero-card sk-hero-m" /></div></div>
          {[0, 1].map((i) => <section key={i} className="m-row"><Skeleton className="sk-row-title" /><div className="m-row-track">{[0, 1, 2, 3].map((j) => <Skeleton key={j} className="m-poster sk-poster-m" />)}</div></section>)}
        </>
      )}
      {page.data && hero.length > 0 && <HeroCarousel items={hero} kind={kind} />}
      {rows.map((r) => <MRow key={r.id} row={r} />)}
    </div>
  );
}
