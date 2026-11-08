import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { keys } from "./api";
import { autoTrack, loadCues, type Cue } from "./captions";
import type { Prefs } from "./store";
import type { SubtitleTrack, SubtitlesPayload } from "./types";

/** What the viewer picked in Audio & Subtitles; `null` means "follow the profile's settings". */
export type CaptionChoice = null | "off" | { lang: string; sdh: boolean; id: string };

export interface CaptionClock { position: number; at: number; playing: boolean; rate: number }

/**
 * External subtitles for the player (v1.2.1): the track list for this title / episode, the track
 * in use (picked automatically from the profile's languages, or by the viewer), its cues, the
 * timing offset and the interpolated clock the caption layer reads.
 */
export function useCaptions(o: { imdbId: string | null | undefined; season?: number; episode?: number; enabled: boolean; prefs: Prefs; original: string | null }) {
  const langs = useMemo(() => [...new Set([o.prefs.subtitleLang, o.prefs.subtitleLang2].filter((x): x is string => Boolean(x)))], [o.prefs.subtitleLang, o.prefs.subtitleLang2]);
  const list = useSWR<SubtitlesPayload>(o.enabled && o.imdbId ? keys.subtitles(o.imdbId, langs, o.season, o.episode) : null, { revalidateOnFocus: false, shouldRetryOnError: false, keepPreviousData: false });
  const tracks = useMemo(() => list.data?.tracks ?? [], [list.data]);
  const [choice, setChoice] = useState<CaptionChoice>(null);
  const [offset, setOffset] = useState(0);
  const [cues, setCues] = useState<Cue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clock = useRef<CaptionClock>({ position: 0, at: 0, playing: false, rate: 1 });

  const track: SubtitleTrack | null = useMemo(() => {
    if (!o.enabled || choice === "off") return null;
    if (choice) {
      // same track id when it is still listed, otherwise the same language and SDH choice (next episode)
      return tracks.find((t) => t.id === choice.id) ?? tracks.find((t) => t.language === choice.lang && t.hearingImpaired === choice.sdh) ?? tracks.find((t) => t.language === choice.lang) ?? null;
    }
    return autoTrack(tracks, { mode: o.prefs.subtitleMode, lang: o.prefs.subtitleLang, lang2: o.prefs.subtitleLang2, sdh: o.prefs.subtitleSdh, original: o.original });
  }, [o.enabled, choice, tracks, o.prefs.subtitleMode, o.prefs.subtitleLang, o.prefs.subtitleLang2, o.prefs.subtitleSdh, o.original]);

  useEffect(() => {
    setCues(null); setError(null);
    if (!track) return;
    let live = true;
    loadCues(track).then((c) => { if (live) setCues(c); }, (e: Error) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [track]);
  useEffect(() => { setOffset(0); }, [track?.id]);

  return {
    tracks, track, cues, error, offset, clock, choice,
    loading: list.isLoading || (Boolean(track) && !cues && !error),
    failed: Boolean(list.error),
    choose: (t: SubtitleTrack | "off") => setChoice(t === "off" ? "off" : { lang: t.language, sdh: t.hearingImpaired, id: t.id }),
    nudge: (by: number) => setOffset((v) => Math.max(-30, Math.min(30, Math.round((v + by) * 10) / 10))),
    resetOffset: () => setOffset(0)
  };
}

export type Captions = ReturnType<typeof useCaptions>;
