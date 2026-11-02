import React, { useEffect, useRef, useState } from 'react';
import { Check, Pencil, Save, X } from 'lucide-react';

export type PandaProfile = { id: string; name: string; accent: string; avatar: string };

const DEFAULT_PROFILES: PandaProfile[] = [
  { id: 'ansh', name: 'Ansh', accent: '#a75a62', avatar: '🐼' },
  { id: 'maya', name: 'Maya', accent: '#82649b', avatar: '🦊' },
  { id: 'leo', name: 'Leo', accent: '#5c8d82', avatar: '🐯' },
  { id: 'kids', name: 'Kids', accent: '#b18b52', avatar: '🐨' },
];

export function ProfilePicker({ onSelect }: { onSelect: (profile: PandaProfile) => void }) {
  const [profiles, setProfiles] = useState<PandaProfile[]>(() => {
    try {
      const saved = sessionStorage.getItem('panda.profile.names');
      if (!saved) return DEFAULT_PROFILES;
      const names = JSON.parse(saved) as Record<string, string>;
      return DEFAULT_PROFILES.map(profile => ({ ...profile, name: names[profile.id] || profile.name }));
    } catch { return DEFAULT_PROFILES; }
  });
  const [editing, setEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const firstProfile = useRef<HTMLButtonElement | null>(null);

  useEffect(() => { firstProfile.current?.focus({ preventScroll: true }); }, []);

  const saveName = (profile: PandaProfile) => {
    const name = draft.trim();
    if (!name) return;
    const next = profiles.map(item => item.id === profile.id ? { ...item, name } : item);
    setProfiles(next);
    try { sessionStorage.setItem('panda.profile.names', JSON.stringify(Object.fromEntries(next.map(item => [item.id, item.name])))); } catch {}
    setEditId(null);
    setDraft('');
  };

  return (
    <div className="panda-profile-picker" role="dialog" aria-modal="true" aria-labelledby="panda-profile-picker-title">
      <div className="panda-profile-picker__panel">
        <div className="panda-profile-picker__top"><span className="panda-profile-picker__brand">panda<span>.fun</span></span><button type="button" onClick={() => setEditing(value => !value)} className="panda-profile-picker__edit">{editing ? <Check size={15} /> : <Pencil size={15} />}{editing ? 'Done' : 'Edit'}</button></div>
        <span className="panda-profile-picker__eyebrow">One screen. Your stories.</span>
        <h1 id="panda-profile-picker-title">Who’s watching?</h1>
        <p className="panda-profile-picker__hint">{editing ? 'Give each profile its own name.' : 'Choose a profile to make this space yours.'}</p>
        <div className="panda-profile-picker__grid">
          {profiles.map((profile, index) => (
            <div className="panda-profile-picker__item" key={profile.id}>
              {editing ? <>
                <div className="panda-profile-picker__avatar" style={{ background: profile.accent }} aria-hidden="true">{profile.avatar}</div>
                {editId === profile.id ? <div className="panda-profile-picker__edit-row"><input aria-label={`Name for ${profile.name}`} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') saveName(profile); if (event.key === 'Escape') setEditId(null); }} autoFocus /><button type="button" onClick={() => saveName(profile)} aria-label="Save profile name"><Save size={15} /></button><button type="button" onClick={() => setEditId(null)} aria-label="Cancel profile name edit"><X size={15} /></button></div> : <button type="button" className="panda-profile-picker__name-edit" onClick={() => { setEditId(profile.id); setDraft(profile.name); }}>{profile.name} <Pencil size={13} /></button>}
              </> : <button ref={index === 0 ? firstProfile : undefined} type="button" className="panda-profile-picker__select" onClick={() => onSelect(profile)}><span className="panda-profile-picker__avatar" style={{ background: profile.accent }} aria-hidden="true">{profile.avatar}</span><strong>{profile.name}</strong></button>}
            </div>
          ))}
        </div>
        <span className="panda-profile-picker__footer">Profiles stay on this device for this session</span>
      </div>
    </div>
  );
}
