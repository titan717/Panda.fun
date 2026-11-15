import { isAndroidApp } from "../native";
import { isTvDevice } from "../device";
import type { PlaybackSource, SourceId, SourceRankingPayload } from "../types";

/**
 * v1.4.0 Source Registry — the ONE place that decides which providers a platform may use, and in what order.
 * There is no source picker anywhere in the app: the Playback Fallback Controller walks this list by itself.
 *
 *  - TV (Android TV app, TV browsers):  CineSrc only.
 *  - Mobile (Android phone/tablet app, touch browsers):  Vidy → CineSrc  (Vidy Anime, Vidy's AniList catalogue,
 *    is tried first for Japanese animation because it is the Vidy route for those titles).
 *  - Desktop browser:  CineSrc → Vidy (community ranking may swap the two; never applies the TV restriction).
 *
 * VidLink was removed in v1.4.0 on every platform (docs/SOURCES.md).
 */
export type PlaybackPlatform = "tv" | "mobile" | "browser";

export interface PlatformPolicy {
  /** Providers in start order. */
  order: SourceId[];
  /** Added in front of `order` for anime titles when the backend matched the AniList catalogue. */
  anime: SourceId[];
  /** Whether the community ranking may reorder `order` (never adds or removes a provider). */
  rankable: boolean;
}

export const SOURCE_POLICY: Record<PlaybackPlatform, PlatformPolicy> = {
  tv: { order: ["cinesrc"], anime: [], rankable: false },
  mobile: { order: ["vidy", "cinesrc"], anime: ["vidyanime"], rankable: false },
  browser: { order: ["cinesrc", "vidy"], anime: ["vidyanime"], rankable: true }
};

/** Every provider any platform may use (used to validate stored data and backend payloads). */
export const SUPPORTED_SOURCES: readonly SourceId[] = ["cinesrc", "vidy", "vidyanime"];

function coarseOnly() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(any-pointer: fine)").matches;
}

/** The playback platform of this device (not the layout: a desktop browser may draw the TV layout). */
export function playbackPlatform(): PlaybackPlatform {
  if (typeof window === "undefined") return "browser";
  if (isTvDevice()) return "tv";
  if (isAndroidApp) return "mobile";
  if (coarseOnly() || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) return "mobile";
  return "browser";
}

/** Provider ids eligible on a platform for a title, in start order. */
export function eligibleOrder(platform: PlaybackPlatform, o: { anime?: boolean; ranking?: SourceRankingPayload | null } = {}): SourceId[] {
  const p = SOURCE_POLICY[platform];
  let order = [...p.order];
  if (p.rankable && o.ranking?.sources?.length) {
    const rank = new Map(o.ranking.sources.map((s) => [s.id, s.rank] as const));
    order = order.map((id, i) => ({ id, i, r: rank.get(id) ?? 99 })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.id);
  }
  return o.anime ? [...p.anime.filter((x) => !order.includes(x)), ...order] : order;
}

/** The backend's sources, filtered to what the platform allows and put in the platform's order. */
export function orderSources(list: readonly PlaybackSource[], platform: PlaybackPlatform, o: { anime?: boolean; ranking?: SourceRankingPayload | null } = {}): PlaybackSource[] {
  const order = eligibleOrder(platform, o);
  const out: PlaybackSource[] = [];
  for (const id of order) {
    const s = list.find((x) => x.id === id);
    if (s && !out.some((x) => x.id === s.id)) out.push(s);
  }
  return out;
}
