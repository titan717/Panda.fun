import { useMemo, useSyncExternalStore } from "react";
import { useStore } from "../store";
import { playbackPlatform } from "../playback/registry";
import { healthVersion, subscribeHealth, suppressedSet } from "../playback/health";
import { getFeedback, subscribeFeedback } from "./feedback";

let version = 0;
subscribeFeedback(() => { version++; });
const fbVersion = () => version;

/** Ids the active profile asked not to see again (Not interested, Hide, Already watched) plus titles suppressed for this platform. */
export function useHiddenRecoIds(): Set<string> {
  const fv = useSyncExternalStore(subscribeFeedback, fbVersion, fbVersion);
  const hv = useSyncExternalStore(subscribeHealth, healthVersion, healthVersion);
  const pid = useStore((s) => s.activeProfileId);
  return useMemo(() => {
    const out = new Set<string>(suppressedSet(playbackPlatform()));
    for (const e of getFeedback(pid)) if (e.kind === "hide" || e.kind === "not-interested" || e.kind === "watched") out.add(e.id);
    return out;
    // fv / hv: store versions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fv, hv, pid]);
}
