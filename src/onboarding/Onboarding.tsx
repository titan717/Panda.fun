import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BRAND } from "../lib/brand";
import { Avatar } from "../components/ui";
import { Icon, PandaMark } from "../components/Icon";
import { actions, getState, useProfile, useStore, type AvatarKind, type Profile } from "../lib/store";
import { focusFirst, useBackHandler } from "../lib/focus";
import { useIsTv } from "../lib/layout";
import { useNav } from "../lib/nav";
import { useIntroPhase } from "../lib/launch";
import { useReducedMotion, useTrending } from "../lib/hooks";
import { unlockAudio } from "../lib/audio";
import {
  defaultTaste, getDraft, getTaste, markOnboardingSeen, markWelcomed, saveDraft, saveTaste, TASTE_GENRES,
  type OnboardingStep, type TasteGenre, type TasteProfile
} from "../lib/tasteProfile";
import "./onboarding.css";

/**
 * v1.4.0 onboarding: Duolingo-style, mascot-led, no account. Welcome → Who's watching → genres → movies/shows →
 * quick taste questions → ready → Home. Every step can go back or skip; answers save per profile as you go, so a
 * restart resumes. `revisit` (Settings › Personalize recommendations) starts at genres with the saved answers.
 */

type Mood = "wave" | "happy" | "think" | "cheer";

const GENRE_ART: Record<TasteGenre, [string, string]> = {
  Action: ["#ff4d2e", "#7a1020"], Adventure: ["#f2a93b", "#6b3a0c"], Comedy: ["#ffd23f", "#c2187a"], Drama: ["#8b2cff", "#2a0d55"],
  Thriller: ["#3a4bff", "#0b0f3a"], Horror: ["#9a0f2e", "#120207"], "Science Fiction": ["#22d3ee", "#1b2a8f"], Fantasy: ["#d42cff", "#3b0a63"],
  Romance: ["#ff5fa2", "#7a1446"], Animation: ["#5bffb0", "#1c6bd6"], Documentary: ["#c9b28a", "#3b3326"], Mystery: ["#6d5bff", "#120d33"], Crime: ["#9aa4b8", "#1a1d26"]
};
/** TMDB TV genres that cover two of ours. */
const TV_GENRES: Record<string, TasteGenre[]> = { "Action & Adventure": ["Action", "Adventure"], "Sci-Fi & Fantasy": ["Science Fiction", "Fantasy"] };

type Choice<T extends string> = { id: T; label: string };
const QUESTIONS: { key: "popularity" | "era" | "length" | "pace"; title: string; options: Choice<string>[] }[] = [
  { key: "popularity", title: "Big hits or hidden gems?", options: [{ id: "popular", label: "Popular hits" }, { id: "gems", label: "Hidden gems" }, { id: "mix", label: "A bit of both" }] },
  { key: "era", title: "New releases or classics?", options: [{ id: "new", label: "Newer" }, { id: "classic", label: "Classics" }, { id: "mix", label: "Either" }] },
  { key: "length", title: "How long is movie night?", options: [{ id: "short", label: "Short & sweet" }, { id: "long", label: "Long & epic" }, { id: "mix", label: "Depends" }] },
  { key: "pace", title: "What pace do you like?", options: [{ id: "fast", label: "Fast-paced" }, { id: "slow", label: "Slow-burn" }, { id: "mix", label: "Both" }] }
];
const TYPES: { id: TasteProfile["contentType"]; label: string; sub: string; icon: "movie" | "tv" | "grid" }[] = [
  { id: "movie", label: "Movies", sub: "One great story at a time", icon: "movie" },
  { id: "tv", label: "TV shows", sub: "Binge-worthy series", icon: "tv" },
  { id: "both", label: "Both", sub: "Surprise me", icon: "grid" }
];
const AVATARS: AvatarKind[] = ["smile", "panda", "star", "wave"];

function Mascot({ mood, bump, text }: { mood: Mood; bump: number; text: ReactNode }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`ob-mascot ob-mascot--${mood}`}>
      <div className="ob-bubble" role="status" aria-live="polite" key={`b${bump}`}>{text}</div>
      <div className="ob-mascot-body" key={`m${bump}`} aria-hidden="true">
        {failed ? <PandaMark size="100%" /> : <img src={BRAND.mascot} alt="" draggable={false} onError={() => setFailed(true)} />}
      </div>
    </div>
  );
}

function useGenreArt() {
  const { data } = useTrending("all", "week");
  return useMemo(() => {
    const art: Partial<Record<TasteGenre, string>> = {};
    const used = new Set<string>();
    for (const it of data?.results ?? []) {
      const img = it.backdrop;
      if (!img || used.has(img)) continue;
      for (const g of it.genres ?? []) {
        for (const name of TV_GENRES[g] ?? [g]) {
          const k = name as TasteGenre;
          if ((TASTE_GENRES as readonly string[]).includes(k) && !art[k]) { art[k] = img; used.add(img); break; }
        }
        if (used.has(img)) break;
      }
    }
    return art;
  }, [data]);
}

function GenreCard({ g, on, art, onToggle }: { g: TasteGenre; on: boolean; art?: string; onToggle: () => void }) {
  const [a, b] = GENRE_ART[g];
  const [loaded, setLoaded] = useState(false);
  return (
    <button type="button" className={`ob-genre${on ? " is-on" : ""}`} aria-pressed={on} onClick={onToggle} data-hover-focus
      style={{ ["--g1" as string]: a, ["--g2" as string]: b }}>
      {art && <img className={`ob-genre-art${loaded ? " is-loaded" : ""}`} src={art} alt="" loading="lazy" decoding="async" onLoad={() => setLoaded(true)} onError={() => setLoaded(false)} />}
      <span className="ob-genre-name">{g === "Science Fiction" ? "Sci-fi" : g}</span>
      <span className="ob-genre-check" aria-hidden="true"><Icon name="check" /></span>
    </button>
  );
}

function WhoStep({ onPicked }: { onPicked: (p: Profile) => void }) {
  const profiles = useStore((s) => s.profiles);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<AvatarKind>("smile");
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { if (root.current) focusFirst(root.current); }, [adding]);
  useBackHandler(() => { setAdding(false); }, adding);
  if (adding) {
    return (
      <div ref={root} className="ob-who-add">
        <label className="ob-label" htmlFor="ob-name">Your name</label>
        <input id="ob-name" className="ob-input" value={name} maxLength={20} autoComplete="off" placeholder="e.g. Sam" onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (document.getElementById("ob-create") as HTMLButtonElement | null)?.click(); } }} data-autofocus />
        <div className="ob-avatars" role="group" aria-label="Choose an avatar">
          {AVATARS.map((k) => (
            <button key={k} type="button" className={`ob-avatar${avatar === k ? " is-on" : ""}`} aria-pressed={avatar === k} aria-label={`Avatar ${k}`} onClick={() => setAvatar(k)} data-hover-focus><Avatar kind={k} /></button>
          ))}
        </div>
        <div className="ob-row">
          <button type="button" className="ob-btn ob-btn--ghost" onClick={() => setAdding(false)} data-hover-focus>Cancel</button>
          <button id="ob-create" type="button" className="ob-btn" onClick={() => { const p = actions.addProfile(name || "Viewer", avatar, false); onPicked(p); }} data-hover-focus>Create profile</button>
        </div>
      </div>
    );
  }
  return (
    <div ref={root} className="ob-who">
      <ul className="ob-profiles">
        {profiles.map((p) => (
          <li key={p.id}>
            <button type="button" className="ob-profile" onClick={() => onPicked(p)} data-hover-focus>
              <Avatar kind={p.avatar} /><span className="ob-profile-name">{p.name}</span>
            </button>
          </li>
        ))}
        {profiles.length < 6 && (
          <li>
            <button type="button" className="ob-profile" onClick={() => setAdding(true)} data-hover-focus aria-label="Add profile">
              <span className="avatar avatar--add"><Icon name="plus" /></span><span className="ob-profile-name">Add</span>
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}

function Chips<T extends string>({ title, options, value, onPick }: { title: string; options: Choice<T>[]; value: T; onPick: (v: T) => void }) {
  return (
    <fieldset className="ob-q">
      <legend className="ob-q-title">{title}</legend>
      <div className="ob-chips">
        {options.map((o) => (
          <button key={o.id} type="button" className={`ob-chip${value === o.id ? " is-on" : ""}`} aria-pressed={value === o.id} onClick={() => onPick(o.id)} data-hover-focus>{o.label}</button>
        ))}
      </div>
    </fieldset>
  );
}

const BUBBLE_GENRES = (n: number) => (n === 0 ? "What do you love to watch? Pick as many as you like." : n < 3 ? "Ooh, nice pick! Any more?" : "Now we're talking. Great taste!");

export function Onboarding({ revisit = false }: { revisit?: boolean }) {
  const profile = useProfile();
  const tv = useIsTv();
  const reduce = useReducedMotion();
  const { go, back: navBack } = useNav();
  const intro = useIntroPhase();
  const pid = profile?.id ?? null;

  // the steps of this run: Welcome only on the automatic run, Who's watching only without a profile
  const steps = useMemo<OnboardingStep[]>(() => {
    const s: OnboardingStep[] = [];
    if (!revisit) s.push("welcome");
    if (!revisit && !pid) s.push("who");
    s.push("genres", "type", "taste", "ready");
    return s;
    // fixed at mount: picking a profile in "who" must not remove the step we are on
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [step, setStep] = useState<OnboardingStep>(() => {
    const d = revisit ? null : getDraft(pid);
    return d && steps.includes(d.step) ? d.step : steps[0]!;
  });
  const [taste, setTaste] = useState<TasteProfile>(() => (revisit ? getTaste(pid) : getDraft(pid)?.taste) ?? defaultTaste());
  const [bump, setBump] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const root = useRef<HTMLDivElement>(null);
  const i = steps.indexOf(step);

  // persist progress per profile (not in revisit mode, where Back must leave the saved answers untouched)
  useEffect(() => { if (pid && !revisit && step !== "welcome" && step !== "who") saveDraft(pid, { step, taste }); }, [pid, revisit, step, taste]);
  useEffect(() => { if (root.current && intro !== "show") focusFirst(root.current.querySelector(".ob-body") ?? root.current); }, [step, intro]);

  const react = () => setBump((n) => n + 1);
  const to = (s: OnboardingStep, d: 1 | -1 = 1) => { setDir(d); setStep(s); react(); };
  const next = () => { const n = steps[i + 1]; if (n) to(n); };
  const back = () => { const p = steps[i - 1]; if (!p) return false; to(p, -1); return true; };
  const patch = (p: Partial<TasteProfile>) => { setTaste((t) => ({ ...t, ...p })); react(); };

  const leave = () => {
    if (revisit) navBack("/settings");
    else go("/", { replace: true });
  };
  const finish = () => {
    if (pid) saveTaste(pid, { ...taste, completedAt: Date.now(), skipped: false });
    markWelcomed();
    leave();
  };
  const skip = () => {
    if (revisit) { leave(); return; }
    const id = getState().activeProfileId;
    if (id) saveTaste(id, { ...taste, completedAt: null, skipped: true });
    else markOnboardingSeen(getState().profiles.map((p) => p.id)); // skipped before choosing: no profile is asked again on its own
    markWelcomed();
    leave();
  };
  const picked = (p: Profile) => {
    unlockAudio();
    actions.selectProfile(p.id);
    if (p.kids) { markOnboardingSeen([p.id]); markWelcomed(); go("/", { replace: true }); return; }
    const t = getTaste(p.id);
    if (t) { markWelcomed(); go("/", { replace: true }); return; } // this profile already answered
    next();
  };

  // Back: previous step; on the first step of a revisit it closes, on Welcome it falls through to the app (exit)
  useBackHandler(() => { if (revisit && i === 0) { leave(); return true; } return back(); });

  const name = profile?.name && profile.name !== "You" ? profile.name : null;
  let mood: Mood = "happy";
  let bubble: ReactNode;
  let title: string;
  let sub: string | null = null;
  let body: ReactNode;
  let cta: ReactNode = null;

  switch (step) {
    case "welcome":
      mood = "wave";
      bubble = <>Hey{name ? ` ${name}` : ""}! I'm Panda. Let's make your next movie night amazing.</>;
      title = "Welcome to Panda.fun";
      sub = "Answer a few quick questions and Home will be picked just for you. No account needed.";
      body = null;
      cta = (
        <div className="ob-row">
          <button type="button" className="ob-btn" onClick={next} data-autofocus data-hover-focus>Let's go</button>
          <button type="button" className="ob-btn ob-btn--ghost" onClick={skip} data-hover-focus>Skip for now</button>
        </div>
      );
      break;
    case "who":
      mood = "happy";
      bubble = "First things first: who's on the couch?";
      title = "Who's watching?";
      body = <WhoStep onPicked={picked} />;
      break;
    case "genres":
      mood = taste.genres.length >= 3 ? "cheer" : taste.genres.length ? "happy" : "think";
      bubble = BUBBLE_GENRES(taste.genres.length);
      title = "Pick your favourite genres";
      sub = taste.genres.length ? `${taste.genres.length} selected` : "Choose at least one";
      body = (
        <div className="ob-genres">
          <GenreGrid taste={taste} onChange={(genres) => patch({ genres })} />
        </div>
      );
      cta = <button type="button" className="ob-btn" onClick={next} disabled={!taste.genres.length} data-hover-focus>Continue</button>;
      break;
    case "type":
      mood = "think";
      bubble = taste.contentType === "movie" ? "Popcorn time!" : taste.contentType === "tv" ? "One more episode? Always." : "Movies, shows, or both?";
      title = "What do you watch most?";
      body = (
        <div className="ob-types">
          {TYPES.map((t) => (
            <button key={t.id} type="button" className={`ob-type${taste.contentType === t.id ? " is-on" : ""}`} aria-pressed={taste.contentType === t.id}
              onClick={() => { patch({ contentType: t.id }); }} data-hover-focus data-autofocus={taste.contentType === t.id ? true : undefined}>
              <Icon name={t.icon} /><span className="ob-type-label">{t.label}</span><span className="ob-type-sub">{t.sub}</span>
            </button>
          ))}
        </div>
      );
      cta = <button type="button" className="ob-btn" onClick={next} data-hover-focus>Continue</button>;
      break;
    case "taste":
      mood = "think";
      bubble = "Last bit, quick taps. Skip any you like.";
      title = "A few quick questions";
      body = (
        <div className="ob-questions">
          {QUESTIONS.map((q) => <Chips key={q.key} title={q.title} options={q.options} value={taste[q.key]} onPick={(v) => patch({ [q.key]: v } as Partial<TasteProfile>)} />)}
        </div>
      );
      cta = (
        <div className="ob-row">
          <button type="button" className="ob-btn" onClick={next} data-hover-focus>Continue</button>
          <button type="button" className="ob-btn ob-btn--ghost" onClick={next} data-hover-focus>Skip questions</button>
        </div>
      );
      break;
    case "ready":
    default:
      mood = "cheer";
      bubble = "Your picks are in. Let's watch something great!";
      title = "Your Panda experience is ready!";
      sub = "Recommendations get smarter as you watch, rate and add titles to your list. Change your answers any time in Settings.";
      body = null;
      cta = <button type="button" className="ob-btn" onClick={finish} data-autofocus data-hover-focus>{revisit ? "Save" : "Start watching"}</button>;
      break;
  }

  const showDots = steps.length > 2;
  return (
    <div ref={root} className={`ob ob--${tv ? "tv" : "m"} ob--${step}${intro === "show" ? " is-waiting" : ""}${reduce ? " is-still" : ""}`} data-step={step}>
      <div className="ob-bg" aria-hidden="true" />
      <header className="ob-top">
        {i > 0 ? (
          <button type="button" className="ob-icon-btn" onClick={() => back()} aria-label="Back" data-hover-focus><Icon name="chevronLeft" /></button>
        ) : revisit ? (
          <button type="button" className="ob-icon-btn" onClick={leave} aria-label="Close" data-hover-focus><Icon name="close" /></button>
        ) : <span className="ob-icon-spacer" />}
        {showDots && (
          <ol className="ob-dots" aria-label={`Step ${i + 1} of ${steps.length}`}>
            {steps.map((s, n) => <li key={s} className={n === i ? "is-now" : n < i ? "is-done" : ""} />)}
          </ol>
        )}
        {step !== "ready" && step !== "welcome" ? <button type="button" className="ob-skip" onClick={skip} data-hover-focus>{revisit ? "Cancel" : "Skip"}</button> : <span className="ob-icon-spacer" />}
      </header>
      <div className="ob-stage">
        <Mascot mood={mood} bump={bump} text={bubble} />
        <section className={`ob-body ob-body--${dir > 0 ? "fwd" : "back"}`} key={step} aria-labelledby="ob-title">
          <h1 id="ob-title" className="ob-title">{title}</h1>
          {sub && <p className="ob-sub">{sub}</p>}
          {body}
          {cta && <div className="ob-cta">{cta}</div>}
        </section>
      </div>
    </div>
  );
}

function GenreGrid({ taste, onChange }: { taste: TasteProfile; onChange: (g: string[]) => void }) {
  const art = useGenreArt();
  return (
    <div className="ob-genre-grid lrud-container" role="group" aria-label="Genres">
      {TASTE_GENRES.map((g) => {
        const on = taste.genres.includes(g);
        return <GenreCard key={g} g={g} on={on} art={art[g]} onToggle={() => onChange(on ? taste.genres.filter((x) => x !== g) : [...taste.genres, g])} />;
      })}
    </div>
  );
}
