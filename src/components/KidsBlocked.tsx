import { useEffect, useRef } from "react";
import { Icon } from "./Icon";
import { useNav } from "../lib/nav";

/** Shown when a Kids profile reaches a title that is not kid-safe (D-48). */
export function KidsBlocked({ title }: { title: string }) {
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
