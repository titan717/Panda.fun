import React, { useMemo, useState } from 'react';
import { Bell, BellRing, Flame, Play } from 'lucide-react';
import { Link } from 'wouter';
import { editorialTitles } from '../data/fixtures';
import { libraryManager } from '../lib/library';

type Tab = 'coming' | 'watching';

export function EditorialNewHot() {
  const [tab, setTab] = useState<Tab>('coming');
  const [reminders, setReminders] = useState<string[]>(() => {
    try { return JSON.parse(sessionStorage.getItem('panda.editorial.reminders') || '[]') as string[]; } catch { return []; }
  });
  const [saved, setSaved] = useState<string[]>([]);
  const upcoming = useMemo(() => editorialTitles.filter(item => item.releaseDate), []);
  const watching = useMemo(() => editorialTitles.filter(item => !item.releaseDate).slice(0, 10), []);
  const toggleReminder = (id: string) => setReminders(current => {
    const next = current.includes(id) ? current.filter(value => value !== id) : [...current, id];
    try { sessionStorage.setItem('panda.editorial.reminders', JSON.stringify(next)); } catch {}
    return next;
  });
  const toggleList = (item: (typeof editorialTitles)[number]) => {
    const next = libraryManager.toggleWatchlist({ id: item.id, title: item.title, image: item.poster });
    setSaved(current => next ? [...current, item.id] : current.filter(value => value !== item.id));
  };

  return (
    <section className="panda-new-hot">
      <div className="panda-new-hot__hero"><span><Flame size={14} /> THE PANDA RADAR</span><h1>New &amp; Hot</h1><p>Fresh arrivals and the stories everyone’s talking about.</p></div>
      <div className="panda-new-hot__tabs" role="tablist" aria-label="New and Hot collections">
        <button type="button" role="tab" aria-selected={tab === 'coming'} className={tab === 'coming' ? 'is-active' : ''} onClick={() => setTab('coming')}>Coming Soon</button>
        <button type="button" role="tab" aria-selected={tab === 'watching'} className={tab === 'watching' ? 'is-active' : ''} onClick={() => setTab('watching')}>Everyone’s Watching</button>
      </div>
      <div className="panda-new-hot__grid" role="tabpanel">
        {(tab === 'coming' ? upcoming : watching).map((item, index) => {
          const reminded = reminders.includes(item.id);
          const listed = saved.includes(item.id) || libraryManager.isInWatchlist(item.id);
          return <article className="panda-new-hot__card" key={item.id}>
            <Link href={`/details/${item.id}?type=${item.kind}&editorial=1`} className="panda-new-hot__art"><img src={item.poster} alt="" loading="lazy" /><span>{tab === 'coming' ? 'COMING SOON' : `#${index + 1} TRENDING`}</span><i><Play size={16} fill="currentColor" /></i></Link>
            <div className="panda-new-hot__copy"><div><h2>{item.title}</h2><p>{item.genres.slice(0, 2).join(' · ')} <span>·</span> {item.year}</p></div>
              {tab === 'coming' ? <button type="button" onClick={() => toggleReminder(item.id)} aria-pressed={reminded}>{reminded ? <BellRing size={15} /> : <Bell size={15} />}{reminded ? 'Reminder Set' : 'Remind Me'}</button> : <button type="button" onClick={() => toggleList(item)} aria-pressed={listed}>{listed ? 'In My List' : '+ My List'}</button>}
            </div>
            {tab === 'coming' && <p className="panda-new-hot__date">Premieres {item.releaseDate}</p>}
          </article>;
        })}
      </div>
    </section>
  );
}
