import React, { useState } from 'react';
import { Check, Play, Plus, Sparkles } from 'lucide-react';
import { Link } from 'wouter';
import { getEditorialTitle } from '../data/fixtures';
import { libraryManager } from '../lib/library';
import './editorial-spotlight.css';

export function EditorialSpotlight() {
  const item = getEditorialTitle('night-shift');
  const [inList, setInList] = useState(() => item ? libraryManager.isInWatchlist(item.id) : false);
  if (!item) return null;
  const href = `/details/${item.id}?type=series&editorial=1`;

  const toggleList = () => setInList(libraryManager.toggleWatchlist({ id: item.id, title: item.title, image: item.poster }));

  return (
    <section className="panda-editorial-spotlight" aria-labelledby="panda-editorial-spotlight-title">
      <img src={item.backdrop} alt="" className="panda-editorial-spotlight__image" fetchPriority="high" />
      <div className="panda-editorial-spotlight__veil" />
      <div className="panda-editorial-spotlight__content">
        <span className="panda-editorial-spotlight__eyebrow"><Sparkles size={13} /> panda.fun Original</span>
        <span className="panda-editorial-spotlight__rank">#2 in TV Shows Today</span>
        <h2 id="panda-editorial-spotlight-title">{item.title}</h2>
        <div className="panda-editorial-spotlight__meta"><span>2025</span><span>TV-MA</span><span>1 Season</span><span>HD</span></div>
        <p className="panda-editorial-spotlight__genres">Gritty <i>·</i> Heist <i>·</i> Thriller</p>
        <p className="panda-editorial-spotlight__synopsis">{item.synopsis}</p>
        <div className="panda-editorial-spotlight__actions">
          <Link href={href} className="panda-editorial-spotlight__play"><Play size={16} fill="currentColor" /> Play</Link>
          <button type="button" onClick={toggleList} aria-pressed={inList}>{inList ? <Check size={16} /> : <Plus size={16} />}{inList ? 'In My List' : 'My List'}</button>
        </div>
      </div>
    </section>
  );
}
