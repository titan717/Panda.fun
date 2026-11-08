import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { Icon } from "../components/Icon";
import { Avatar, toast } from "../components/ui";
import { PageHeader } from "../components/PageHeader";
import { Sheet } from "../components/Sheet";
import { actions, getState, usePrefs, useProfile, useStore, type AvatarKind, type Profile } from "../lib/store";
import { useReducedMotion } from "../lib/hooks";
import { preload } from "swr";
import { api, fetcher, keys } from "../lib/api";
import { unlockAudio } from "../lib/audio";
import { loadYouTubeApi } from "../components/Trailer";
import { PosterWall } from "../components/PosterWall";
import { focusFirst, useBackHandler } from "../lib/focus";
import { useNav } from "../lib/nav";
import { useIsTv } from "../lib/layout";
import { useRemoteField } from "../lib/remoteInput";

/** PIN prompt guarding adult profiles when leaving a Kids profile (Parental Controls, spec 15.6). */
export function PinDialog({ title, onSuccess, onClose }: { title: string; onSuccess: () => void; onClose: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const expected = getState().prefs.kidsPin;
  const submit = (v: string) => {
    if (v === expected) onSuccess();
    else { setError(true); setPin(""); }
  };
  return (
    <Sheet title={title} onClose={onClose} className="pin-sheet">
      <p className="sheet-sub">Enter the 4-digit Parental Controls PIN.</p>
      <input className="pin-input" inputMode="numeric" pattern="[0-9]*" maxLength={4} autoFocus data-autofocus aria-label="PIN" type="password" value={pin}
        onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); setPin(v); setError(false); if (v.length === 4) submit(v); }} />
      {error && <p className="pin-error" role="alert">That PIN isn't right. Try again.</p>}
      <div className="pin-pad lrud-container">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) => k === "" ? <span key={i} /> : (
          <button key={i} id={`pin-${i}`} className="pin-key" data-hover-focus aria-label={k === "⌫" ? "Delete" : k}
            onClick={() => { if (k === "⌫") setPin((p) => p.slice(0, -1)); else { const v = (pin + k).slice(0, 4); setPin(v); setError(false); if (v.length === 4) submit(v); } }}>{k}</button>
        ))}
      </div>
    </Sheet>
  );
}

/** "Who's watching?" (spec 3). */
export function ProfileSelect() {
  const profiles = useStore((s) => s.profiles);
  const current = useProfile();
  const [chosen, setChosen] = useState<string | null>(null);
  const [pinFor, setPinFor] = useState<Profile | null>(null);
  const reduce = useReducedMotion();
  const tv = useIsTv();
  const { go } = useNav();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { if (root.current) focusFirst(root.current); }, []);

  const enter = (p: Profile) => {
    // The press is the user gesture that unlocks trailer sound (§4.B).
    unlockAudio();
    setChosen(p.id);
    // Apply the profile's settings before Home renders, and warm Home (rows, hero details, the
    // YouTube player API) during the ~0.5 s zoom so it appears already loaded (§4.D).
    actions.selectProfile(p.id);
    const kind = p.kids ? "kids" : "home";
    void preload(keys.page(kind), fetcher).then((pg) => {
      const h = (pg as Awaited<ReturnType<typeof api.page>>)?.hero?.[0];
      if (h) void preload(keys.title(h.type, h.tmdbId), fetcher);
    }).catch(() => undefined);
    void loadYouTubeApi().catch(() => undefined);
    setTimeout(() => go("/", { replace: true }), reduce ? 0 : 560);
  };
  const choose = (p: Profile) => {
    if (current?.kids && !p.kids && getState().prefs.kidsPin) { setPinFor(p); return; }
    enter(p);
  };

  return (
    <div ref={root} className={`profiles ${chosen ? "is-choosing" : ""}`}>
      <PosterWall tv={tv} />
      <h1 className="profiles-title">Who's watching?</h1>
      <div className="profiles-arc" aria-hidden="true" />
      <ul className="profiles-list lrud-container">
        {profiles.map((p) => (
          <li key={p.id} className={chosen === p.id ? "is-chosen" : chosen ? "is-faded" : ""}>
            <button id={`prof-${p.id}`} className="profile-btn" onClick={() => choose(p)} data-hover-focus data-autofocus={p.id === current?.id ? true : undefined}>
              <span className="profile-ring" aria-hidden="true" />
              <Avatar kind={p.avatar} />
              <span className="profile-name">{p.name}</span>
            </button>
          </li>
        ))}
        {profiles.length < 6 && (
          <li className={chosen ? "is-faded" : ""}>
            <button id="prof-add" className="profile-btn" onClick={() => go("/profiles/new")} data-hover-focus aria-label="Add profile">
              <span className="profile-ring" aria-hidden="true" />
              <span className="avatar avatar--add"><Icon name="plus" /></span>
              <span className="profile-name">Add</span>
            </button>
          </li>
        )}
      </ul>
      <button id="prof-manage" className="profiles-manage" onClick={() => go("/profiles/manage")} data-hover-focus><Icon name="edit" /> Manage Profiles</button>
      {pinFor && <PinDialog title={`Switch to ${pinFor.name}`} onClose={() => setPinFor(null)} onSuccess={() => { const p = pinFor; setPinFor(null); enter(p); }} />}
    </div>
  );
}

/** Manage profiles list (spec 15.3). */
export function ProfileManage() {
  const profiles = useStore((s) => s.profiles);
  const data = useStore((s) => s.data);
  const tv = useIsTv();
  const { go } = useNav();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { if (tv && root.current) focusFirst(root.current); }, [tv]);
  const summary = (id: string) => {
    const d = data[id];
    if (!d) return null;
    const saved = d.watchlist.length;
    const watching = Object.values(d.history).filter((h) => !h.completed && (h.position > 30 || h.upNext)).length;
    const parts = [saved ? `${saved} in Watchlist` : null, watching ? `${watching} in progress` : null].filter(Boolean);
    return parts.length ? parts.join(" • ") : "Nothing saved yet";
  };
  return (
    <div ref={root} className={tv ? "tv-page tv-settings-page" : "m-page"}>
      <PageHeader title="Manage Profiles" fallback="/my-space" />
      <ul className="manage-list lrud-container">
        {profiles.map((p) => (
          <li key={p.id}>
            <button id={`man-${p.id}`} className="manage-item" onClick={() => go(`/profiles/edit/${p.id}`)} data-hover-focus>
              <Avatar kind={p.avatar} />
              <span className="manage-text">
                <span className="manage-name">{p.name}{p.kids && <span className="manage-tag">Kids</span>}</span>
                <span className="manage-sub">{summary(p.id)}</span>
              </span>
              <Icon name="edit" />
            </button>
          </li>
        ))}
        {profiles.length < 6 && (
          <li>
            <button id="man-add" className="manage-item" onClick={() => go("/profiles/new")} data-hover-focus>
              <span className="avatar avatar--add"><Icon name="plus" /></span><span className="manage-name">Add Profile</span><Icon name="chevronRight" />
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}

const AVATARS: AvatarKind[] = ["smile", "panda", "star", "wave", "kids"];

/** Create / edit a profile. */
export function ProfileEdit({ isNew }: { isNew?: boolean }) {
  const { id } = useParams<{ id: string }>();
  const profiles = useStore((s) => s.profiles);
  const existing = isNew ? null : profiles.find((p) => p.id === id) ?? null;
  const [name, setName] = useState(existing?.name ?? "");
  const [avatar, setAvatar] = useState<AvatarKind>(existing?.avatar ?? "smile");
  const [kids, setKids] = useState(existing?.kids ?? false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const prefs = usePrefs();
  const tv = useIsTv();
  const { back } = useNav();
  const root = useRef<HTMLDivElement>(null);
  const field = useRemoteField(tv, () => document.getElementById(`pf-av-${avatar}`)?.focus());
  useEffect(() => { if (tv && root.current) focusFirst(root.current); }, [tv]);
  useBackHandler(() => { if (confirmDelete) { setConfirmDelete(false); return; } return false; }, confirmDelete);

  if (!isNew && !existing) {
    return <div className={tv ? "tv-page" : "m-page"}><PageHeader title="Profile not found" fallback="/profiles/manage" /></div>;
  }
  const save = () => {
    const n = name.trim();
    if (!n) { toast("Please enter a name"); return; }
    if (existing) actions.updateProfile(existing.id, { name: n, avatar, kids });
    else actions.addProfile(n, avatar, kids);
    toast(existing ? "Profile saved" : "Profile added");
    back("/profiles/manage");
  };

  return (
    <div ref={root} className={tv ? "tv-page tv-settings-page" : "m-page"}>
      <PageHeader title={existing ? "Edit Profile" : "Add Profile"} fallback="/profiles/manage" />
      <div className="profile-form">
        <Avatar kind={avatar} className="profile-form-avatar" />
        <label className="field">
          <span className="field-label">Name</span>
          <input ref={field.ref} {...field.props} id="pf-name" className="field-input" value={name} enterKeyHint="next" maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="Profile name" autoComplete="off" data-autofocus />
        </label>
        <div className="field">
          <span className="field-label">Avatar</span>
          <div className="avatar-pick lrud-container" role="radiogroup" aria-label="Avatar">
            {AVATARS.map((a) => (
              <button key={a} id={`pf-av-${a}`} role="radio" aria-checked={avatar === a} className={`avatar-opt ${avatar === a ? "is-selected" : ""}`} onClick={() => setAvatar(a)} data-hover-focus>
                <Avatar kind={a} />
              </button>
            ))}
          </div>
        </div>
        <button id="pf-kids" role="switch" aria-checked={kids} className="toggle-row" onClick={() => setKids((k) => !k)} data-hover-focus>
          <span><span className="toggle-title">Kids profile</span><span className="toggle-sub">Only animation and family titles rated for children{prefs.kidsPin ? "; PIN needed to leave it" : ""}</span></span>
          <span className={`toggle ${kids ? "is-on" : ""}`} aria-hidden="true" />
        </button>
        <div className="form-actions lrud-container">
          <button id="pf-save" className="btn btn--primary" onClick={save} data-hover-focus>Save</button>
          {existing && profiles.length > 1 && <button id="pf-delete" className="btn btn--danger" onClick={() => setConfirmDelete(true)} data-hover-focus>Delete Profile</button>}
        </div>
      </div>
      {confirmDelete && existing && (
        <Sheet title={`Delete ${existing.name}?`} onClose={() => setConfirmDelete(false)}>
          <p className="sheet-sub">Watchlist, history and ratings for this profile will be removed from this device.</p>
          <div className="form-actions lrud-container">
            <button className="btn btn--danger" data-autofocus onClick={() => { actions.deleteProfile(existing.id); toast("Profile deleted"); setConfirmDelete(false); back("/profiles/manage"); }}>Delete</button>
            <button className="btn btn--secondary" onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
