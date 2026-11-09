import { API_BASE } from "./api";
import type { SubtitleTrack } from "./types";
import type { Prefs } from "./store";

/**
 * Caption layer (v1.2.1). Panda draws external subtitles itself, above the embed, timed by the
 * position the source reports over postMessage (CineSrc and Vidy both send time updates). Between
 * updates the clock runs on locally so captions change on the frame they should (D-119).
 */
export interface Cue { start: number; end: number; lines: string[] }

/** Languages offered for external subtitles (the backend's OpenSubtitles map), most used first. */
export const SUB_LANGS: { id: string; label: string }[] = [
  ["en", "English"], ["hi", "Hindi"], ["ml", "Malayalam"], ["ta", "Tamil"], ["te", "Telugu"], ["bn", "Bengali"], ["es", "Spanish"], ["fr", "French"],
  ["de", "German"], ["it", "Italian"], ["pt", "Portuguese"], ["ar", "Arabic"], ["ja", "Japanese"], ["ko", "Korean"], ["zh", "Chinese"], ["ru", "Russian"],
  ["tr", "Turkish"], ["nl", "Dutch"], ["pl", "Polish"], ["sv", "Swedish"], ["id", "Indonesian"], ["ms", "Malay"], ["th", "Thai"], ["vi", "Vietnamese"],
  ["el", "Greek"], ["he", "Hebrew"], ["ro", "Romanian"], ["cs", "Czech"], ["hu", "Hungarian"], ["uk", "Ukrainian"], ["fa", "Persian"]
].map(([id, label]) => ({ id: id!, label: label! }));
export const subLangName = (id: string | null | undefined) => SUB_LANGS.find((l) => l.id === id)?.label ?? id ?? "";

export type SubtitleMode = "off" | "foreign" | "always";
export type SubtitleSize = "small" | "medium" | "large" | "xlarge";
export type SubtitleStyle = "shadow" | "box" | "yellow" | "outline";

export const SUB_SIZES: { id: SubtitleSize; label: string; note?: string }[] = [
  { id: "small", label: "Small" }, { id: "medium", label: "Medium", note: "Recommended" }, { id: "large", label: "Large" }, { id: "xlarge", label: "Extra large" }
];
export type SubColor = NonNullable<Prefs["subtitleColor"]>;
export type SubBg = NonNullable<Prefs["subtitleBg"]>;
export type SubEdge = NonNullable<Prefs["subtitleEdge"]>;
/** The resolved look the caption layer draws (v1.2.7). */
export interface SubLook { size: SubtitleSize; color: SubColor; bg: SubBg; edge: SubEdge; pos: number }

export const SUB_COLORS: { id: SubColor; label: string; hex: string }[] = [
  { id: "white", label: "White", hex: "#ffffff" }, { id: "yellow", label: "Yellow", hex: "#ffe14d" },
  { id: "cyan", label: "Cyan", hex: "#7fe7ff" }, { id: "green", label: "Green", hex: "#a6f58c" }
];
export const SUB_BGS: { id: SubBg; label: string }[] = [{ id: "none", label: "None" }, { id: "dim", label: "Translucent" }, { id: "box", label: "Solid box" }];
export const SUB_EDGES: { id: SubEdge; label: string }[] = [{ id: "shadow", label: "Shadow" }, { id: "outline", label: "Outline" }, { id: "none", label: "None" }];
export const SUB_POS_MAX = 30;
export const SUB_POS_STEP = 2;
/** Height presets in Settings (the player panel moves in SUB_POS_STEP steps). */
export const SUB_HEIGHTS = [0, 6, 12, 20, 30];

/** v1.2.1 presets, read as colour / background / edge for profiles that never changed the v1.2.7 controls. */
const PRESETS: Record<SubtitleStyle, [SubColor, SubBg, SubEdge]> = {
  shadow: ["white", "none", "shadow"], box: ["white", "box", "none"], yellow: ["yellow", "none", "shadow"], outline: ["white", "none", "outline"]
};
export function subLook(p: Pick<Prefs, "subtitleSize" | "subtitleStyle" | "subtitleColor" | "subtitleBg" | "subtitleEdge" | "subtitlePos">): SubLook {
  const [color, bg, edge] = PRESETS[p.subtitleStyle] ?? PRESETS.shadow;
  const pos = Math.max(0, Math.min(SUB_POS_MAX, Math.round(Number(p.subtitlePos) || 0)));
  return { size: p.subtitleSize, color: p.subtitleColor ?? color, bg: p.subtitleBg ?? bg, edge: p.subtitleEdge ?? edge, pos };
}
/** The class list and custom properties for a caption block in this look. */
export const lookClass = (l: SubLook) => `cap--${l.size} cap-c--${l.color} cap-bg--${l.bg} cap-e--${l.edge}`;

/**
 * Remembered per title (v1.2.7): the track the viewer picked (or Off), the timing offset and the
 * second language, for this profile. The newest 200 titles are kept.
 */
export interface SubMemory { off?: boolean; lang?: string; sdh?: boolean; id?: string; offset?: number; dual?: string | null }
const MEM_KEY = "panda:v1:subs";
const MEM_MAX = 200;
type MemStore = Record<string, SubMemory & { at: number }>;
function readMem(): MemStore {
  try {
    const v = JSON.parse(localStorage.getItem(MEM_KEY) ?? "{}") as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? Object.assign(Object.create(null) as MemStore, v) : (Object.create(null) as MemStore);
  } catch { return Object.create(null) as MemStore; }
}
export function subMemory(profile: string, title: string): SubMemory | null {
  const v = readMem()[`${profile}|${title}`];
  return v && typeof v === "object" ? v : null;
}
export function saveSubMemory(profile: string, title: string, patch: SubMemory, now = Date.now()) {
  const all = readMem();
  const key = `${profile}|${title}`;
  all[key] = { ...(all[key] ?? {}), ...patch, at: now };
  const keep = Object.entries(all).sort((a, b) => (b[1].at ?? 0) - (a[1].at ?? 0)).slice(0, MEM_MAX);
  try { localStorage.setItem(MEM_KEY, JSON.stringify(Object.fromEntries(keep))); } catch { /* storage full */ }
}

/** Offset steps while a timing button is held: 0.1 s each, repeating faster the longer it is held. */
export const holdDelay = (n: number) => (n === 0 ? 420 : n < 6 ? 160 : n < 20 ? 90 : 50);

export const SUB_MODES: { id: SubtitleMode; label: string; note: string }[] = [
  { id: "foreign", label: "When the audio is in another language", note: "Turn on for titles not in your subtitle language" },
  { id: "always", label: "Always", note: "Turn on for every title that has them" },
  { id: "off", label: "Off", note: "Turn on yourself from Audio & Subtitles" }
];

const stamp = (s: string) => {
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/.exec(s.trim());
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number((m[4] ?? "0").padEnd(3, "0")) / 1000;
};

/** Removes every tag except <i>, <b>, <u> until nothing changes, then any stray "<" (nested tags cannot rebuild one). */
function stripTags(line: string): string {
  let t = line, prev;
  do { prev = t; t = t.replace(/<(?!\/?[ibu]>)[^>]*>/g, ""); } while (t !== prev);
  return t.replace(/<(?!\/?[ibu]>)/g, "").trim();
}

/** WebVTT (or SRT) → cues sorted by start time. Only <i>, <b>, <u> survive as markup. */
export function parseVtt(text: string): Cue[] {
  const out: Cue[] = [];
  for (const block of text.replace(/\r\n?/g, "\n").split(/\n{2,}/)) {
    const lines = block.split("\n");
    const i = lines.findIndex((l) => l.includes("-->"));
    if (i < 0) continue;
    const [a = "", b] = lines[i]!.split("-->");
    const start = stamp(a), end = stamp((b ?? "").trim().split(/\s+/)[0] ?? "");
    if (start === null || end === null || end <= start) continue;
    const body = lines.slice(i + 1).map(stripTags).filter(Boolean);
    if (body.length) out.push({ start, end, lines: body });
  }
  return out.sort((x, y) => x.start - y.start);
}

/** Cues showing at `t` (binary search, then overlapping neighbours). */
export function cuesAt(cues: Cue[], t: number): Cue[] {
  let lo = 0, hi = cues.length - 1, at = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (cues[mid]!.start <= t) { at = mid; lo = mid + 1; } else hi = mid - 1; }
  const res: Cue[] = [];
  for (let k = at; k >= 0 && k > at - 6; k--) { const c = cues[k]!; if (c.end > t) res.unshift(c); }
  return res;
}

/** Interpolated playback clock from the source's sparse time updates. */
export function clockAt(base: { position: number; at: number; playing: boolean; rate: number }, now: number) {
  if (!base.playing) return base.position;
  return base.position + Math.min(5, Math.max(0, (now - base.at) / 1000)) * base.rate;
}

/**
 * Track to show automatically: the profile's language (then its second language), regular before
 * SDH unless the profile prefers SDH. `foreign` only switches on when the title's original language
 * is not the subtitle language.
 */
export function autoTrack(tracks: SubtitleTrack[], o: { mode: SubtitleMode; lang: string; lang2: string | null; sdh: boolean; original: string | null }): SubtitleTrack | null {
  if (o.mode === "off" || !tracks.length) return null;
  if (o.mode === "foreign" && o.original && o.original === o.lang) return null;
  for (const lang of [o.lang, o.lang2]) {
    if (!lang) continue;
    if (o.mode === "foreign" && o.original === lang) return null;
    const list = tracks.filter((t) => t.language === lang);
    const hit = list.find((t) => t.hearingImpaired === o.sdh) ?? list[0];
    if (hit) return hit;
  }
  return null;
}

/** WebVTT for a track, once per session (the API also caches it for a week). */
const vttCache = new Map<string, Promise<Cue[]>>();
export function loadCues(track: SubtitleTrack, fetchImpl: typeof fetch = fetch): Promise<Cue[]> {
  const url = new URL(track.file, API_BASE).toString();
  const hit = vttCache.get(url);
  if (hit) return hit;
  const p = fetchImpl(url, { headers: { accept: "text/vtt" } }).then(async (r) => {
    if (!r.ok) throw new Error(`Subtitles could not be loaded (${r.status})`);
    const cues = parseVtt(await r.text());
    if (!cues.length) throw new Error("This subtitle file is empty");
    return cues;
  });
  vttCache.set(url, p);
  p.catch(() => vttCache.delete(url));
  return p;
}

export const offsetLabel = (s: number) => (s === 0 ? "In sync" : `${s > 0 ? "+" : "−"}${Math.abs(s).toFixed(1)} s ${s > 0 ? "later" : "earlier"}`);

/** The remote's CC / Subtitle key (Android TV, Fire TV, webOS 460) or C on a keyboard (v1.2.7 one-press toggle). */
export function isCcKey(e: Pick<KeyboardEvent, "key" | "keyCode" | "ctrlKey" | "metaKey" | "altKey" | "target">) {
  if (e.key === "ClosedCaptionToggle" || e.key === "Subtitle" || e.keyCode === 460) return true;
  if ((e.key === "c" || e.key === "C") && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const el = e.target as HTMLElement | null;
    return !(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable));
  }
  return false;
}
