import React, { useState } from 'react';
import { Bell, BellOff, Download, History, Library, PlayCircle, UserRound } from 'lucide-react';
import { Link } from 'wouter';
import { getEditorialTitle } from '../data/fixtures';

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
    <section className="panda-profile-v2__panel" style={{ marginBottom: 15 }}>
      <div className="panda-profile-v2__panel-head"><h2><UserRound size={16} /> My Panda</h2><span>{profileName}</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 9 }}>
        <article className="panda-profile-v2__panel" style={{ padding: 14 }}>
          <div className="panda-profile-v2__panel-head"><h2><Bell size={15} /> Notifications</h2><span>{reminders.length} reminders</span></div>
          <p className="panda-profile-v2__hint">{notifications ? 'In-app reminders are on.' : 'Get in-app premiere reminders.'}</p>
          <button type="button" className="panda-profile-v2__button" onClick={toggleNotifications} aria-pressed={notifications}>{notifications ? <BellOff size={14} /> : <Bell size={14} />}{notifications ? 'Turn off' : 'Enable reminders'}</button>
        </article>
        <article className="panda-profile-v2__panel" style={{ padding: 14 }}>
          <div className="panda-profile-v2__panel-head"><h2><Download size={15} /> Downloads</h2><span>Offline</span></div>
          <p className="panda-profile-v2__hint">Offline downloads are not available yet.</p>
          <span style={{ display: 'block', marginTop: 10, color: '#d6b477', fontSize: 10, fontWeight: 800 }}>Coming soon</span>
        </article>
        <article className="panda-profile-v2__panel" style={{ padding: 14 }}>
          <div className="panda-profile-v2__panel-head"><h2><Library size={15} /> My List</h2><span>Saved</span></div>
          <p className="panda-profile-v2__hint">Your saved stories, ready when you are.</p>
          <Link href="/library" className="panda-profile-v2__button">Open My List <span>→</span></Link>
        </article>
        <article className="panda-profile-v2__panel" style={{ padding: 14 }}>
          <div className="panda-profile-v2__panel-head"><h2><PlayCircle size={15} /> Trailers You’ve Watched</h2><span>{watched.length}</span></div>
          {watched.length ? <div className="panda-profile-v2__links">{watched.slice(0, 3).map(item => item && <Link key={item.id} href={`/details/${item.id}?type=${item.kind}&editorial=1`} className="panda-profile-v2__link">{item.title}<span>→</span></Link>)}</div> : <p className="panda-profile-v2__hint">Played previews appear here.</p>}
          <Link href="/whats-new" className="panda-profile-v2__button">Explore previews <span>→</span></Link>
        </article>
      </div>
      <Link href="/history" className="panda-profile-v2__link" style={{ marginTop: 10 }}><span><History size={14} /> View full watch history</span><span>→</span></Link>
    </section>
  );
}
