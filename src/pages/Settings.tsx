import "./settings.css";
import "../lib/validateLazy"; // validators for this page's payloads, loaded with the page
import { forgetIntros, SPEEDS, speedLabel, STILL_AFTER } from "../lib/player2";
import { nativePipSupported } from "../lib/pip";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "wouter";
import { useSWRConfig } from "swr";
import { clearPersistentCache } from "../lib/cache";
import { Icon, PandaMark, type IconName } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";
import { toast } from "../components/ui";
import { CaptionPreview } from "../components/CaptionLayer";
import { SUB_LANGS, SUB_MODES, SUB_SIZES, SUB_STYLES, subLangName } from "../lib/captions";
import { Sheet } from "../components/Sheet";
import { actions, usePrefs, useProfile, useReminders, type Prefs } from "../lib/store";
import { useGenres, usePage, useSourceHealth, useSourceRanking } from "../lib/hooks";
import { reliabilityLabel, reliabilityTone } from "../lib/sources";
import { HOME_SECTIONS, isCustomHome, moveSection, normalizeOrder, railKey, type HomeSection } from "../lib/homeLayout";
import { focusFirst } from "../lib/focus";
import { useNav } from "../lib/nav";
import { useIsTv } from "../lib/layout";
import { installedVersion } from "../lib/updates";
import { languageName } from "../lib/format";
import { notifyPermission, requestNotify } from "../lib/notify";
import type { PreferredSource, SourceId } from "../lib/types";
import { clearShield, COMPAT, nativeShield, SANDBOX, shieldStats, syncNative } from "../lib/shield";

type SectionId = "profiles" | "home" | "playback" | "trailers" | "subtitles" | "sources" | "languages" | "parental" | "display" | "storage" | "notifications" | "whatsnew" | "updates" | "help";
const SECTIONS: { id: SectionId; icon: IconName; title: string; sub: string }[] = [
  { id: "profiles", icon: "user", title: "Profiles & Account", sub: "Add, edit or switch profiles" },
  { id: "home", icon: "home", title: "Personalize Home", sub: "Reorder or hide rows on Home" },
  { id: "playback", icon: "play", title: "Playback", sub: "Quality and autoplay" },
  { id: "trailers", icon: "volume", title: "Trailers", sub: "Autoplay, sound, volume and delay" },
  { id: "subtitles", icon: "captions", title: "Subtitles", sub: "Languages, size and style for this profile" },
  { id: "sources", icon: "globe", title: "Sources", sub: "Preferred source and live status" },
  { id: "languages", icon: "globe", title: "App Language & Content Languages", sub: "Top 10 language and content preferences" },
  { id: "parental", icon: "lock", title: "Parental Controls", sub: "PIN for leaving Kids profiles" },
  { id: "display", icon: "tv", title: "Display", sub: "Layout, screen size, text, motion and contrast" },
  { id: "storage", icon: "file", title: "Data & Storage", sub: "Preloading, space used and clearing saved data" },
  { id: "notifications", icon: "bell", title: "Notifications", sub: "New episodes, premieres and reminders" },
  { id: "whatsnew", icon: "sparkle", title: "What's New", sub: "Highlights of this version" },
  { id: "updates", icon: "download", title: "Check for Updates", sub: "Get the newest version of the app" },
  { id: "help", icon: "info", title: "About", sub: "Version, privacy and terms" }
];

const SPEED_CHOICES = SPEEDS.map((r) => ({ id: String(r), label: speedLabel(r), note: r === 1 ? "Default" : undefined }));
const TRAILER_VOLUMES = ["25", "50", "80", "100"].map((id) => ({ id, label: `${id}%` }));
const TRAILER_DELAYS = [
  { id: "3", label: "3 seconds" }, { id: "5", label: "5 seconds", note: "Recommended" },
  { id: "8", label: "8 seconds" }, { id: "12", label: "12 seconds" }
];

export const SOURCES: { id: SourceId; label: string; note: string }[] = [
  { id: "cinesrc", label: "CineSrc", note: "Resume, progress sync and volume control" },
  { id: "vidy", label: "Vidy", note: "Backup source with resume and progress sync" },
  { id: "vidyanime", label: "Vidy Anime", note: "Anime from AniList's catalogue. Used for Japanese animation only" }
];

/** v1.2.0: "Automatic" starts with the source the community ranks most reliable. */
const SOURCE_CHOICES: { id: PreferredSource; label: string; note: string }[] = [
  { id: "auto", label: "Automatic", note: "Start with the source that is working best for Panda viewers right now" },
  ...SOURCES.filter((s) => s.id !== "vidyanime")
];

function Row({ id, title, sub, right, onClick, href }: { id: string; title: string; sub?: string; right?: ReactNode; onClick?: () => void; href?: string }) {
  const inner = <><span className="set-row-text"><span className="set-row-title">{title}</span>{sub && <span className="set-row-sub">{sub}</span>}</span>{right ?? <Icon name="chevronRight" />}</>;
  return href
    ? <Link href={href} id={id} className="set-row" data-hover-focus>{inner}</Link>
    : <button id={id} className="set-row" onClick={onClick} data-hover-focus>{inner}</button>;
}

const PRELOAD_CHOICES: { id: "smart" | "wifi" | "off"; label: string; note: string }[] = [
  { id: "smart", label: "Smart", note: "Load what you are about to open. Pauses on Data Saver and slow connections" },
  { id: "wifi", label: "Wi-Fi only", note: "Never preload on mobile data" },
  { id: "off", label: "Off", note: "Load only what you open" }
];

const PIP = nativePipSupported();

function Toggle({ id, title, sub, value, onChange }: { id: string; title: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button id={id} role="switch" aria-checked={value} className="set-row" onClick={() => onChange(!value)} data-hover-focus>
      <span className="set-row-text"><span className="set-row-title">{title}</span>{sub && <span className="set-row-sub">{sub}</span>}</span>
      <span className={`toggle ${value ? "is-on" : ""}`} aria-hidden="true" />
    </button>
  );
}

/** Many short options (languages) as a wrapping grid of chips (v1.2.1). */
function ChipChoice({ id, title, value, options, onChange }: { id: string; title: string; value: string; options: { id: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="set-choice" role="radiogroup" aria-label={title}>
      <p className="set-group-title">{title}</p>
      <div className="lrud-container set-chips">
        {options.map((o) => (
          <button key={o.id} id={`${id}-${o.id}`} role="radio" aria-checked={value === o.id} className={`set-chip ${value === o.id ? "is-selected" : ""}`} onClick={() => onChange(o.id)} data-hover-focus>{o.label}</button>
        ))}
      </div>
    </div>
  );
}

function Choice<T extends string>({ id, title, value, options, onChange }: { id: string; title: string; value: T; options: { id: T; label: string; note?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="set-choice" role="radiogroup" aria-label={title}>
      <p className="set-group-title">{title}</p>
      <div className="lrud-container set-choice-list">
        {options.map((o) => (
          <button key={o.id} id={`${id}-${o.id}`} role="radio" aria-checked={value === o.id} className={`set-row ${value === o.id ? "is-selected" : ""}`} onClick={() => onChange(o.id)} data-hover-focus>
            <span className="set-row-text"><span className="set-row-title">{o.label}</span>{o.note && <span className="set-row-sub">{o.note}</span>}</span>
            <span className={`radio ${value === o.id ? "is-on" : ""}`} aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}

const QUALITIES: { id: Prefs["quality"]; label: string; note?: string }[] = [
  { id: "auto", label: "Automatic", note: "Best for your connection" }, { id: "2160", label: "4K" }, { id: "1080", label: "1080p" }, { id: "720", label: "720p", note: "Saves data" }, { id: "480", label: "480p", note: "Slow connections" }
];

function ago(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  return s < 60 ? `${s} s ago` : `${Math.round(s / 60)} min ago`;
}

/** Settings › Sources (G-7): preferred source plus the backend's live health check. */
function SourcesPanel() {
  const prefs = usePrefs();
  const health = useSourceHealth();
  return (
    <div className="set-panel">
      <Choice id="src" title="Preferred video source" value={prefs.preferredSource === "vidyanime" ? "auto" : prefs.preferredSource} options={SOURCE_CHOICES}
        onChange={(v) => { actions.setPrefs({ preferredSource: v }); toast(`Preferred source: ${SOURCE_CHOICES.find((s) => s.id === v)!.label}`); }} />
      <RankingList />
      <p className="set-group-title">Status</p>
      <ul className="src-health" aria-live="polite">
        {health.error && !health.data && <li className="src-health-row"><span className="src-dot src-dot--down" />Status unavailable right now</li>}
        {!health.data && !health.error && <li className="src-health-row"><span className="src-dot" />Checking sources…</li>}
        {health.data?.sources.map((h) => (
          <li key={h.id} className="src-health-row">
            <span className={`src-dot src-dot--${h.state}`} aria-hidden="true" />
            <span className="src-health-name">{h.label}</span>
            <span className="src-health-meta">{h.state === "healthy" ? "Working" : h.state === "degraded" ? "Slow" : "Not responding"}{h.latencyMs != null ? ` · ${h.latencyMs} ms` : ""} · checked {ago(h.checkedAt)}</span>
          </li>
        ))}
      </ul>
      <button id="sp-src-refresh" className="set-row" data-hover-focus onClick={() => void health.mutate()}>
        <span className="set-row-text"><span className="set-row-title">Check again</span></span><Icon name="refresh" />
      </button>
      <ShieldInfo />
    </div>
  );
}

/** Community ranking (v1.2.0): the order "Automatic" plays in, with each source's reliability. */
function RankingList() {
  const { data, error } = useSourceRanking(true);
  return (
    <>
      <p className="set-group-title">Community ranking</p>
      <ol className="src-health src-rank" id="sp-ranking" aria-live="polite">
        {error && !data && <li className="src-health-row"><span className="src-dot src-dot--down" />Ranking unavailable right now</li>}
        {!data && !error && <li className="src-health-row"><span className="src-dot" />Loading the ranking…</li>}
        {data?.sources.map((r) => {
          const pct = Math.round(r.score * 100);
          return (
            <li key={r.id} className="src-health-row src-rank-row" id={`sp-rank-${r.id}`}>
              <span className="src-rank-n" aria-hidden="true">{r.rank}</span>
              <span className="src-health-name">{SOURCES.find((s) => s.id === r.id)?.label ?? r.id}</span>
              <span className="src-rank-bar" aria-hidden="true"><span style={{ width: `${Math.max(4, pct)}%` }} className={`src-rank-fill src-rel--${reliabilityTone(r)}`} /></span>
              <span className="src-health-meta">{(() => { const l = reliabilityLabel(r) ?? "No reports yet"; return r.reports24h > 0 && !l.startsWith("Reported") ? `${l} · ${r.reports24h} ${r.reports24h === 1 ? "report" : "reports"} today` : l; })()}</span>
            </li>
          );
        })}
      </ol>
      <p className="set-note">Ranked by the Wilson score of plays that started against reports, from every Panda viewer, with older results fading over {data?.halfLifeHours ?? 72} hours. Only the source, the title id and the issue are sent.</p>
    </>
  );
}

/** Ad shield (docs/AD_SHIELD.md, layer 8): read-only counters and the sandbox mode of each source. */
function ShieldInfo() {
  const [stats, setStats] = useState(() => { syncNative(); return shieldStats(); });
  const total = stats.popups + stats.navigations;
  return (
    <>
      <p className="set-group-title">Ad shield</p>
      <ul className="src-health" id="sp-shield">
        <li className="src-health-row"><Icon name="shield" />
          <span className="src-health-name">Blocked popups</span>
          <span className="src-health-meta" id="sp-shield-count">{stats.popups} popups · {stats.navigations} redirects and app launches{nativeShield ? ` · ${stats.requests} ad requests` : ""}</span>
        </li>
        {SOURCES.map((s) => {
          const b = stats.by[s.id];
          const n = b ? b.popup + b.navigation + b.external + b.download : 0;
          return (
            <li key={s.id} className="src-health-row">
              <span className={`src-dot src-dot--${SANDBOX[s.id].id === "strict" ? "healthy" : "degraded"}`} aria-hidden="true" />
              <span className="src-health-name">{s.label}</span>
              <span className="src-health-meta">{SANDBOX[s.id].label}{COMPAT[s.id] && nativeShield ? " · popups blocked by the app" : ""} · {n} blocked</span>
            </li>
          );
        })}
      </ul>
      <p className="set-note">Panda stops popups, new tabs, redirects and app launches from video sources. Ads a provider draws inside its own video cannot be removed. Only the source and blocked host are counted, on this device.</p>
      {total > 0 && <Row id="sp-shield-clear" title="Reset counters" onClick={() => { clearShield(); setStats(shieldStats()); toast("Ad shield counters reset"); }} right={<Icon name="refresh" />} />}
    </>
  );
}

function fmtBytes(n: number) {
  return n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`;
}

function StorageUsage() {
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);
  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => setUsage({ used: e.usage ?? 0, quota: e.quota ?? 0 })).catch(() => {});
  }, []);
  if (!usage) return null;
  return <p className="set-note">Panda.fun is using {fmtBytes(usage.used)} on this device{usage.quota ? ` of ${fmtBytes(usage.quota)} available` : ""}.</p>;
}

function PinSetup({ onClose }: { onClose: () => void }) {
  const [pin, setPin] = useState("");
  return (
    <Sheet title="Set Parental Controls PIN" onClose={onClose}>
      <p className="sheet-sub">You'll need this PIN to switch from a Kids profile to another profile.</p>
      <input className="pin-input" inputMode="numeric" maxLength={4} type="password" aria-label="New PIN" value={pin} data-autofocus autoFocus
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} />
      <div className="form-actions lrud-container">
        <button className="btn btn--primary" disabled={pin.length !== 4} onClick={() => { actions.setPrefs({ kidsPin: pin }); toast("PIN saved"); onClose(); }}>Save PIN</button>
        <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  );
}

/** Settings › Personalize Home (v1.1.9, D-110): move sections up or down, hide sections or single rows. */
function HomePanel() {
  const prefs = usePrefs();
  const profile = useProfile();
  const page = usePage("home");
  const order = normalizeOrder(prefs.homeOrder);
  const hidden = new Set(prefs.homeHidden);
  const byId = new Map(HOME_SECTIONS.map((s) => [s.id, s]));
  const [moved, setMoved] = useState<{ id: HomeSection; n: number } | null>(null);
  const setHidden = (key: string, off: boolean) => actions.setPrefs({ homeHidden: off ? [...hidden, key] : [...hidden].filter((k) => k !== key) });
  const move = (id: HomeSection, dir: -1 | 1) => {
    actions.setPrefs({ homeOrder: moveSection(prefs.homeOrder, id, dir) });
    setMoved((m) => ({ id, n: (m?.n ?? 0) + 1 }));
    const name = byId.get(id)!.title;
    requestAnimationFrame(() => {
      // keep focus on the same arrow so a section can be pushed several places in a row; at the end, hop to the other arrow
      const el = document.getElementById(`hp-${id}-${dir < 0 ? "up" : "down"}`) as HTMLButtonElement | null;
      if (el && !el.disabled) el.focus(); else document.getElementById(`hp-${id}-${dir < 0 ? "down" : "up"}`)?.focus();
    });
    toast(`${name} moved ${dir < 0 ? "up" : "down"}`);
  };
  if (profile?.kids) return <div className="set-panel"><p className="set-note">Kids profiles get a Home made for kids. Switch to a grown-up profile to personalize Home.</p></div>;
  return (
    <div className="set-panel set-home">
      <p className="set-group-title">Sections, top to bottom</p>
      <ol className="set-home-list">
        {order.map((id, i) => {
          const s = byId.get(id)!;
          const on = !hidden.has(id);
          return (
            <li key={moved?.id === id ? `${id}-${moved.n}` : id} className={`set-home-item lrud-container ${on ? "" : "is-off"} ${moved?.id === id ? "is-moved" : ""}`} data-home-section={id}>
              <span className="set-home-pos" aria-hidden="true">{i + 1}</span>
              <button id={`hp-${id}`} role="switch" aria-checked={on} className="set-row set-home-toggle" onClick={() => setHidden(id, on)} data-hover-focus>
                <span className="set-row-text"><span className="set-row-title">{s.title}</span><span className="set-row-sub">{on ? s.sub : "Hidden from Home"}</span></span>
                <span className={`toggle ${on ? "is-on" : ""}`} aria-hidden="true" />
              </button>
              <button id={`hp-${id}-up`} className="icon-btn set-home-move" aria-label={`Move ${s.title} up`} disabled={i === 0} onClick={() => move(id, -1)} data-hover-focus><Icon name="chevronUp" /></button>
              <button id={`hp-${id}-down`} className="icon-btn set-home-move" aria-label={`Move ${s.title} down`} disabled={i === order.length - 1} onClick={() => move(id, 1)} data-hover-focus><Icon name="chevronDown" /></button>
            </li>
          );
        })}
      </ol>
      {!hidden.has("rails") && (page.data?.rails.length ?? 0) > 0 && (
        <>
          <p className="set-group-title">Panda's rows</p>
          <div className="lrud-container set-choice-list set-home-rails">
            {page.data!.rails.map((r) => (
              <Toggle key={r.id} id={`hp-rail-${r.id}`} title={r.title} value={!hidden.has(railKey(r.id))} onChange={(v) => setHidden(railKey(r.id), !v)} />
            ))}
          </div>
        </>
      )}
      {isCustomHome(prefs.homeOrder, prefs.homeHidden) && (
        <Row id="hp-reset" title="Reset Home" sub="Bring back every row in the original order" right={<Icon name="refresh" />}
          onClick={() => { actions.setPrefs({ homeOrder: [], homeHidden: [] }); toast("Home reset"); }} />
      )}
      <p className="set-note">Changes apply to {profile?.name ?? "this profile"} only. Titles in hidden rows can still be found in Search. Hiding Continue Watching hides it on Movies and TV Shows too.</p>
    </div>
  );
}

function NotificationsPanel() {
  const prefs = usePrefs();
  const reminders = useReminders();
  const [perm, setPerm] = useState(notifyPermission);
  const on = prefs.notifications && perm === "granted";
  const toggle = async (v: boolean) => {
    if (!v) { actions.setPrefs({ notifications: false }); toast("Notifications turned off"); return; }
    const p = perm === "granted" ? perm : await requestNotify();
    setPerm(p);
    actions.setPrefs({ notifications: p === "granted" });
    toast(p === "granted" ? "We'll let you know when new episodes land" : p === "unsupported" ? "This device can't show notifications" : "Notifications are blocked in your device settings");
  };
  return (
    <div className="set-panel">
      <Toggle id="sp-notify" title="New episodes and releases" sub={perm === "denied" ? "Blocked in your device settings. Allow notifications for Panda.fun there, then try again" : perm === "unsupported" ? "This device can't show notifications. Coming Up still lists everything" : "Notify me when a show on my Watchlist gets a new episode, or a title I set a reminder for comes out"} value={on} onChange={(v) => void toggle(v)} />
      <Row id="sp-calendar" title="Coming Up" sub="New episodes and premieres for what you follow" href="/calendar" />
      <p className="set-note">{reminders.length ? `${reminders.length} ${reminders.length === 1 ? "reminder" : "reminders"} set on this profile.` : "Tap Remind Me on any upcoming title to follow its release."} Panda checks for new episodes every few hours while the app is open.</p>
    </div>
  );
}

function Panel({ id }: { id: SectionId }) {
  const prefs = usePrefs();
  const set = (p: Partial<Prefs>) => actions.setPrefs(p);
  const genres = useGenres().data;
  const [pinOpen, setPinOpen] = useState(false);
  const [confirmHistory, setConfirmHistory] = useState(false);
  const tv = useIsTv();
  const { mutate } = useSWRConfig();
  const { go } = useNav();
  switch (id) {
    case "profiles":
      return (
        <div className="set-panel">
          <Row id="sp-manage" title="Manage Profiles" sub="Edit names, avatars and Kids profiles" href="/profiles/manage" />
          <Row id="sp-switch" title="Switch Profile" sub="Go back to Who's watching?" onClick={() => { actions.signOut(); go("/profiles", { replace: true }); }} />
        </div>
      );
    case "home":
      return <HomePanel />;
    case "playback":
      return (
        <div className="set-panel">
          <Choice id="quality" title="Preferred quality" value={prefs.quality} options={QUALITIES} onChange={(v) => { set({ quality: v }); toast(`Preferred quality: ${QUALITIES.find((q) => q.id === v)!.label}`); }} />
          <Toggle id="sp-autonext" title="Autoplay next episode" sub="Start the next episode after a 10 second countdown" value={prefs.autoplayNext} onChange={(v) => set({ autoplayNext: v })} />
          <Choice id="stillafter" title="Ask “Are you still watching?”" value={String(prefs.stillAfter)} options={STILL_AFTER}
            onChange={(v) => { set({ stillAfter: Number(v) }); toast(v === "0" ? "Panda keeps playing episodes until the season ends" : `Panda checks in after ${v} episodes in a row`); }} />
          <Toggle id="sp-spoilers" title="Hide spoilers" sub="Blur pictures and hide descriptions of episodes you haven't watched yet" value={prefs.hideSpoilers} onChange={(v) => set({ hideSpoilers: v })} />
          {!tv && <Toggle id="sp-gestures" title="Swipe gestures" sub="In the player, swipe sideways to seek, up or down on the right for volume and on the left for brightness. Hold to play at 2×" value={prefs.gestures} onChange={(v) => set({ gestures: v })} />}
          {PIP && <Toggle id="sp-autopip" title="Picture-in-picture" sub="Keep the video playing in a small window when you leave Panda during playback" value={prefs.autoPip} onChange={(v) => set({ autoPip: v })} />}
          <Toggle id="sp-autoskip" title="Skip intros and recaps" sub="Let CineSrc jump past openings and recaps it detects. Otherwise Panda shows a Skip Intro button" value={prefs.autoSkipIntro} onChange={(v) => set({ autoSkipIntro: v })} />
          <Choice id="speed" title="Playback speed" value={String(prefs.playbackSpeed)} options={SPEED_CHOICES} onChange={(v) => { set({ playbackSpeed: Number(v) }); toast(`Playback speed: ${speedLabel(Number(v))}`); }} />
          <Row id="sp-intros" title="Forget learned intros" sub="Panda learns where each show's opening ends when you skip it" onClick={() => { forgetIntros(); toast("Learned intros cleared"); }} />
        </div>
      );
    case "trailers":
      return (
        <div className="set-panel">
          <Toggle id="sp-trailers" title="Autoplay trailers" sub="Play a trailer after you stay on a title" value={prefs.trailerAutoplay} onChange={(v) => set({ trailerAutoplay: v })} />
          <Toggle id="sp-trailer-sound" title="Trailer sound" sub="Play trailers with sound for this profile" value={prefs.trailerSound} onChange={(v) => set({ trailerSound: v })} />
          {tv && <Toggle id="sp-row-trailers" title="Trailers behind rows" sub="Also play a trailer behind the rows on Home, not only on the hero and Details" value={prefs.rowTrailers} onChange={(v) => set({ rowTrailers: v })} />}
          <Choice id="tvol" title="Trailer volume" value={String(Math.round(prefs.trailerVolume * 100))}
            options={TRAILER_VOLUMES} onChange={(v) => { set({ trailerVolume: Number(v) / 100 }); toast(`Trailer volume ${v}%`); }} />
          <Choice id="tdelay" title="Start trailers after" value={String(prefs.trailerDelay)}
            options={TRAILER_DELAYS} onChange={(v) => set({ trailerDelay: Number(v) })} />
        </div>
      );
    case "subtitles":
      return (
        <div className="set-panel">
          <CaptionPreview size={prefs.subtitleSize} look={prefs.subtitleStyle} text={`Subtitles in ${subLangName(prefs.subtitleLang)} will look like this`} />
          <p className="set-note">Panda shows its own subtitles on CineSrc and Vidy. Settings are saved for this profile only. You can always switch subtitles in the player under Audio &amp; Subtitles.</p>
          <Choice id="submode" title="Turn on subtitles" value={prefs.subtitleMode} options={SUB_MODES} onChange={(v) => { set({ subtitleMode: v }); toast(v === "off" ? "Subtitles stay off until you turn them on" : v === "always" ? "Subtitles on for every title" : "Subtitles on for other languages"); }} />
          <ChipChoice id="sublang" title="Subtitle language" value={prefs.subtitleLang} options={SUB_LANGS} onChange={(v) => { set({ subtitleLang: v, subtitleLang2: prefs.subtitleLang2 === v ? null : prefs.subtitleLang2 }); toast(`Subtitle language: ${subLangName(v)}`); }} />
          <ChipChoice id="sublang2" title="Second language" value={prefs.subtitleLang2 ?? "none"} options={[{ id: "none", label: "None" }, ...SUB_LANGS.filter((l) => l.id !== prefs.subtitleLang)]}
            onChange={(v) => { set({ subtitleLang2: v === "none" ? null : v }); toast(v === "none" ? "No second subtitle language" : `Second language: ${subLangName(v)}`); }} />
          <Toggle id="sp-sdh" title="Subtitles for the deaf and hard of hearing" sub="Prefer SDH tracks with sound descriptions such as [door slams]" value={prefs.subtitleSdh} onChange={(v) => set({ subtitleSdh: v })} />
          <Choice id="subsize" title="Size" value={prefs.subtitleSize} options={SUB_SIZES} onChange={(v) => set({ subtitleSize: v })} />
          <Choice id="substyle" title="Style" value={prefs.subtitleStyle} options={SUB_STYLES} onChange={(v) => set({ subtitleStyle: v })} />
        </div>
      );
    case "sources":
      return <SourcesPanel />;
    case "languages": {
      const langs = (genres?.languages ?? [{ code: "ml", name: "Malayalam" }, { code: "hi", name: "Hindi" }, { code: "en", name: "English" }]).map((l) => ({ id: l.code, label: l.name }));
      return (
        <div className="set-panel">
          <p className="set-note">App language: English</p>
          <Choice id="lang" title="Top 10 language on Home" value={prefs.top10Lang} options={langs} onChange={(v) => { set({ top10Lang: v }); toast(`Top 10 now shows ${languageName(v)}`); }} />
        </div>
      );
    }
    case "parental":
      return (
        <div className="set-panel">
          <Row id="sp-pin" title={prefs.kidsPin ? "Change PIN" : "Set PIN"} sub={prefs.kidsPin ? "A PIN is required to leave Kids profiles" : "No PIN set"} onClick={() => setPinOpen(true)} />
          {prefs.kidsPin && <Row id="sp-pin-off" title="Remove PIN" onClick={() => { set({ kidsPin: null }); toast("PIN removed"); }} />}
          {pinOpen && <PinSetup onClose={() => setPinOpen(false)} />}
        </div>
      );
    case "display":
      return (
        <div className="set-panel">
          <Choice id="layout" title="Layout" value={prefs.layout} options={[{ id: "auto", label: "Automatic", note: "Pick based on screen and input" }, { id: "tv", label: "TV", note: "Remote and keyboard friendly" }, { id: "mobile", label: "Phone", note: "Touch friendly" }]}
            onChange={(v) => set({ layout: v })} />
          {tv && <Choice id="scale" title="Screen size" value={String(prefs.uiScale) as "90" | "95" | "100"} options={[{ id: "100", label: "Full screen", note: "Use the whole picture" }, { id: "95", label: "95%", note: "If your TV cuts off the edges" }, { id: "90", label: "90%", note: "For TVs with strong overscan" }]}
            onChange={(v) => { set({ uiScale: Number(v) as Prefs["uiScale"] }); toast(v === "100" ? "Full screen" : `Screen size ${v}%`); }} />}
          <Choice id="text" title="Text size" value={prefs.textSize} options={[{ id: "default", label: "Default" }, { id: "large", label: "Large", note: "15% bigger" }, { id: "larger", label: "Larger", note: "30% bigger" }]}
            onChange={(v) => set({ textSize: v })} />
          <Choice id="density" title="Card size" value={prefs.density} options={[{ id: "standard", label: "Standard", note: "Large artwork" }, { id: "compact", label: "Compact", note: "More titles in every row" }]}
            onChange={(v) => { set({ density: v }); toast(v === "compact" ? "Compact cards" : "Standard cards"); }} />
          <Toggle id="sp-motion" title="Reduce motion" sub="Turn off animations, zooms and fades" value={prefs.reduceMotion} onChange={(v) => set({ reduceMotion: v })} />
          <Toggle id="sp-contrast" title="High contrast" sub="Brighter text, solid panels and a stronger focus ring" value={prefs.highContrast} onChange={(v) => set({ highContrast: v })} />
        </div>
      );
    case "storage":
      return (
        <div className="set-panel">
          <Choice id="preload" title="Preload titles" value={prefs.preloadMode} options={PRELOAD_CHOICES}
            onChange={(v) => { set({ preloadMode: v }); toast(`Preload titles: ${PRELOAD_CHOICES.find((o) => o.id === v)!.label}`); }} />
          <Row id="sp-cache" title="Clear cached content" sub="Reload rows, artwork and details from the server" onClick={() => {
            void clearPersistentCache();
            void mutate(() => true, undefined, { revalidate: true });
            toast("Cache cleared");
          }} />
          <Row id="sp-recents" title="Clear recent searches" onClick={() => { actions.clearRecentSearches(); toast("Recent searches cleared"); }} />
          <Row id="sp-history" title="Clear watch history" sub={confirmHistory ? "Press again to remove Continue Watching for this profile" : "Removes Continue Watching for this profile"}
            onClick={() => { if (!confirmHistory) { setConfirmHistory(true); return; } actions.clearHistory(); setConfirmHistory(false); toast("Watch history cleared"); }} />
          <StorageUsage />
        </div>
      );
    case "help":
      return (
        <div className="set-panel">
          <Row id="sp-about" title="About Panda.fun" sub={`Version ${installedVersion()}`} href="/about" />
          <Row id="sp-privacy" title="Privacy Policy" href="/privacy" />
          <Row id="sp-terms" title="Terms of Use" href="/terms" />
        </div>
      );
    case "notifications":
      return <NotificationsPanel />;
    case "whatsnew":
      return (
        <div className="set-panel">
          <Row id="sp-whatsnew" title={`What's new in ${installedVersion()}`} sub="See everything that changed in this version" href="/settings/whats-new" />
        </div>
      );
    case "updates":
      return (
        <div className="set-panel">
          <Row id="sp-updates" title="Check for Updates" sub={`Installed version ${installedVersion()}`} href="/settings/updates" />
        </div>
      );
  }
}

/** Help & Settings (spec 15.6 mobile list; 17.1 TV two-column). */
export function SettingsPage() {
  const tv = useIsTv();
  const { section } = useParams<{ section?: string }>();
  const profile = useProfile();
  const { go } = useNav();
  const [focused, setFocused] = useState<SectionId>("profiles");
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { if (tv && root.current) focusFirst(root.current); }, [tv]);

  const current = SECTIONS.find((s) => s.id === section);
  if (!tv && current) {
    return (
      <div className="m-page">
        <PageHeader title={current.title} fallback="/settings" />
        <Panel id={current.id} />
      </div>
    );
  }

  if (tv) {
    return (
      <div ref={root} className="tv-page tv-settings">
        <PageHeader title="Help & Settings" sub={profile ? `Signed in as ${profile.name}` : undefined} />
        <div className="tv-settings-cols">
          <nav className="tv-settings-list" aria-label="Settings sections">
            {SECTIONS.map((s) => (
              <button key={s.id} id={`set-${s.id}`} className={`set-row set-row--section ${focused === s.id ? "is-selected" : ""}`} onFocus={() => setFocused(s.id)}
                onClick={() => { if (s.id === "updates") go("/settings/updates"); else if (s.id === "whatsnew") go("/settings/whats-new"); else { const p = document.getElementById("set-panel"); if (p) focusFirst(p); } }} data-hover-focus>
                <Icon name={s.icon} className="set-row-icon" />
                <span className="set-row-text"><span className="set-row-title">{s.title}</span><span className="set-row-sub">{s.sub}</span></span>
                <Icon name="chevronRight" />
              </button>
            ))}
          </nav>
          <section id="set-panel" className="tv-settings-panel" aria-label={SECTIONS.find((s) => s.id === focused)?.title}>
            <Panel id={focused} />
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="m-page m-settings">
      <PageHeader title="Help & Settings" fallback="/my-space" />
      <ul className="m-set-list">
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <Link href={s.id === "updates" ? "/settings/updates" : s.id === "whatsnew" ? "/settings/whats-new" : `/settings/${s.id}`} className="m-set-item">
              <Icon name={s.icon} className="set-row-icon" />
              <span className="set-row-text"><span className="set-row-title">{s.title}</span><span className="set-row-sub">{s.sub}</span></span>
              <Icon name="chevronRight" />
            </Link>
          </li>
        ))}
      </ul>
      <button className="m-switch" onClick={() => { actions.signOut(); go("/profiles", { replace: true }); }}>Switch Profile</button>
      <footer className="m-set-foot">
        <PandaMark size={28} />
        <p className="m-set-legal"><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Use</Link></p>
        <p>App Version {installedVersion()}</p>
      </footer>
    </div>
  );
}
