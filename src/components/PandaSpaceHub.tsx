import React, { useState } from 'react';
import { Bell, BellOff, Download, History, Library, PlayCircle, UserRound } from 'lucide-react';
import { Link } from 'wouter';
import { getEditorialTitle } from '../data/fixtures';
import './panda-space-hub.css';

function readSessionList(key: string): string[] {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch { return []; }
}

export function PandaSpaceHub() {
  const [profileName] = useState(() => {
    try {
      const id = sessionStorage.getItem('panda.profile.active');
      const names = JSON.parse(sessionStorage.getItem('panda.profile.names') || '{}') as Record<string, string>;
      const defaults: Record<string, string> = { ansh: 'Ansh', maya: 'Maya', leo: 'Leo', kids: 'Kids' };
      return (id && (names[id] || defaults[id])) || 'Panda';
    } catch { return 'Panda'; }
  });
  const [notifications, setNotifications] = useState(() => {
    try { return sessionStorage.getItem('panda.notifications.enabled') === 'true'; } catch { return false; }
  });
  const reminders = readSessionList('panda.editorial.reminders');
  const watched = readSessionList('panda.editorial.trailers').map(getEditorialTitle).filter(Boolean);

  const toggleNotifications = () => {
    setNotifications(value => {
      const next = !value;
      try { sessionStorage.setItem('panda.notifications.enabled', String(next)); } catch {}
      return next;
    });
  };

  return (
    <section className="panda-space-hub" aria-label="My Panda shortcuts">
      <div className="panda-space-hub__welcome"><span className="panda-space-hub__avatar"><UserRound size={19} /></span><div><span>YOUR PANDA SPACE</span><strong>{profileName}</strong></div></div>
      <div className="panda-space-hub__grid">
        <article className="panda-space-hub__tile"><div className="panda-space-hub__tile-head"><Bell size={17} /><span>{reminders.length} reminders</span></div><h2>Notifications</h2><p>{notifications ? 'In-app reminders are on.' : 'Get in-app premiere reminders.'}</p><button type="button" onClick={toggleNotifications} aria-pressed={notifications}>{notifications ? <BellOff size={14} /> : <Bell size={14} />}{notifications ? 'Turn off' : 'Enable reminders'}</button></article>
        <article className="panda-space-hub__tile"><div className="panda-space-hub__tile-head"><Download size={17} /><span>Offline</span></div><h2>Downloads</h2><p>Offline downloads are not available yet.</p><span className="panda-space-hub__coming">Offline downloads · Coming soon</span></article>
        <article className="panda-space-hub__tile"><div className="panda-space-hub__tile-head"><Library size={17} /><span>Saved titles</span></div><h2>My List</h2><p>Your saved stories, ready when you are.</p><Link href="/library">Open My List <span>→</span></Link></article>
        <article className="panda-space-hub__tile"><div className="panda-space-hub__tile-head"><PlayCircle size={17} /><span>{watched.length} previews</span></div><h2>Trailers You’ve Watched</h2>{watched.length ? <div className="panda-space-hub__watched">{watched.slice(0, 3).map(item => item && <Link key={item.id} href={`/details/${item.id}?type=${item.kind}&editorial=1`}>{item.title}</Link>)}</div> : <p>Played previews appear here.</p>}<Link href="/whats-new">Explore previews <span>→</span></Link></article>
      </div>
      <Link href="/history" className="panda-space-hub__history"><History size={14} /> View full watch history <span>→</span></Link>
    </section>
  );
}
