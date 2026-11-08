import { useEffect, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { Avatar } from "../components/ui";
import { Sheet } from "../components/Sheet";
import { actions, getState, useProfile, useStore, type Profile } from "../lib/store";
import { useReducedMotion } from "../lib/hooks";
import { preload } from "swr";
import { api, fetcher, keys } from "../lib/api";
import { unlockAudio } from "../lib/audio";
import { loadYouTubeApi } from "../lib/youtube";
import { PosterWall } from "../components/PosterWall";
import { focusFirst } from "../lib/focus";
import { useNav } from "../lib/nav";
import { useIsTv } from "../lib/layout";

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
