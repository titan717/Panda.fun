import { API_BASE } from "./api";
import type { SubtitleTrack } from "./types";

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
export const SUB_STYLES: { id: SubtitleStyle; label: string; note: string }[] = [
  { id: "shadow", label: "Classic", note: "White text with a soft shadow" },
  { id: "box", label: "Box", note: "White text on a dark box, easiest to read" },
  { id: "yellow", label: "Yellow", note: "Yellow text with a shadow" },
  { id: "outline", label: "Outline", note: "White text with a black edge" }
];
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
