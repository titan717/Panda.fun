import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { PandaMark, Wordmark } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";
import { apiGet, API_BASE, keys } from "../lib/api";
import { installedVersion } from "../lib/updates";
import { useIsTv } from "../lib/layout";
import { focusFirst } from "../lib/focus";

function InfoShell({ title, children }: { title: string; children: ReactNode }) {
  const tv = useIsTv();
  const root = useRef<HTMLDivElement>(null);
  // the scroll container itself is focusable on TV so Up/Down can read long text with the remote
  useEffect(() => { if (tv && root.current) focusFirst(root.current); }, [tv]);
  return (
    <div ref={root} className={tv ? "tv-page tv-settings-page tv-info" : "m-page m-info"}>
      <PageHeader title={title} fallback="/settings" />
      <article className="info-body" tabIndex={tv ? 0 : undefined} data-autofocus
        onKeyDown={(e) => {
          const el = e.currentTarget;
          if (e.key === "ArrowDown" && el.scrollTop + el.clientHeight < el.scrollHeight - 2) { e.preventDefault(); el.scrollBy({ top: 160 }); }
          if (e.key === "ArrowUp" && el.scrollTop > 0) { e.preventDefault(); el.scrollBy({ top: -160 }); }
        }}>
        {children}
      </article>
    </div>
  );
}

export function AboutPage() {
  const [health, setHealth] = useState<"checking" | "ok" | "down">("checking");
  useEffect(() => {
    const c = new AbortController();
    apiGet<unknown>(keys.health(), { signal: c.signal, retries: 0, timeoutMs: 40_000 }).then(() => setHealth("ok"), () => { if (!c.signal.aborted) setHealth("down"); });
    return () => c.abort();
  }, []);
  return (
    <InfoShell title="About">
      <div className="about-brand"><PandaMark size={64} /><Wordmark /></div>
      <p>Version {installedVersion()}</p>
      <p>Panda.fun helps you discover movies and TV shows and play them from public streaming sources, on TV, phone and computer.</p>
      <h2>Service status</h2>
      <p>Catalogue server: {health === "checking" ? "checking…" : health === "ok" ? "online" : "unreachable right now (it may be waking up, try again in a minute)"}</p>
      <p className="info-small">{API_BASE.replace(/^https?:\/\//, "")}</p>
      <h2>Data</h2>
      <p>Titles, artwork and episode information come from The Movie Database (TMDB). This product uses the TMDB API but is not endorsed or certified by TMDB. Trailers play from YouTube.</p>
      <h2>Your data</h2>
      <p>Profiles, watchlists, ratings and watch progress are stored only on this device. Panda.fun has no accounts, ads or tracking.</p>
      <h2>Open source</h2>
      <p>Built with React, SWR, wouter, BBC LRUD Spatial and the Inter typeface (SIL Open Font License).</p>
      <p><Link href="/privacy">Privacy Policy</Link> · <Link href="/terms">Terms of Use</Link></p>
    </InfoShell>
  );
}

export function PrivacyPage() {
  return (
    <InfoShell title="Privacy Policy">
      <p>Last updated 7 November 2026.</p>
      <h2>What we store</h2>
      <p>Panda.fun keeps your profiles, watchlist, ratings, recent searches, watch progress and settings in your browser's or app's local storage on this device. It is never sent to us.</p>
      <h2>What we don't do</h2>
      <p>No accounts, no analytics, no advertising identifiers, no cookies for tracking, and no selling of data.</p>
      <h2>Third parties</h2>
      <p>To show the catalogue the app requests data from the Panda catalogue server, which fetches it from TMDB. Images load from TMDB's image service, trailers from YouTube (privacy-enhanced mode) and playback from the video source you pick (CineSrc or Vidy). Those services receive your IP address and standard request headers, and their own privacy policies apply.</p>
      <h2>Updates</h2>
      <p>Check for Updates contacts the GitHub Releases API to compare versions. The Android app downloads updates from GitHub.</p>
      <h2>Deleting your data</h2>
      <p>Delete a profile in Manage Profiles, clear data in Help & Settings, or clear the site's storage in your browser.</p>
    </InfoShell>
  );
}

export function TermsPage() {
  return (
    <InfoShell title="Terms of Use">
      <p>Last updated 7 November 2026.</p>
      <h2>The service</h2>
      <p>Panda.fun is a free interface for browsing film and TV information and opening third-party players. It does not host, upload or control any video files.</p>
      <h2>Third-party content</h2>
      <p>Video streams are provided by independent third-party sources. Availability, quality and legality depend on those providers and on the laws where you live. You are responsible for how you use them.</p>
      <h2>No warranty</h2>
      <p>The app is provided "as is" without warranties of any kind. Features may change or stop working at any time.</p>
      <h2>Trademarks</h2>
      <p>Titles, logos and artwork belong to their respective owners and are shown for identification only.</p>
    </InfoShell>
  );
}
