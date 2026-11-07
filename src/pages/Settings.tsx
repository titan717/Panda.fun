import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "wouter";
import { useSWRConfig } from "swr";
import { Icon, PandaMark, type IconName } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";
import { toast } from "../components/ui";
import { Sheet } from "../components/Sheet";
import { actions, usePrefs, useProfile, type Prefs } from "../lib/store";
import { useGenres } from "../lib/hooks";
import { focusFirst } from "../lib/focus";
import { useNav } from "../lib/nav";
import { useIsTv } from "../lib/layout";
import { installedVersion } from "../lib/updates";
import { languageName } from "../lib/format";
import type { SourceId } from "../lib/types";

type SectionId = "profiles" | "playback" | "languages" | "parental" | "display" | "storage" | "help" | "updates";
const SECTIONS: { id: SectionId; icon: IconName; title: string; sub: string }[] = [
  { id: "profiles", icon: "user", title: "Profiles & Account", sub: "Add, edit or switch profiles" },
  { id: "playback", icon: "play", title: "Playback", sub: "Video source, autoplay and trailers" },
  { id: "languages", icon: "globe", title: "App Language & Content Languages", sub: "Top 10 language and content preferences" },
  { id: "parental", icon: "lock", title: "Parental Controls", sub: "PIN for leaving Kids profiles" },
  { id: "display", icon: "tv", title: "Display", sub: "TV or phone layout" },
  { id: "storage", icon: "file", title: "Storage & Data", sub: "Clear saved data on this device" },
  { id: "help", icon: "info", title: "Help & Support", sub: "About Panda.fun, privacy and terms" },
  { id: "updates", icon: "download", title: "Check for Updates", sub: "Get the newest version of the app" }
];

export const SOURCES: { id: SourceId; label: string; note: string }[] = [
  { id: "cinesrc", label: "CineSrc", note: "Resume, progress sync and volume control" },
  { id: "vidsrc", label: "VidSrc", note: "Resume and progress sync" },
  { id: "vidsrc-mirror", label: "Mirror", note: "Backup source, no progress sync" }
];

function Row({ id, title, sub, right, onClick, href }: { id: string; title: string; sub?: string; right?: ReactNode; onClick?: () => void; href?: string }) {
  const inner = <><span className="set-row-text"><span className="set-row-title">{title}</span>{sub && <span className="set-row-sub">{sub}</span>}</span>{right ?? <Icon name="chevronRight" />}</>;
  return href
    ? <Link href={href} id={id} className="set-row" data-hover-focus>{inner}</Link>
    : <button id={id} className="set-row" onClick={onClick} data-hover-focus>{inner}</button>;
}

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
          <Choice id="src" title="Preferred video source" value={prefs.preferredSource} options={SOURCES} onChange={(v) => { set({ preferredSource: v }); toast(`Preferred source: ${SOURCES.find((s) => s.id === v)!.label}`); }} />
          <Toggle id="sp-autonext" title="Autoplay next episode" sub="Start the next episode after a 10 second countdown" value={prefs.autoplayNext} onChange={(v) => set({ autoplayNext: v })} />
          <Toggle id="sp-trailers" title="Autoplay trailers" sub="Play trailers on Home and title pages" value={prefs.trailerAutoplay} onChange={(v) => set({ trailerAutoplay: v })} />
        </div>
      );
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
        </div>
      );
    case "storage":
      return (
        <div className="set-panel">
          <Row id="sp-cache" title="Clear cached content" sub="Reload rows, artwork and details from the server" onClick={() => {
            try { localStorage.removeItem("panda:v1:swr"); } catch { /* storage blocked */ }
            void mutate(() => true, undefined, { revalidate: true });
            toast("Cache cleared");
          }} />
          <Row id="sp-recents" title="Clear recent searches" onClick={() => { actions.clearRecentSearches(); toast("Recent searches cleared"); }} />
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
                onClick={() => { if (s.id === "updates") go("/settings/updates"); else { const p = document.getElementById("set-panel"); if (p) focusFirst(p); } }} data-hover-focus>
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
            <Link href={s.id === "updates" ? "/settings/updates" : `/settings/${s.id}`} className="m-set-item">
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
