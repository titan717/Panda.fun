import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { PageHeader } from "../components/PageHeader";
import { BrandLogo } from "../components/Brand";
import { toast } from "../components/ui";
import { useIsTv } from "../lib/layout";
import { focusFirst } from "../lib/focus";
import { useProfile } from "../lib/store";
import { affinities, type LearnerState } from "../lib/intel/learner";
import { INTERACTION_WEIGHTS, type InteractionKind } from "../lib/intel/events";
import { forgetTitle, intelStatus, resetIntel, setOverride, useIntel } from "../lib/intel/runtime";
import "./settings.css";
import "./taste.css";

/**
 * v1.5.0 Taste DNA + Entertainment Memory (/taste-dna).
 *
 * Everything on this page is read from, and written to, this profile's on-device model (IndexedDB `panda-intel`).
 * Nothing here is uploaded. Taste DNA lists the strongest learned likes per kind (genres, languages, people,
 * franchises, eras) with More / Less to steer them; Entertainment Memory lists what Panda learned from, with Forget
 * per title and a reset for the whole model.
 */
const GROUPS: { id: string; title: string; prefixes: string[] }[] = [
  { id: "genres", title: "Genres", prefixes: ["g:"] },
  { id: "languages", title: "Languages", prefixes: ["l:"] },
  { id: "people", title: "Directors, creators and cast", prefixes: ["d:", "cr:", "c:"] },
  { id: "franchises", title: "Franchises", prefixes: ["col:"] },
  { id: "eras", title: "Eras", prefixes: ["e:"] }
];

const KIND_TEXT: Record<InteractionKind, string> = {
  complete: "Finished", episode: "Finished an episode", binge: "Watched several episodes in a day", progress: "Watched a good part",
  sample: "Tried briefly", abandon: "Left early and did not come back", rewatch: "Watched again", love: "Loved", like: "Liked",
  dislike: "Not for me", save: "Added to My List", more: "Asked for more like this", "not-interested": "Not interested",
  hide: "Hidden from rows", watched: "Marked as watched", open: "Opened", play: "Started playing", skip: "Scrolled past a few times",
  "playback-failed": "Did not play"
};

const when = (at: number) => {
  const d = Math.round((Date.now() - at) / 86_400_000);
  return d <= 0 ? "Today" : d === 1 ? "Yesterday" : d < 30 ? `${d} days ago` : new Date(at).toLocaleDateString();
};

export function tasteGroups(s: LearnerState) {
  const all = affinities(s);
  return GROUPS.map((g) => ({
    ...g,
    items: all.filter((a) => g.prefixes.some((p) => a.key.startsWith(p)) && (a.score > 0.02 || s.overrides[a.key])).slice(0, 8)
  })).filter((g) => g.items.length);
}

export function memoryEntries(s: LearnerState, max = 40) {
  const seen = new Set<string>();
  const out: { id: string; title: string; kind: InteractionKind; at: number; counts: boolean }[] = [];
  for (let i = s.log.length - 1; i >= 0 && out.length < max; i--) {
    const e = s.log[i]!;
    if (seen.has(e.id) || s.forgotten[e.id]) continue;
    seen.add(e.id);
    out.push({ id: e.id, title: s.features[e.id]?.title ?? e.id, kind: e.kind, at: e.at, counts: INTERACTION_WEIGHTS[e.kind] !== 0 });
  }
  return out;
}

export function TasteDnaPage() {
  const tv = useIsTv();
  const profile = useProfile();
  const s = useIntel();
  const root = useRef<HTMLDivElement>(null);
  const [confirm, setConfirm] = useState(false);
  const groups = useMemo(() => (s ? tasteGroups(s) : []), [s, s?.updatedAt, s?.n, JSON.stringify(s?.overrides ?? {})]); // eslint-disable-line react-hooks/exhaustive-deps
  const memory = useMemo(() => (s ? memoryEntries(s) : []), [s, s?.log.length, s?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const ready = Boolean(s);
  useEffect(() => { if (tv && root.current) focusFirst(root.current); }, [tv, ready]);
  useEffect(() => { if (!confirm) return; const t = setTimeout(() => setConfirm(false), 6000); return () => clearTimeout(t); }, [confirm]);

  const status = intelStatus();
  const learned = s ? s.log.filter((e) => INTERACTION_WEIGHTS[e.kind] !== 0 && !s.forgotten[e.id]).length : 0;

  return (
    <div ref={root} className={tv ? "tv-page tv-settings-page taste-page is-tv" : "m-page taste-page"} data-scroll-y={tv ? "nearest" : undefined}>
      <PageHeader title="Taste DNA" sub={profile ? `What Panda learned for ${profile.name}` : undefined} fallback="/settings/profiles" />
      <section className="taste-intro">
        <BrandLogo variant="mark" width={tv ? 64 : 44} height={tv ? 64 : 44} alt="" />
        <p>
          {!s ? (status === "loading" ? "Loading this profile's model…" : "Panda Intelligence is not available in this browser (it needs IndexedDB).")
            : learned ? `Learned on this device from ${learned} things you watched, rated or saved. It is stored only on this device, for this profile, and is never uploaded.`
              : "Nothing learned yet. Watch, rate or save a few titles and your Taste DNA appears here. It is stored only on this device and is never uploaded."}
        </p>
      </section>

      {groups.map((g) => (
        <section key={g.id} className="taste-group" aria-labelledby={`taste-${g.id}`}>
          <h2 id={`taste-${g.id}`} className="set-group-title">{g.title}</h2>
          <ul className="taste-list">
            {g.items.map((a) => {
              const o = s?.overrides[a.key];
              const pct = Math.max(6, Math.min(100, Math.round(Math.tanh(Math.max(0, a.score)) * 100)));
              return (
                <li key={a.key} className="taste-item">
                  <span className="taste-name">{a.name}<span className="taste-via">{a.titles.length ? `From ${a.titles.join(", ")}` : ""}</span></span>
                  <span className="taste-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
                  <span className="taste-actions">
                    <button className={`taste-btn ${o === 1 ? "is-on" : ""}`} aria-pressed={o === 1} data-hover-focus onClick={() => setOverride(a.key, o === 1 ? null : 1)}>More</button>
                    <button className={`taste-btn ${o === -1 ? "is-on" : ""}`} aria-pressed={o === -1} data-hover-focus onClick={() => setOverride(a.key, o === -1 ? null : -1)}>Less</button>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section className="taste-group" aria-labelledby="taste-memory">
        <h2 id="taste-memory" className="set-group-title">Entertainment Memory</h2>
        <p className="set-note">What Panda learned from, newest first. Forget a title and it is never used for recommendations again. Short tries, titles that did not play, and pauses are never counted against a title.</p>
        {memory.length === 0 && <p className="set-note">Nothing here yet.</p>}
        <ul className="taste-memory">
          {memory.map((m) => (
            <li key={m.id} className="taste-item">
              <span className="taste-name">{m.title}<span className="taste-via">{KIND_TEXT[m.kind]} · {when(m.at)}{m.counts ? "" : " · not used for taste"}</span></span>
              <span className="taste-actions">
                <button className="taste-btn" data-hover-focus onClick={() => { forgetTitle(m.id); toast(`Panda forgot ${m.title}`); }}>Forget</button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="taste-group">
        <button className={`set-row taste-reset ${confirm ? "is-confirm" : ""}`} data-hover-focus disabled={!s}
          onClick={() => { if (!confirm) { setConfirm(true); return; } setConfirm(false); void resetIntel().then(() => toast("Panda's learning was reset for this profile")); }}>
          <span className="set-row-text">
            <span className="set-row-title">{confirm ? "Press again to reset" : "Reset what Panda learned"}</span>
            <span className="set-row-sub">Starts this profile's model from scratch. Your history, My List and ratings stay.</span>
          </span>
        </button>
        <Link href="/personalize" className="set-row" data-hover-focus>
          <span className="set-row-text"><span className="set-row-title">Change your starting tastes</span><span className="set-row-sub">The genres and kinds of titles you picked when you set up this profile</span></span>
        </Link>
      </section>
    </div>
  );
}
