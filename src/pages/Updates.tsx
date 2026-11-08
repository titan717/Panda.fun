import "./updates.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { ReleaseNotes as Notes } from "../components/ReleaseNotes";
import { PageHeader } from "../components/PageHeader";
import { Spinner } from "../components/ui";
import { useIsTv } from "../lib/layout";
import { useOnline } from "../lib/hooks";
import { whatsNewSection } from "../lib/releaseNotes";
import { compareVersions, fetchLatestRelease, installedVersion, nativeUpdates, onNativeUpdateStatus, WEB_VERSION, type ReleaseInfo } from "../lib/updates";
import { isAndroidApp } from "../lib/native";
import { focusFirst } from "../lib/focus";
import { shortDate } from "../lib/format";

type State =
  | { s: "checking" }
  | { s: "offline" }
  | { s: "error"; message: string }
  | { s: "uptodate"; release: ReleaseInfo }
  | { s: "available"; release: ReleaseInfo }
  | { s: "downloading"; release: ReleaseInfo; progress: number | null }
  | { s: "ready"; release: ReleaseInfo };

/** Check for Updates (spec 17.2): compares the installed version with the latest GitHub Release. */
export function UpdatesPage() {
  const tv = useIsTv();
  const online = useOnline();
  const [state, setState] = useState<State>({ s: "checking" });
  const root = useRef<HTMLDivElement>(null);
  const current = installedVersion();

  const check = useCallback(async () => {
    if (!navigator.onLine) { setState({ s: "offline" }); return; }
    setState({ s: "checking" });
    try {
      const release = await fetchLatestRelease(undefined, true);
      setState(compareVersions(release.version, current) > 0 ? { s: "available", release } : { s: "uptodate", release });
    } catch (e) {
      setState(navigator.onLine ? { s: "error", message: (e as Error).message } : { s: "offline" });
    }
  }, [current]);

  useEffect(() => { void check(); }, [check]);
  useEffect(() => { if (tv && root.current) focusFirst(root.current); }, [tv, state.s]);

  useEffect(() => onNativeUpdateStatus((n) => {
    setState((prev) => {
      const release = "release" in prev ? prev.release : null;
      if (!release) return prev;
      if (n.status === "downloading") return { s: "downloading", release, progress: typeof n.progress === "number" ? n.progress : null };
      if (n.status === "ready" || n.status === "installing") return { s: "ready", release };
      if (n.status === "error") return { s: "error", message: n.message ?? "The download failed." };
      return prev;
    });
  }), []);

  const install = () => {
    if (state.s !== "available" && state.s !== "error") return;
    if (isAndroidApp) {
      if ("release" in state) setState({ s: "downloading", release: state.release, progress: 0 });
      nativeUpdates.download();
    }
  };

  const release = "release" in state ? state.release : null;
  const apk = release?.apkUrl ?? null;

  return (
    <div ref={root} className={tv ? "tv-page tv-settings-page tv-updates" : "m-page m-updates"}>
      <PageHeader title="Check for Updates" fallback="/settings" />
      <div className="upd-card" aria-live="polite">
        <p className="upd-current">Installed version <strong>{current}</strong>{!isAndroidApp && current === WEB_VERSION ? " (web app)" : ""}</p>
        {state.s === "checking" && <Spinner label="Checking for updates…" />}
        {state.s === "offline" && (
          <>
            <p className="upd-status"><Icon name="signal" /> You're offline</p>
            <p className="upd-sub">Connect to the internet to check for updates.</p>
            <button className="btn btn--secondary" data-autofocus disabled={!online} onClick={() => void check()}><Icon name="refresh" /> Retry</button>
          </>
        )}
        {state.s === "error" && (
          <>
            <p className="upd-status"><Icon name="info" /> Couldn't check for updates</p>
            <p className="upd-sub">{state.message}</p>
            <button className="btn btn--secondary" data-autofocus onClick={() => void check()}><Icon name="refresh" /> Retry</button>
          </>
        )}
        {state.s === "uptodate" && (
          <>
            <p className="upd-status"><Icon name="check" /> You're on the latest version</p>
            <p className="upd-sub">Latest release {state.release.tag} • {shortDate(state.release.publishedAt.slice(0, 10))}</p>
            <button className="btn btn--secondary" data-autofocus onClick={() => void check()}><Icon name="refresh" /> Check again</button>
          </>
        )}
        {(state.s === "available" || state.s === "downloading" || state.s === "ready") && release && (
          <>
            <p className="upd-status upd-status--new"><Icon name="sparkle" /> Update available: {release.tag}</p>
            <p className="upd-sub">Released {shortDate(release.publishedAt.slice(0, 10))}{release.apkSize ? ` • ${(release.apkSize / 1048576).toFixed(1)} MB` : ""}</p>
            {state.s === "available" && isAndroidApp && <button className="btn btn--update" data-autofocus onClick={install}><Icon name="download" /> Download & Install</button>}
            {state.s === "available" && !isAndroidApp && (
              <p className="upd-sub">The web app updates itself when you reload. {apk ? "Android users can download the new APK:" : ""}</p>
            )}
            {state.s === "available" && !isAndroidApp && apk && <a className="btn btn--update" data-autofocus href={apk} rel="noreferrer"><Icon name="download" /> Download APK</a>}
            {state.s === "downloading" && (
              <div className="upd-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.progress ?? undefined} aria-label="Download progress">
                <span style={{ width: `${state.progress ?? 5}%` }} />
                <em>{state.progress === null ? "Downloading…" : `Downloading ${Math.round(state.progress)}%`}</em>
              </div>
            )}
            {state.s === "ready" && <p className="upd-sub">Download complete. Follow the prompt to install.</p>}
          </>
        )}
        {release && (state.s !== "uptodate") && release.notes && <><p className="upd-notes-title">What's new</p><Notes text={whatsNewSection(release.notes, release.version) || release.notes} /></>}
        {release && state.s === "uptodate" && release.notes && <><p className="upd-notes-title">Release notes</p><Notes text={whatsNewSection(release.notes, release.version) || release.notes} /></>}
        {!isAndroidApp && release?.apkUrl && state.s === "uptodate" && <a className="upd-link" href={release.apkUrl} rel="noreferrer"><Icon name="download" /> Get the Android app ({release.tag})</a>}
      </div>
    </div>
  );
}
