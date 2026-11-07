import { useState } from "react";
import useSWR from "swr";
import { Link } from "wouter";
import { Icon, PandaMark } from "../components/Icon";
import { Avatar, EmptyState, toast } from "../components/ui";
import { actions, continueWatching, useHistoryMap, usePrefs, useProfile, useStore, useWatchlist } from "../lib/store";
import { compareVersions, fetchLatestRelease, installedVersion } from "../lib/updates";
import { isAndroidApp } from "../lib/native";
import { useNav } from "../lib/nav";
import { MContinue, MPoster } from "./MCards";

const notifSupported = typeof window !== "undefined" && "Notification" in window;

/** Mobile My Space (spec 14). */
export function MMySpace() {
  const profile = useProfile();
  const profiles = useStore((s) => s.profiles);
  const list = useWatchlist();
  const cw = continueWatching(useHistoryMap());
  const prefs = usePrefs();
  const { go } = useNav();
  const latest = useSWR("github:latest-release", () => fetchLatestRelease(), { revalidateOnFocus: false, shouldRetryOnError: false, dedupingInterval: 600_000 });
  const hasUpdate = latest.data ? compareVersions(latest.data.version, installedVersion()) > 0 : false;
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(notifSupported ? Notification.permission : "unsupported");

  const enableNotifs = async () => {
    if (!notifSupported) return;
    const p = await Notification.requestPermission();
    setPerm(p);
    actions.setPrefs({ notifications: p === "granted" });
    toast(p === "granted" ? "Notifications turned on" : "Notifications are blocked in your browser settings");
  };

  return (
    <div className="m-page m-myspace">
      <header className="m-head is-solid">
        <span className="m-head-left"><PandaMark size={26} /></span>
        <Link href="/settings" className="m-head-link"><Icon name="settings" /> Help & Settings</Link>
      </header>

      <Link href="/settings/updates" className="m-app-card">
        <span className="m-app-card-text">
          <span className="m-app-card-title">Panda v{installedVersion()}{isAndroidApp ? "" : " · Web"}</span>
          <span className="m-app-card-sub">{latest.data ? (hasUpdate ? `Update available: v${latest.data.version}` : "You're on the latest version") : latest.error ? "Tap to check for updates" : "Checking for updates…"}</span>
        </span>
        <span className="m-app-card-cta">{hasUpdate ? "Update" : "Check"}</span>
      </Link>

      <section className="m-section">
        <div className="m-row-head"><h2 className="m-row-title">Profiles</h2><Link href="/profiles/manage" className="m-link"><Icon name="edit" /> Edit</Link></div>
        <div className="m-profiles">
          {profiles.map((p) => (
            <button key={p.id} className={`m-profile ${p.id === profile?.id ? "is-current" : ""}`} aria-pressed={p.id === profile?.id}
              onClick={() => { if (p.id !== profile?.id) { actions.selectProfile(p.id); toast(`Switched to ${p.name}`); go("/", { replace: true }); } }}>
              <Avatar kind={p.avatar} /><span>{p.name}</span>
            </button>
          ))}
          {profiles.length < 6 && (
            <Link href="/profiles/new" className="m-profile"><span className="avatar avatar--add"><Icon name="plus" /></span><span>Add</span></Link>
          )}
        </div>
      </section>

      {perm !== "unsupported" && !(perm === "granted" && prefs.notifications) && (
        <section className="m-notif-card">
          <Icon name="bell" size={28} />
          <span className="m-notif-text">
            <span className="m-notif-title">YOU'RE ALL CAUGHT UP</span>
            <span className="m-notif-sub">{perm === "denied" ? "Notifications are blocked. Allow them in your browser settings." : "Enable notifications to stay updated"}</span>
          </span>
          {perm !== "denied" && <button className="m-allow" onClick={() => void enableNotifs()}>Allow</button>}
        </section>
      )}

      <section className="m-section">
        <div className="m-row-head"><h2 className="m-row-title">Continue Watching</h2>{cw.length > 0 && <Link href="/continue-watching" className="m-row-more" aria-label="See all Continue Watching"><Icon name="chevronRight" /></Link>}</div>
        {cw.length ? <div className="m-row-track">{cw.slice(0, 20).map((h) => <MContinue key={h.item.id} entry={h} />)}</div>
          : <EmptyState icon="play" title="Nothing in progress" sub="Titles you start watching show up here." />}
      </section>

      <section className="m-section">
        <div className="m-row-head"><h2 className="m-row-title">Watchlist</h2>{list.length > 0 && <Link href="/my-list" className="m-row-more" aria-label="See all Watchlist"><Icon name="chevronRight" /></Link>}</div>
        {list.length ? <div className="m-row-track">{list.slice(0, 20).map((it) => <MPoster key={it.id} item={it} />)}</div>
          : <EmptyState icon="plus" title="Your watchlist is empty" sub="Tap + on any title to save it here." />}
      </section>
    </div>
  );
}
