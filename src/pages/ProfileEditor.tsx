/** Profile management screens (spec 15.3), loaded on demand so Who's watching paints from the entry chunk. */
import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { Icon } from "../components/Icon";
import { Avatar, toast } from "../components/ui";
import { PageHeader } from "../components/PageHeader";
import { Sheet } from "../components/Sheet";
import { actions, usePrefs, useStore, type AvatarKind } from "../lib/store";
import { focusFirst, useBackHandler } from "../lib/focus";
import { useNav } from "../lib/nav";
import { useIsTv } from "../lib/layout";
import { useRemoteField } from "../lib/remoteInput";
import "./profile-editor.css";
import { ParentLock } from "../components/PinDialog";

/** Manage profiles list (spec 15.3). */
/** Grown-up settings: while a Kids profile is on and a PIN is set, the PIN opens them (v1.2.7). */
export function ProfileManage() {
  return <ParentLock title="Manage Profiles" fallback="/profiles"><ManageList /></ParentLock>;
}

function ManageList() {
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
  return <ParentLock title={isNew ? "Add Profile" : "Edit Profile"} fallback="/profiles"><EditForm isNew={isNew} /></ParentLock>;
}

function EditForm({ isNew }: { isNew?: boolean }) {
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
