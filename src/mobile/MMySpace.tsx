import { useState } from "react";
import useSWR from "swr";
import { Link } from "wouter";
import { Icon, PandaMark } from "../components/Icon";
import { Avatar, EmptyState, toast } from "../components/ui";
import { actions, continueWatching, MAX_LISTS, useAlertsSeenAt, useHistoryMap, useLists, usePrefs, useProfile, useStore, useWatchlist } from "../lib/store";
import { ListCard, NewListCard } from "../components/ListCard";
import { NewListSheet } from "../components/QuickActions";
import { compareVersions, fetchLatestRelease, installedVersion } from "../lib/updates";
import { isAndroidApp } from "../lib/native";
import { notifyPermission, requestNotify, type NotifyPermission } from "../lib/notify";
import { unseen, useCalendar } from "../lib/calendar";
import { useNav } from "../lib/nav";
import { MContinue, MPoster } from "./MCards";


/** Mobile My Space (spec 14). */
export function MMySpace() {
  const profile = useProfile();
  const profiles = useStore((s) => s.profiles);
  const list = useWatchlist();
  const lists = useLists();
  const [naming, setNaming] = useState(false);
  const cw = continueWatching(useHistoryMap());
  const prefs = usePrefs();
  const { go } = useNav();
  const latest = useSWR("github:latest-release", () => fetchLatestRelease(), { revalidateOnFocus: false, shouldRetryOnError: false, dedupingInterval: 600_000 });
  const hasUpdate = latest.data ? compareVersions(latest.data.version, installedVersion()) > 0 : false;
  const [perm, setPerm] = useState<NotifyPermission>(() => notifyPermission());
  const cal = useCalendar();
  const seenAt = useAlertsSeenAt();
  const newCount = unseen(cal.fresh, seenAt).length;
  const notifOn = perm === "granted" && prefs.notifications;

  const enableNotifs = async () => {
    const p = await requestNotify();
    setPerm(p);
    actions.setPrefs({ notifications: p === "granted" });
    toast(p === "granted" ? "We'll let you know when new episodes land" : "Notifications are blocked in your device settings");
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

      <div className="m-row-head"><h2 className="m-row-title">Notifications</h2><Link href="/calendar" className="m-row-more" aria-label="Open the release calendar"><Icon name="chevronRight" /></Link></div>
      <section className={`m-notif-card ${newCount ? "has-new" : ""}`} aria-live="polite">
        <Icon name="bell" size={28} />
        <span className="m-notif-text">
          <span className="m-notif-title">{newCount ? `${newCount} NEW ${newCount === 1 ? "EPISODE" : "EPISODES"}` : "YOU'RE ALL CAUGHT UP"}</span>
          <span className="m-notif-sub">{newCount
            ? "From shows and films you follow"
            : !notifOn && perm !== "unsupported"
              ? (perm === "denied" ? "Notifications are blocked. Allow them in your device settings." : "Enable notifications to stay updated")
              : cal.upcoming[0] ? `Next: ${cal.upcoming[0].item.title}` : "New episodes from your Watchlist show up here"}</span>
        </span>
        {newCount || notifOn || perm === "denied" || perm === "unsupported"
          ? <Link href="/calendar" className="m-allow">{newCount ? "View" : "Calendar"}</Link>
          : <button className="m-allow" onClick={() => void enableNotifs()}>Allow</button>}
      </section>

      <section className="m-section">
        <div className="m-row-head"><h2 className="m-row-title">{profile ? `Continue Watching for ${profile.name}` : "Continue Watching"}</h2>{cw.length > 0 && <Link href="/continue-watching" className="m-row-more" aria-label="See all Continue Watching"><Icon name="chevronRight" /></Link>}</div>
        {cw.length ? <div className="m-row-track">{cw.slice(0, 20).map((h) => <MContinue key={h.item.id} entry={h} />)}</div>
          : <EmptyState icon="play" title="Nothing in progress" sub="Titles you start watching show up here." />}
      </section>

      <section className="m-section">
        <div className="m-row-head"><h2 className="m-row-title">Watchlist</h2>{list.length > 0 && <Link href="/my-list" className="m-row-more" aria-label="See all Watchlist"><Icon name="chevronRight" /></Link>}</div>
        {list.length ? <div className="m-row-track">{list.slice(0, 20).map((it) => <MPoster key={it.id} item={it} context={{ kind: "watchlist" }} />)}</div>
          : <EmptyState icon="plus" title="Your watchlist is empty" sub="Tap + on any title to save it here." />}
      </section>

      <section className="m-section">
        <div className="m-row-head"><h2 className="m-row-title">My Lists</h2>{lists.length > 0 && <span className="m-row-count">{lists.length}</span>}</div>
        <div className="m-row-track m-list-track">
          {lists.map((l) => <ListCard key={l.id} list={l} tv={false} />)}
          {lists.length < MAX_LISTS && <NewListCard id="ml-new" tv={false} onClick={() => setNaming(true)} />}
        </div>
      </section>
      {naming && <NewListSheet onClose={() => setNaming(false)} onDone={(id) => go(`/my-list?list=${encodeURIComponent(id)}`)} />}
    </div>
  );
}
