import { forgetIntros, SPEEDS, speedLabel } from "../lib/player2";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "wouter";
import { useSWRConfig } from "swr";
import { clearPersistentCache } from "../lib/cache";
import { Icon, PandaMark, type IconName } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";
import { toast } from "../components/ui";
import { Sheet } from "../components/Sheet";
import { actions, usePrefs, useProfile, type Prefs } from "../lib/store";
import { useGenres, useSourceHealth } from "../lib/hooks";
import { focusFirst } from "../lib/focus";
import { useNav } from "../lib/nav";
import { useIsTv } from "../lib/layout";
import { installedVersion } from "../lib/updates";
import { languageName } from "../lib/format";
import type { SourceId } from "../lib/types";

type SectionId = "profiles" | "playback" | "trailers" | "sources" | "languages" | "parental" | "display" | "storage" | "whatsnew" | "updates" | "help";
const SECTIONS: { id: SectionId; icon: IconName; title: string; sub: string }[] = [
  { id: "profiles", icon: "user", title: "Profiles & Account", sub: "Add, edit or switch profiles" },
  { id: "playback", icon: "play", title: "Playback", sub: "Quality and autoplay" },
  { id: "trailers", icon: "volume", title: "Trailers", sub: "Autoplay, sound, volume and delay" },
  { id: "sources", icon: "globe", title: "Sources", sub: "Preferred source and live status" },
  { id: "languages", icon: "globe", title: "App Language & Content Languages", sub: "Top 10 language and content preferences" },
  { id: "parental", icon: "lock", title: "Parental Controls", sub: "PIN for leaving Kids profiles" },
  { id: "display", icon: "tv", title: "Display", sub: "Layout, screen size, text, motion and contrast" },
  { id: "storage", icon: "file", title: "Data & Storage", sub: "Preloading, space used and clearing saved data" },
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
  { id: "vidy", label: "Vidy", note: "Backup source with resume and progress sync" }
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

function Toggle({ id, title, sub, value, onChange }: { id: string; title: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button id={id} role="switch" aria-checked={value} className="set-row" onClick={() => onChange(!value)} data-hover-focus>
      <span className="set-row-text"><span className="set-row-title">{title}</span>{sub && <span className="set-row-sub">{sub}</span>}</span>
      <span className={`toggle ${value ? "is-on" : ""}`} aria-hidden="true" />
    </button>
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
      <Choice id="src" title="Preferred video source" value={prefs.preferredSource} options={SOURCES}
        onChange={(v) => { actions.setPrefs({ preferredSource: v }); toast(`Preferred source: ${SOURCES.find((s) => s.id === v)!.label}`); }} />
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
    </div>
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
    case "playback":
      return (
        <div className="set-panel">
          <Choice id="quality" title="Preferred quality" value={prefs.quality} options={QUALITIES} onChange={(v) => { set({ quality: v }); toast(`Preferred quality: ${QUALITIES.find((q) => q.id === v)!.label}`); }} />
          <Toggle id="sp-autonext" title="Autoplay next episode" sub="Start the next episode after a 10 second countdown" value={prefs.autoplayNext} onChange={(v) => set({ autoplayNext: v })} />
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
          <Choice id="tvol" title="Trailer volume" value={String(Math.round(prefs.trailerVolume * 100))}
            options={TRAILER_VOLUMES} onChange={(v) => { set({ trailerVolume: Number(v) / 100 }); toast(`Trailer volume ${v}%`); }} />
          <Choice id="tdelay" title="Start trailers after" value={String(prefs.trailerDelay)}
            options={TRAILER_DELAYS} onChange={(v) => set({ trailerDelay: Number(v) })} />
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
        <p><Link href="/privacy">Privacy Policy</Link> · <Link href="/terms">Terms of Use</Link></p>
        <p>App Version {installedVersion()}</p>
      </footer>
    </div>
  );
}
