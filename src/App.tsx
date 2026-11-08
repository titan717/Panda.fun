import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { KidsGate } from "./components/KidsGate";
import { SWRConfig, useSWRConfig } from "swr";
import { Route, Router, Switch, useLocation, useParams } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { fetcher } from "./lib/api";
import { persistentCache } from "./lib/cache";
import { setPrefetchDataSaver, setPreloadMode } from "./lib/network";
import { detectLayout, type LayoutMode } from "./lib/device";
import { LayoutContext, useLayout } from "./lib/layout";
import { installKeyHandling, setRootBackHandler, setTvNavigation } from "./lib/focus";
import { BUILD_TARGET } from "./lib/nav";
import { actions, getState, usePrefs, useProfile } from "./lib/store";
import { exitApp, isAndroidApp } from "./lib/native";
import { useOnline, useReducedMotion } from "./lib/hooks";
import { compareVersions, fetchLatestRelease, installedVersion, takeUpdateNotice } from "./lib/updates";
import { ErrorBoundary, OfflineBanner, Toasts, toast } from "./components/ui";
import { PandaMark, Wordmark } from "./components/Icon";
import { BrowsePage, ContinueWatchingPage, MyListPage, NotFoundPage } from "./pages/Lists";
import { ProfileEdit, ProfileManage, ProfileSelect } from "./pages/Profiles";
import { lazyNamed, whenIdle } from "./lib/lazy";
import type { MediaType, PageKind } from "./lib/types";

const loadTv = () => import("./tv");
const loadMobile = () => import("./mobile");
const loadPlayer = () => import("./pages/Player");
const loadSettings = () => import("./pages/Settings");
const loadUpdates = () => import("./pages/Updates");
const loadInfo = () => import("./pages/Info");
const loadWhatsNew = () => import("./pages/WhatsNew");
const loadPerson = () => import("./pages/Person");

const lz = lazyNamed;
const TvShell = lz(loadTv, "TvShell");
const TvHome = lz(loadTv, "TvHome");
const TvDetails = lz(loadTv, "TvDetails");
const TvSearch = lz(loadTv, "TvSearch");
const TvCategories = lz(loadTv, "TvCategories");
const TvMySpace = lz(loadTv, "TvMySpace");
const MobileShell = lz(loadMobile, "MobileShell");
const MHome = lz(loadMobile, "MHome");
const MDetails = lz(loadMobile, "MDetails");
const MAllEpisodes = lz(loadMobile, "MAllEpisodes");
const MSearch = lz(loadMobile, "MSearch");
const MMySpace = lz(loadMobile, "MMySpace");
const MCategories = lz(loadMobile, "MCategories");
const PlayerPage = lz(loadPlayer, "PlayerPage");
const SettingsPage = lz(loadSettings, "SettingsPage");
const UpdatesPage = lz(loadUpdates, "UpdatesPage");
const AboutPage = lz(loadInfo, "AboutPage");
const PrivacyPage = lz(loadInfo, "PrivacyPage");
const TermsPage = lz(loadInfo, "TermsPage");
const WhatsNewPage = lz(loadWhatsNew, "WhatsNewPage");
const WhatsNewSheet = lz(loadWhatsNew, "WhatsNewSheet");
const PersonPage = lz(loadPerson, "PersonPage");

/** Start downloading the active layout at once, and the rest of the app when the device is idle. */
export function prefetchRoutes(mode: LayoutMode) {
  void (mode === "tv" ? loadTv() : loadMobile());
  whenIdle(() => { void loadPlayer().then((m) => { if (mode === "tv") void m.loadTvChrome(); }); void loadSettings(); void loadUpdates(); void loadInfo(); void loadWhatsNew(); void loadPerson(); });
}

const PUBLIC_PATHS = ["/about", "/privacy", "/terms"];

export const TEXT_SCALE = { default: 1, large: 1.15, larger: 1.3 } as const;

/** Settings › Display: mirror the profile's display prefs onto <html> so CSS can react (D-44). */
function useDisplayPrefs(mode: LayoutMode) {
  const { uiScale, reduceMotion, highContrast, textSize, quality, preloadMode } = usePrefs();
  useEffect(() => { setPrefetchDataSaver(quality === "480"); setPreloadMode(preloadMode); }, [quality, preloadMode]);
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.scale = mode === "tv" ? String(uiScale) : "100";
    html.dataset.motion = reduceMotion ? "reduce" : "auto";
    html.dataset.contrast = highContrast ? "high" : "normal";
    html.style.setProperty("--fs", String(TEXT_SCALE[textSize] ?? 1));
  }, [mode, uiScale, reduceMotion, highContrast, textSize]);
}

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
    prefetchRoutes(mode);
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
  return (
    <KidsGate type={t} id={n}>
      {mode === "tv" ? <TvDetails key={`${t}-${n}`} type={t} id={n} /> : <MDetails key={`${t}-${n}`} type={t} id={n} />}
    </KidsGate>
  );
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

/** When the connection returns: say so, and retry every request that failed while offline. */
function ReconnectRecovery() {
  const online = useOnline();
  const { mutate, cache } = useSWRConfig();
  const wasOffline = useRef(false);
  useEffect(() => {
    if (!online) { wasOffline.current = true; return; }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    toast("Back online");
    void mutate((key) => {
      if (typeof key !== "string") return false;
      const entry = cache.get(key) as { error?: unknown; data?: unknown } | undefined;
      return Boolean(entry && (entry.error || entry.data === undefined));
    });
    window.dispatchEvent(new Event("panda:reconnect"));
  }, [online, mutate, cache]);
  return null;
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

  const [notice, setNotice] = useState<string | null>(takeUpdateNotice);
  const needsProfile = !profile && !PUBLIC_PATHS.includes(location) && !location.startsWith("/profiles");
  if (needsProfile) return <ProfileSelect />;

  if (location.startsWith("/watch/")) {
    return (
      <ErrorBoundary resetKey={location}>
        <Suspense fallback={<div className="route-loading" />}>
          <Route path="/watch/:type/:id"><PlayerPage /></Route>
        </Suspense>
      </ErrorBoundary>
    );
  }
  if (location === "/profiles") return <ProfileSelect />;

  return (
    <>
      {!online && <OfflineBanner />}
      <Suspense fallback={<div className="route-loading" />}>
      <Shell mode={mode}>
        <ErrorBoundary resetKey={location}>
          <Suspense fallback={<div className="route-loading route-loading--inner" />}>
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
            <Route path="/person/:id"><PersonPage /></Route>
            <Route path="/my-space">{tv ? <TvMySpace /> : <MMySpace />}</Route>
            <Route path="/my-list"><MyListPage /></Route>
            <Route path="/continue-watching"><ContinueWatchingPage /></Route>
            <Route path="/profiles/manage"><ProfileManage /></Route>
            <Route path="/profiles/new"><ProfileEdit isNew /></Route>
            <Route path="/profiles/edit/:id"><ProfileEdit /></Route>
            <Route path="/settings/updates"><UpdatesPage /></Route>
            <Route path="/settings/whats-new"><WhatsNewPage /></Route>
            <Route path="/settings/:section"><SettingsPage /></Route>
            <Route path="/settings"><SettingsPage /></Route>
            <Route path="/about"><AboutPage /></Route>
            <Route path="/privacy"><PrivacyPage /></Route>
            <Route path="/terms"><TermsPage /></Route>
            <Route><NotFoundPage /></Route>
          </Switch>
          </Suspense>
        </ErrorBoundary>
      </Shell>
      {notice && <WhatsNewSheet version={notice} onClose={() => setNotice(null)} />}
      </Suspense>
    </>
  );
}

export function App() {
  const mode = useLayoutMode();
  useDisplayPrefs(mode);
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
          <ReconnectRecovery />
          {splash !== "done" && <Splash leaving={splash === "leave"} />}
        </div>
      </LayoutContext.Provider>
    </SWRConfig>
  );
}
