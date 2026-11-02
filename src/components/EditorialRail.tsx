import React, { useState } from 'react';
import { Link } from 'wouter';
import { Check, Plus, Play } from 'lucide-react';
import { editorialCollections, EditorialTitle } from '../data/fixtures';
import { libraryManager } from '../lib/library';

function EditorialCard({ item, rank }: { item: EditorialTitle; rank?: number }) {
  const [inList, setInList] = useState(() => libraryManager.isInWatchlist(item.id));
  const href = `/details/${item.id}?type=${item.kind}&editorial=1`;

  const toggleList = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setInList(libraryManager.toggleWatchlist({ id: item.id, title: item.title, image: item.poster }));
  };

  return (
    <article className="panda-editorial-card">
      <Link href={href} className="panda-editorial-card__link" aria-label={`Open ${item.title}`}>
        <span className="panda-editorial-card__art">
          <img src={item.poster} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
          {rank && <span className="panda-editorial-card__rank" aria-label={`Rank ${rank}`}>{rank}</span>}
          <span className="panda-editorial-card__play" aria-hidden="true"><Play size={18} fill="currentColor" /></span>
        </span>
        <span className="panda-editorial-card__copy">
          <strong>{item.title}</strong>
          <small>{item.year} · {item.kind === 'movie' ? 'Movie' : 'Series'} · {item.genres.slice(0, 2).join(' / ')}</small>
        </span>
      </Link>
      <button type="button" className="panda-editorial-card__save" onClick={toggleList} aria-label={inList ? `Remove ${item.title} from My List` : `Add ${item.title} to My List`} aria-pressed={inList}>
        {inList ? <Check size={15} /> : <Plus size={15} />}
      </button>
    </article>
  );
}

export function EditorialRail({ collectionId, compact = false }: { collectionId: string; compact?: boolean }) {
  const collection = editorialCollections.find(item => item.id === collectionId);
  if (!collection) return null;
  const ranked = collection.id === 'top-ten';

  return (
    <section className={`panda-editorial-rail${compact ? ' panda-editorial-rail--compact' : ''}`} aria-labelledby={`editorial-${collection.id}`}>
      <header className="panda-editorial-rail__head">
        <div>
          <span>{collection.eyebrow}</span>
          <h2 id={`editorial-${collection.id}`}>{collection.title}</h2>
        </div>
        <Link href="/search" aria-label={`Explore ${collection.title}`}>Explore <span aria-hidden="true">→</span></Link>
      </header>
      <div className="panda-editorial-rail__track">
        {collection.items.map((item, index) => <EditorialCard key={item.id} item={item} rank={ranked ? index + 1 : undefined} />)}
      </div>
    </section>
  );
}
