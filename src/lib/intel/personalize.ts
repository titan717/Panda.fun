import { useMemo, useRef } from "react";
import type { LearnerState } from "./learner";
import { intelState, predict, useIntelVersion } from "./runtime";
import type { PandaItem } from "../types";

/**
 * v1.5.0 personal ordering for grids and lists outside Home (browse, moods, hidden gems, search, similar, cast).
 *
 * Rules:
 *  - Only the ORDER changes. Membership (the user's filters, kids rules, the catalogue's results) is never touched.
 *  - The model's predicted interest is blended with the catalogue's own order; the blend grows with evidence
 *    (0 with no history, up to `strength` after ~40 learning events). No model means the original order.
 *  - Paged grids are personalised page by page and each page's order is frozen once shown, so loading more
 *    (or the model learning in the background) never reshuffles titles already on screen or moves D-pad focus.
 *  - Everything runs on the device; nothing about the profile leaves it.
 */
export const BROWSE_STRENGTH = 0.5;
export const SEARCH_STRENGTH = 0.3;
export const MIN_EVENTS = 6;

export function hasSignal(s: LearnerState | null): boolean { return Boolean(s && s.n >= MIN_EVENTS); }

/** Blend of predicted interest (percentile) with the original position. Pure; stable on ties. */
export function personalOrder<T extends PandaItem>(items: readonly T[], s: LearnerState | null, strength = BROWSE_STRENGTH, now = Date.now()): T[] {
  const a = s ? strength * Math.min(1, s.n / 40) : 0;
  if (a <= 0 || items.length < 3) return [...items];
  const p = items.map((it) => predict(it, s, now) ?? 0);
  // percentile of each prediction; equal predictions share their average rank (ties must not favour either side)
  const sorted = [...p].sort((x, y) => x - y);
  const first = new Map<number, number>(), last = new Map<number, number>();
  sorted.forEach((v, r) => { if (!first.has(v)) first.set(v, r); last.set(v, r); });
  const n = items.length;
  const pct = (v: number) => (first.get(v)! + last.get(v)!) / 2 / (n - 1);
  return items.map((it, i) => ({ it, i, z: a * pct(p[i]!) + (1 - a) * (1 - i / (n - 1)) }))
    .sort((x, y) => y.z - x.z || x.i - y.i).map((x) => x.it);
}

/** Keep `pinned` (e.g. exact title matches in search) first, in their original order, then personalise the rest. */
export function personalOrderPinned(items: readonly PandaItem[], pinned: (it: PandaItem, i: number) => boolean, s: LearnerState | null, strength: number, now = Date.now()): PandaItem[] {
  const head: PandaItem[] = [], tail: PandaItem[] = [];
  items.forEach((it, i) => (pinned(it, i) ? head : tail).push(it));
  return [...head, ...personalOrder(tail, s, strength, now)];
}

/** Hook: a whole short list (cast page, similar titles). Recomputed only when the list itself changes. */
export function usePersonalList<T extends PandaItem>(items: readonly T[], enabled = true, strength = BROWSE_STRENGTH): readonly T[] {
  useIntelVersion();
  const s = intelState();
  const ready = enabled && hasSignal(s);
  const key = items.map((i) => i.id).join(",");
  const frozen = useRef<{ key: string; out: readonly T[] } | null>(null);
  return useMemo(() => {
    if (!ready) return items;
    if (frozen.current?.key === key) return frozen.current.out;
    const out = personalOrder(items, s, strength);
    frozen.current = { key, out };
    return out;
  // the order is frozen per list: re-learning must not reshuffle what is on screen
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready, strength]);
}

/** Hook: an infinite grid's pages, each personalised once and frozen. */
export function usePersonalPages(pages: readonly (readonly PandaItem[])[], enabled = true, strength = BROWSE_STRENGTH): PandaItem[] {
  useIntelVersion();
  const s = intelState();
  // decided once per grid (when its first page arrives) so crossing the evidence threshold mid-session cannot reshuffle it
  const lock = useRef<{ enabled: boolean; ready: boolean } | null>(null);
  if (!lock.current || lock.current.enabled !== enabled || !pages.length) lock.current = pages.length ? { enabled, ready: enabled && hasSignal(s) } : null;
  const ready = lock.current?.ready ?? false;
  const memo = useRef(new Map<string, readonly PandaItem[]>());
  const seen = new Set<string>();
  const out: PandaItem[] = [];
  for (const pg of pages) {
    const k = pg.map((i) => i.id).join(",");
    let o = ready ? memo.current.get(k) : pg;
    if (!o) { o = personalOrder(pg, s, strength); memo.current.set(k, o); }
    for (const it of o) if (!seen.has(it.id)) { seen.add(it.id); out.push(it); }
  }
  return out;
}
