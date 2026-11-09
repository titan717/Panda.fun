import { native, isAndroidApp } from "./native";
import type { PlaybackSource, SourceId } from "./types";

/**
 * Ad shield (docs/AD_SHIELD.md). The web side owns click isolation, the per-adapter iframe
 * sandbox, the compatibility-mode rules and the local counters; the Android app adds window,
 * navigation, download, permission and network blocking and reports what it stopped.
 * In-video ads drawn by a provider inside its own video cannot be removed through an iframe.
 */
export type BlockKind = "popup" | "navigation" | "external" | "download" | "permission" | "request";

export interface SandboxProfile { id: "strict" | "none"; label: string; attr: string | null; note: string }

/** Strictest sandbox each provider still plays with, measured with tests/shield/probe (D-92). */
export const SANDBOX: Record<SourceId, SandboxProfile> = {
  cinesrc: { id: "strict", label: "Strict sandbox", attr: "allow-scripts allow-same-origin allow-presentation", note: "No popups, new windows, top navigation, forms or dialogs" },
  vidy: { id: "none", label: "Compatibility mode", attr: null, note: "The provider refuses to play in any sandbox, so its own controls are shown" },
  vidyanime: { id: "none", label: "Compatibility mode", attr: null, note: "Vidy's anime player, same rules as Vidy" },
  vidlink: { id: "none", label: "Compatibility mode", attr: null, note: "Refuses to play in a sandbox and opens a popup on the first click. Used only when the cleaner sources fail" }
};

/** Sources whose own interface must stay clickable (no command API). */
export const COMPAT: Record<SourceId, boolean> = { cinesrc: false, vidy: true, vidyanime: true, vidlink: true };

/** The Android app blocks popups, redirects and app launches natively, so compatibility sources are safe there. */
export const nativeShield = isAndroidApp;

interface Counts { popup: number; navigation: number; external: number; download: number; permission: number; request: number }
interface ShieldState { by: Partial<Record<SourceId, Counts & { plays: number }>>; log: { t: number; source: string; kind: BlockKind; host: string }[] }
const KEY = "panda:shield";
const LOG_MAX = 60;
const zero = (): Counts & { plays: number } => ({ popup: 0, navigation: 0, external: 0, download: 0, permission: 0, request: 0, plays: 0 });

function load(): ShieldState {
  try { const s = JSON.parse(localStorage.getItem(KEY) ?? "") as ShieldState; if (s && typeof s.by === "object" && Array.isArray(s.log)) return s; } catch { /* first run */ }
  return { by: {}, log: [] };
}
function save(s: ShieldState) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage full */ } }

/** Record a blocked attempt. Only the source id, the kind and the target host are kept (no user data). */
export function recordBlock(source: SourceId | string, kind: BlockKind, url = "") {
  const s = load();
  const id = source as SourceId;
  const c = (s.by[id] ??= zero());
  c[kind] = (c[kind] ?? 0) + 1;
  let host = "";
  try { host = url ? new URL(url).hostname : ""; } catch { host = url.split(":")[0]?.slice(0, 20) ?? ""; }
  s.log.unshift({ t: Date.now(), source: String(source), kind, host });
  s.log.length = Math.min(s.log.length, LOG_MAX);
  save(s);
  if (import.meta.env.DEV) console.info("[shield] blocked", kind, source, host);
}

export function recordPlay(source: SourceId) { const s = load(); (s.by[source] ??= zero()).plays++; save(s); }

/** Merge the native counters (Android) into the local ones once per player session. */
export function syncNative() {
  try {
    const raw = native?.shieldStats?.();
    if (!raw) return;
    const n = JSON.parse(raw) as { events?: { source: string; kind: BlockKind; host: string }[] };
    for (const e of n.events ?? []) recordBlock(e.source, e.kind, e.host ? `https://${e.host}` : "");
  } catch { /* old APK */ }
}

export function setShieldSource(id: SourceId | null) { try { native?.setShieldSource?.(id ?? ""); } catch { /* old APK */ } }

export function shieldStats() {
  const s = load();
  const total = (k: keyof Counts) => Object.values(s.by).reduce((n, c) => n + (c?.[k] ?? 0), 0);
  return { popups: total("popup"), navigations: total("navigation") + total("external"), requests: total("request"), by: s.by, log: s.log };
}

export function clearShield() { save({ by: {}, log: [] }); }

/** Blocked popup / redirect attempts per play: the noise score used for ranking. */
export function noise(id: SourceId) {
  const c = load().by[id];
  if (!c) return 0;
  return (c.popup + c.navigation + c.external + c.download) / Math.max(1, c.plays);
}

/**
 * Order sources: the preferred list order, demoting a noisy source behind a quieter one
 * (more than 1 blocked attempt per play above it), and compatibility sources outside the
 * Android app are kept only as the last resort (§C.5).
 */
export function rankSources(list: PlaybackSource[], order: SourceId[], opts: { tv: boolean; shielded?: boolean }) {
  const shielded = opts.shielded ?? nativeShield;
  const base = (s: PlaybackSource) => { const i = order.indexOf(s.id); return i < 0 ? order.length : i; };
  const score = (s: PlaybackSource) => base(s) + (noise(s.id) > 1 ? 1.5 : 0) + (!shielded && COMPAT[s.id] ? (opts.tv ? 100 : 10) : 0);
  // v1.2.4 (§6): the ad tier dominates; community ranking, speed and local noise reorder only inside a tier
  return [...list].sort((a, b) => effectiveTier(a, shielded) - effectiveTier(b, shielded) || score(a) - score(b));
}

/** Tier as this device experiences it: a popup source (tier 3) outside the Android firewall behaves like tier 4. */
export function effectiveTier(s: Pick<PlaybackSource, "id" | "tier">, shielded = nativeShield): 1 | 2 | 3 | 4 {
  const t = s.tier ?? 4;
  return t >= 3 && !shielded ? 4 : t;
}

/**
 * Last-resort sources are never picked first (§6, §C.5): tier 4 anywhere, tier 3 on TV (off by default
 * there), and compatibility sources in a TV browser. They still play when everything above them fails.
 */
export const lastResortOnly = (id: SourceId, tv: boolean, tier?: 1 | 2 | 3 | 4) => {
  const t = effectiveTier({ id, tier: tier ?? (id === "vidlink" ? 3 : id === "cinesrc" ? 1 : 2) });
  return t >= 4 || (tv && t >= 3) || (tv && !nativeShield && COMPAT[id]);
};

export const TIER_LABEL: Record<1 | 2 | 3 | 4, string> = { 1: "Ad-free", 2: "Light ads", 3: "Popups blocked by the app", 4: "Heavy ads · last resort" };
