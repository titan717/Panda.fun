import { useEffect, useState, type ReactNode } from "react";
import { SWRConfig } from "swr";
import { Route, Router, Switch, useLocation, useParams } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { fetcher } from "./lib/api";
import { persistentCache } from "./lib/cache";
import { detectLayout, type LayoutMode } from "./lib/device";
import { LayoutContext, useLayout } from "./lib/layout";
import { installKeyHandling, setRootBackHandler, setTvNavigation } from "./lib/focus";
import { BUILD_TARGET } from "./lib/nav";
import { actions, getState, usePrefs, useProfile } from "./lib/store";
import { exitApp, isAndroidApp } from "./lib/native";
import { useOnline, useReducedMotion } from "./lib/hooks";
import { compareVersions, fetchLatestRelease, installedVersion } from "./lib/updates";
import { ErrorBoundary, OfflineBanner, Toasts } from "./components/ui";
import { PandaMark, Wordmark } from "./components/Icon";
import { TvShell } from "./tv/TvShell";
import { TvHome } from "./tv/TvHome";
import { TvDetails } from "./tv/TvDetails";
import { TvSearch } from "./tv/TvSearch";
import { TvCategories } from "./tv/TvCategories";
import { TvMySpace } from "./tv/TvMySpace";
import { MobileShell } from "./mobile/MobileShell";
import { MHome } from "./mobile/MHome";
import { MAllEpisodes, MDetails } from "./mobile/MDetails";
import { MSearch } from "./mobile/MSearch";
import { MMySpace } from "./mobile/MMySpace";
import { MCategories } from "./mobile/MCategories";
import { BrowsePage, ContinueWatchingPage, MyListPage, NotFoundPage } from "./pages/Lists";
import { ProfileEdit, ProfileManage, ProfileSelect } from "./pages/Profiles";
import { SettingsPage } from "./pages/Settings";
import { UpdatesPage } from "./pages/Updates";
import { AboutPage, PrivacyPage, TermsPage } from "./pages/Info";
import { PlayerPage } from "./pages/Player";
import type { MediaType, PageKind } from "./lib/types";

const PUBLIC_PATHS = ["/about", "/privacy", "/terms"];

function useLayoutMode(): LayoutMode {
  const { layout } = usePrefs();
  const [mode, setMode] = useState<LayoutMode>(() => detectLayout(layout));
  useEffect(() => {
    const update = () => setMode(detectLayout(layout));
    update();
    window.addEventListener("resize", update);
    const mq = window.matchMedia("(pointer: coarse)");
    mq.addEventListener("change", update);
    return () => { window.removeEventListener("resize", update); mq.removeEventListener("change", update); };
  }, [layout]);
  useEffect(() => {
    document.documentElement.dataset.mode = mode;
    installKeyHandling(mode === "tv");
    setTvNavigation(mode === "tv");
  }, [mode]);
  return mode;
}

function Splash({ leaving }: { leaving: boolean }) {
  return (
    <div className={`splash ${leaving ? "is-leaving" : ""}`} role="status" aria-label="Loading Panda.fun">
      <PandaMark size={96} className="splash-mark" />
      <Wordmark className="splash-word" />
    </div>
  );
}

function useSplash() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<"show" | "leave" | "done">(() => (sessionStorage.getItem("panda:splash") ? "done" : "show"));
  useEffect(() => {
    if (phase === "done") return;
    const a = setTimeout(() => setPhase("leave"), reduce ? 300 : 1400);
    const b = setTimeout(() => { setPhase("done"); sessionStorage.setItem("panda:splash", "1"); }, reduce ? 400 : 1800);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [phase, reduce]);
  return phase;
}

/** Background check for new releases when the user opted into notifications. */
function useReleaseNotifications() {
  const prefs = usePrefs();
  useEffect(() => {
    if (!prefs.notifications || !("Notification" in window) || Notification.permission !== "granted") return;
    const ctrl = new AbortController();
    fetchLatestRelease(ctrl.signal).then((r) => {
      if (compareVersions(r.version, installedVersion()) > 0 && getState().prefs.notifiedTag !== r.tag) {
        new Notification("Panda.fun update available", { body: `Version ${r.version} is ready to install.`, icon: "./pwa-192x192.png" });
        actions.setPrefs({ notifiedTag: r.tag });
      }
    }).catch(() => { /* offline or rate-limited: try again next launch */ });
    return () => ctrl.abort();
  }, [prefs.notifications]);
}

function Home({ kind }: { kind: PageKind }) {
  const mode = useLayout();
  return mode === "tv" ? <TvHome kind={kind} /> : <MHome kind={kind} />;
}

function Details() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const mode = useLayout();
  const t: MediaType | null = type === "movie" || type === "tv" ? type : null;
  const n = Number(id);
  if (!t || !Number.isInteger(n) || n <= 0) return <NotFoundPage />;
  return mode === "tv" ? <TvDetails key={`${t}-${n}`} type={t} id={n} /> : <MDetails key={`${t}-${n}`} type={t} id={n} />;
}

function AllEpisodes() {
  const { id } = useParams<{ id: string }>();
  const mode = useLayout();
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return <NotFoundPage />;
  return mode === "tv" ? <TvDetails type="tv" id={n} initialTab="episodes" /> : <MAllEpisodes id={n} />;
}

function Shell({ mode, children }: { mode: LayoutMode; children: ReactNode }) {
  return mode === "tv" ? <TvShell>{children}</TvShell> : <MobileShell>{children}</MobileShell>;
}

function Routes({ mode }: { mode: LayoutMode }) {
  const [location, navigate] = useLocation();
  const profile = useProfile();
  const online = useOnline();
  const tv = mode === "tv";

  useEffect(() => {
    setRootBackHandler(() => {
      const path = window.location.hash ? window.location.hash.slice(1).split("?")[0] || "/" : window.location.pathname;
      if (path === "/" || path === "") { if (isAndroidApp) exitApp(); return; }
      if (window.history.length > 1) window.history.back(); else navigate("/", { replace: true });
    });
    return () => setRootBackHandler(null);
  }, [navigate]);

  useEffect(() => {
    const t = location === "/" ? "Panda.fun — Movies & TV Shows" : null;
    if (t) document.title = t;
  }, [location]);

  const needsProfile = !profile && !PUBLIC_PATHS.includes(location) && !location.startsWith("/profiles");
  if (needsProfile) return <ProfileSelect />;

  if (location.startsWith("/watch/")) {
    return (
      <ErrorBoundary resetKey={location}>
        <Route path="/watch/:type/:id"><PlayerPage /></Route>
      </ErrorBoundary>
    );
  }
  if (location === "/profiles") return <ProfileSelect />;

  return (
    <>
      {!online && <OfflineBanner />}
      <Shell mode={mode}>
        <ErrorBoundary resetKey={location}>
          <Switch>
            <Route path="/"><Home kind="home" /></Route>
            <Route path="/movies"><Home kind="movies" /></Route>
            <Route path="/tv"><Home kind="tv" /></Route>
            <Route path="/new"><Home kind="new" /></Route>
            <Route path="/categories">{tv ? <TvCategories /> : <MCategories />}</Route>
            <Route path="/browse/:kind"><BrowsePage /></Route>
            <Route path="/search">{tv ? <TvSearch /> : <MSearch />}</Route>
            <Route path="/title/tv/:id/episodes"><AllEpisodes /></Route>
            <Route path="/title/:type/:id"><Details /></Route>
            <Route path="/my-space">{tv ? <TvMySpace /> : <MMySpace />}</Route>
            <Route path="/my-list"><MyListPage /></Route>
            <Route path="/continue-watching"><ContinueWatchingPage /></Route>
            <Route path="/profiles/manage"><ProfileManage /></Route>
            <Route path="/profiles/new"><ProfileEdit isNew /></Route>
            <Route path="/profiles/edit/:id"><ProfileEdit /></Route>
            <Route path="/settings/updates"><UpdatesPage /></Route>
            <Route path="/settings/:section"><SettingsPage /></Route>
            <Route path="/settings"><SettingsPage /></Route>
            <Route path="/about"><AboutPage /></Route>
            <Route path="/privacy"><PrivacyPage /></Route>
            <Route path="/terms"><TermsPage /></Route>
            <Route><NotFoundPage /></Route>
          </Switch>
        </ErrorBoundary>
      </Shell>
    </>
  );
}

export function App() {
  const mode = useLayoutMode();
  const splash = useSplash();
  useReleaseNotifications();
  const routerProps = BUILD_TARGET === "android" ? { hook: useHashLocation } : {};
  return (
    <SWRConfig value={{ fetcher, provider: persistentCache, revalidateOnFocus: false, errorRetryCount: 2, shouldRetryOnError: true }}>
      <LayoutContext.Provider value={mode}>
        <div id="app" className={`app app--${mode}`}>
          <Router {...routerProps}>
            <Routes mode={mode} />
          </Router>
          <Toasts />
          {splash !== "done" && <Splash leaving={splash === "leave"} />}
        </div>
      </LayoutContext.Provider>
    </SWRConfig>
  );
}
