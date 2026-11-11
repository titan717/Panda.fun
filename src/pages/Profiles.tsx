import { Suspense, useEffect, useRef, useState } from "react";
import { lazyNamed } from "../lib/lazy";
import { Icon } from "../components/Icon";
import { Avatar } from "../components/ui";
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
import { whoDone } from "../lib/launch";

// the PIN pad, its hash check and lockout load on demand (v1.2.7)
const PinDialog = lazyNamed(() => import("../components/PinDialog"), "PinDialog");

/** "Who's watching?" (spec 3). */
export function ProfileSelect({ stay = false }: { stay?: boolean }) {
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
    // a fresh start opened on a deep link (or a notification) stays on it; otherwise Home
    setTimeout(() => { whoDone(); if (!stay) go("/", { replace: true }); }, reduce ? 0 : 560);
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
      {pinFor && <Suspense fallback={null}><PinDialog title={`Switch to ${pinFor.name}`} onClose={() => setPinFor(null)} onSuccess={() => { const p = pinFor; setPinFor(null); enter(p); }} /></Suspense>}
    </div>
  );
}
