import { Link } from "wouter";
import { toast } from "./ui";
import { useNav } from "../lib/nav";
import { useIntel } from "../lib/intel/runtime";
import { pickSurprise, surprisePath } from "../lib/intel/surprise";
import { useHiddenRecoIds } from "../lib/reco/useHidden";
import { useHistoryMap, useWatchlist } from "../lib/store";
import { parseIntent } from "../lib/intel/intent";
import { useIsTv } from "../lib/layout";
import { useProfile } from "../lib/store";
import { MOODS, MOOD_BY_ID, moodHref, parseMood, sessionLabel, sessionMoods } from "../lib/intel/moods";

/**
 * v1.5.0 mood discovery on Search. Before typing: every mood, the ones that suit the local time first. While typing
 * a mood ("something scary"): one chip that opens that mood. Each chip opens a real API browse grid; no titles are
 * made up and nothing about the profile is sent with the request.
 */
export function MoodChips({ query }: { query?: string }) {
  const tv = useIsTv();
  const kids = Boolean(useProfile()?.kids);
  const chip = tv ? "tv-chip" : "m-chip";
  const intel = useIntel();
  const hidden = useHiddenRecoIds();
  const history = useHistoryMap();
  const watchlist = useWatchlist();
  const { go } = useNav();
  if (query !== undefined) {
    // typed requests are read on the device into real catalogue browses ("dark korean thrillers", "like Interstellar")
    const known = [...Object.values(history).map((h) => h.item), ...watchlist, ...Object.values(intel?.features ?? {})];
    const intent = parseIntent(query, { state: intel, known, kids });
    const m = parseMood(query);
    const moodOnly = Boolean(m) && intent.understood.length === 1;
    if (intent.chips.length && !moodOnly) {
      return (
        <section className={`${tv ? "tv-chips" : "m-chips"} mood-chips`} aria-label="Panda understood">
          {intent.chips.map((c) => <Link key={c.id} href={c.href} id={`mood-${c.id}`} className={`${chip} mood-chip`} data-hover-focus>{c.label}</Link>)}
        </section>
      );
    }
    if (!m || (kids && !m.kids)) return null;
    return (
      <section className={`${tv ? "tv-chips" : "m-chips"} mood-chips`} aria-label="Mood">
        <Link href={moodHref(m, "movie")} id="mood-hit-movie" className={`${chip} mood-chip`} data-hover-focus>{m.label} movies</Link>
        <Link href={moodHref(m, "tv")} id="mood-hit-tv" className={`${chip} mood-chip`} data-hover-focus>{m.label} shows</Link>
      </section>
    );
  }
  const now = new Date();
  const first = sessionMoods(now, kids);
  const all = [...first.map((id) => MOOD_BY_ID.get(id)!), ...MOODS.filter((m) => !first.includes(m.id))].filter((m) => !kids || m.kids);
  return (
    <section className={tv ? "tv-section mood-section" : "m-section mood-section"} aria-labelledby="mood-title">
      <h2 id="mood-title" className={tv ? "tv-section-title" : "m-row-title"}>In the mood for…</h2>
      <div className={`${tv ? "tv-chips" : "m-chips"} mood-chips`}>
        {all.map((m, i) => (
          <Link key={m.id} href={moodHref(m)} id={`mood-${m.id}`} className={`${chip} mood-chip ${i < first.length ? "is-suggested" : ""}`} data-hover-focus
            aria-label={i < first.length ? `${m.label}, suggested ${sessionLabel(now)}` : m.label}>{m.label}</Link>
        ))}
        {intel && (
          <button id="mood-surprise" className={`${chip} mood-chip mood-chip--surprise`} data-hover-focus onClick={() => {
            const f = pickSurprise(intel, { exclude: new Set([...hidden, ...Object.keys(history)]), kids });
            if (f) go(surprisePath(f)); else toast("Browse a few rows first, then Panda can surprise you");
          }}>Surprise me</button>
        )}
      </div>
    </section>
  );
}
