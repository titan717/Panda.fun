import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";
import { Spinner } from "./ui";
import { useTitle } from "../lib/hooks";
import { useProfile } from "../lib/store";
import { isKidsSafeTitle } from "../lib/rows";
import { useNav } from "../lib/nav";
import type { MediaType } from "../lib/types";

/**
 * Kids profiles can only open kid-safe titles (D-48). Rows and search already filter, but deep links,
 * "More like this", Continue Watching from before a profile became Kids, or a shared link could still reach
 * a grown-up title, so Details and the player check again here.
 */
export function KidsGate({ type, id, wait = false, children }: { type: MediaType; id: number; wait?: boolean; children: ReactNode }) {
  const profile = useProfile();
  const { data } = useTitle(profile?.kids ? type : null, profile?.kids ? id : null);
  if (!profile?.kids) return <>{children}</>;
  if (!data) return wait ? <div className="kids-gate"><Spinner /></div> : <>{children}</>;
  if (isKidsSafeTitle(data)) return <>{children}</>;
  return <KidsBlocked title={data.title} />;
}

function KidsBlocked({ title }: { title: string }) {
  const { go, back } = useNav();
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { first.current?.focus({ preventScroll: true }); }, []);
  return (
    <div className="kids-gate" role="alert">
      <span className="kids-gate-icon"><Icon name="lock" size={44} /></span>
      <p className="state-title">Not available on Kids profiles</p>
      <p className="state-sub">{title} is for older viewers. Switch to a grown-up profile to watch it.</p>
      <div className="kids-gate-actions">
        <button ref={first} id="kids-back" className="btn btn--primary" data-autofocus data-hover-focus onClick={() => back("/")}><Icon name="back" /> Go back</button>
        <button className="btn btn--secondary" data-hover-focus onClick={() => go("/profiles", { replace: true })}><Icon name="user" /> Switch profile</button>
      </div>
    </div>
  );
}
