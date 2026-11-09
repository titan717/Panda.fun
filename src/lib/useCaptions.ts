import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { keys } from "./api";
import { autoTrack, loadCues, saveSubMemory, subMemory, type Cue } from "./captions";
import type { Prefs } from "./store";
import type { SubtitleTrack, SubtitlesPayload } from "./types";

/** What the viewer picked in Audio & Subtitles; `null` means "follow the profile's settings". */
export type CaptionChoice = null | "off" | { lang: string; sdh: boolean; id: string };

export interface CaptionClock { position: number; at: number; playing: boolean; rate: number }

const MAX_LANGS = 3; // the backend answers up to three languages per request

/** Same track id when it is still listed, otherwise the same language and SDH choice (next episode). */
function pick(tracks: SubtitleTrack[], c: { lang: string; sdh: boolean; id?: string }) {
  return tracks.find((t) => t.id === c.id) ?? tracks.find((t) => t.language === c.lang && t.hearingImpaired === c.sdh) ?? tracks.find((t) => t.language === c.lang) ?? null;
}

/**
 * External subtitles for the player (v1.2.1, v1.2.7): the track list for this title / episode, the
 * track in use (picked automatically from the profile's languages, remembered for the title, or picked
 * by the viewer), its cues, a second track for dual subtitles, the timing offset and the interpolated
 * clock the caption layer reads. Languages outside the profile's two (dual subtitles, "More
 * languages") are fetched with a second request.
 */
export function useCaptions(o: { imdbId: string | null | undefined; season?: number; episode?: number; enabled: boolean; prefs: Prefs; original: string | null; titleKey?: string | null; profileId?: string | null }) {
  const mem = useMemo(() => (o.titleKey && o.profileId ? subMemory(o.profileId, o.titleKey) : null), [o.titleKey, o.profileId]);
  const base = useMemo(() => [...new Set([o.prefs.subtitleLang, o.prefs.subtitleLang2].filter((x): x is string => Boolean(x)))], [o.prefs.subtitleLang, o.prefs.subtitleLang2]);
  const [dual, setDualState] = useState<string | null>(() => (mem && mem.dual !== undefined ? mem.dual : o.prefs.subtitleDual ?? null));
  const [searched, setSearched] = useState<string[]>(() => (mem?.lang && !base.includes(mem.lang) ? [mem.lang] : []));
  const extra = useMemo(() => [...new Set([dual, ...searched].filter((l): l is string => Boolean(l) && !base.includes(l!)))].slice(0, MAX_LANGS), [dual, searched, base]);
  const swr = { revalidateOnFocus: false, shouldRetryOnError: false, keepPreviousData: false } as const;
  const list = useSWR<SubtitlesPayload>(o.enabled && o.imdbId ? keys.subtitles(o.imdbId, base, o.season, o.episode) : null, swr);
  const more = useSWR<SubtitlesPayload>(o.enabled && o.imdbId && extra.length ? keys.subtitles(o.imdbId, extra, o.season, o.episode) : null, swr);
  const tracks = useMemo(() => {
    const all = [...(list.data?.tracks ?? []), ...(more.data?.tracks ?? [])];
    return all.filter((t, i) => all.findIndex((x) => x.id === t.id) === i);
  }, [list.data, more.data]);
  const [choice, setChoice] = useState<CaptionChoice>(() => (mem?.off ? "off" : mem?.lang ? { lang: mem.lang, sdh: Boolean(mem.sdh), id: mem.id ?? "" } : null));
  const [offset, setOffset] = useState(() => (typeof mem?.offset === "number" && Number.isFinite(mem.offset) ? mem.offset : 0));
  const [cues, setCues] = useState<Cue[] | null>(null);
  const [dualCues, setDualCues] = useState<Cue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clock = useRef<CaptionClock>({ position: 0, at: 0, playing: false, rate: 1 });
  /** The last track that was on, for the one-press toggle. */
  const lastOn = useRef<{ lang: string; sdh: boolean; id: string } | null>(null);

  const remember = useCallback((patch: Parameters<typeof saveSubMemory>[2]) => {
    if (o.titleKey && o.profileId) saveSubMemory(o.profileId, o.titleKey, patch);
  }, [o.titleKey, o.profileId]);

  const track: SubtitleTrack | null = useMemo(() => {
    if (!o.enabled || choice === "off") return null;
    if (choice) return pick(tracks, choice);
    return autoTrack(tracks, { mode: o.prefs.subtitleMode, lang: o.prefs.subtitleLang, lang2: o.prefs.subtitleLang2, sdh: o.prefs.subtitleSdh, original: o.original });
  }, [o.enabled, choice, tracks, o.prefs.subtitleMode, o.prefs.subtitleLang, o.prefs.subtitleLang2, o.prefs.subtitleSdh, o.original]);
  if (track) lastOn.current = { lang: track.language, sdh: track.hearingImpaired, id: track.id };

  // the second line: same SDH preference, never the language already on screen
  const dualTrack: SubtitleTrack | null = useMemo(() => {
    if (!track || !dual || dual === track.language) return null;
    const own = tracks.filter((t) => t.language === dual);
    return own.find((t) => t.hearingImpaired === o.prefs.subtitleSdh) ?? own[0] ?? null;
  }, [track, dual, tracks, o.prefs.subtitleSdh]);

  useEffect(() => {
    setCues(null); setError(null);
    if (!track) return;
    let live = true;
    loadCues(track).then((c) => { if (live) setCues(c); }, (e: Error) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [track]);
  useEffect(() => {
    setDualCues(null);
    if (!dualTrack) return;
    let live = true;
    loadCues(dualTrack).then((c) => { if (live) setDualCues(c); }, () => { if (live) setDualCues(null); });
    return () => { live = false; };
  }, [dualTrack]);

  const choose = useCallback((t: SubtitleTrack | "off") => {
    if (t === "off") { setChoice("off"); remember({ off: true }); return; }
    setChoice({ lang: t.language, sdh: t.hearingImpaired, id: t.id });
    setOffset(0);
    remember({ off: false, lang: t.language, sdh: t.hearingImpaired, id: t.id, offset: 0 });
  }, [remember]);

  return {
    tracks, track, cues, error, offset, clock, choice, dual, dualTrack, dualCues, extra,
    loading: list.isLoading || more.isLoading || (Boolean(track) && !cues && !error),
    failed: Boolean(list.error),
    choose,
    /** One press: off when on; otherwise the last track, the title's remembered one or the profile's first language. */
    toggle: (): SubtitleTrack | null => {
      if (track) { choose("off"); return null; }
      const want = lastOn.current ?? (mem?.lang ? { lang: mem.lang, sdh: Boolean(mem.sdh), id: mem.id ?? "" } : null);
      const next = (want && pick(tracks, want)) ?? autoTrack(tracks, { mode: "always", lang: o.prefs.subtitleLang, lang2: o.prefs.subtitleLang2, sdh: o.prefs.subtitleSdh, original: null }) ?? tracks[0] ?? null;
      if (next) choose(next);
      return next;
    },
    /** Look for tracks in a language outside the profile's two ("More languages"). */
    search: (lang: string) => { if (!base.includes(lang)) setSearched((s) => [lang, ...s.filter((x) => x !== lang)].slice(0, 2)); },
    setDual: (lang: string | null) => { setDualState(lang); remember({ dual: lang }); },
    nudge: (by: number) => setOffset((v) => {
      const next = Math.max(-30, Math.min(30, Math.round((v + by) * 10) / 10));
      remember({ offset: next });
      return next;
    }),
    resetOffset: () => { setOffset(0); remember({ offset: 0 }); }
  };
}

export type Captions = ReturnType<typeof useCaptions>;
