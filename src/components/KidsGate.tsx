import { Suspense, type ReactNode } from "react";
import { Spinner } from "./ui";
import { useTitle } from "../lib/hooks";
import { useProfile } from "../lib/store";
import { isKidsSafeTitle } from "../lib/kids";
import { lazyNamed } from "../lib/lazy";
import type { MediaType } from "../lib/types";

/**
 * Kids profiles can only open kid-safe titles (D-48). Rows and search already filter, but deep links,
 * "More like this", Continue Watching from before a profile became Kids, or a shared link could still reach
 * a grown-up title, so Details and the player check again here.
 */
// the blocked screen is rare, so it loads on demand (v1.2.5, keeps the entry chunk flat)
const KidsBlocked = lazyNamed(() => import("./KidsBlocked"), "KidsBlocked");

export function KidsGate({ type, id, wait = false, children }: { type: MediaType; id: number; wait?: boolean; children: ReactNode }) {
  const profile = useProfile();
  const { data } = useTitle(profile?.kids ? type : null, profile?.kids ? id : null);
  if (!profile?.kids) return <>{children}</>;
  if (!data) return wait ? <div className="kids-gate"><Spinner /></div> : <>{children}</>;
  if (isKidsSafeTitle(data)) return <>{children}</>;
  return <Suspense fallback={<div className="kids-gate"><Spinner /></div>}><KidsBlocked title={data.title} /></Suspense>;
}
