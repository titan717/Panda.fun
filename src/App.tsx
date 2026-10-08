import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Route, Switch, useLocation } from 'wouter';
import { AnimatePresence, motion } from 'motion/react';
import { SWRConfig } from 'swr';
import { localCache } from './lib/localCache';
import { Layout } from './components/Layout';
import { Landing } from './pages/Landing';
import { Terms } from './pages/Terms';
import { About } from './pages/About';
import { Profile } from './pages/Profile';
import { Privacy } from './pages/Privacy';
import { Contact } from './pages/Contact';
import { Docs } from './pages/Docs';
import { Home } from './pages/Home';
function retryLazyImport<T>(importer: () => Promise<T>, chunkName: string) {
  return importer().catch(error => {
    if (!isRecoverableChunkLoadError(error)) throw error;
    try {
      const retryKey = 'panda-lazy-retry:' + chunkName + ':' + window.location.pathname;
      if (!sessionStorage.getItem(retryKey)) {
        sessionStorage.setItem(retryKey, '1');
        window.location.reload();
        return new Promise<T>(() => {});
      }
    } catch {}
    throw error;
  });
}

const Search = lazy(() => retryLazyImport(() => import('./pages/Search').then(m => ({ default: m.Search })), 'search'));
const Details = lazy(() => retryLazyImport(() => import('./pages/Details').then(m => ({ default: m.Details })), 'details'));
const Watch = lazy(() => retryLazyImport(() => import('./pages/Watch').then(m => ({ default: m.Watch })), 'watch'));
const Library = lazy(() => retryLazyImport(() => import('./pages/Library').then(m => ({ default: m.Library })), 'library'));
const WhatsNew = lazy(() => retryLazyImport(() => import('./pages/WhatsNew').then(m => ({ default: m.WhatsNew })), 'whats-new'));
const Admin = lazy(() => retryLazyImport(() => import('./pages/Admin').then(m => ({ default: m.Admin })), 'admin'));
const SettingsPage = lazy(() => retryLazyImport(() => import('./pages/Settings').then(m => ({ default: m.Settings })), 'settings'));
import { AuthProvider } from './lib/AuthContext';
import { AuthModal } from './components/ui/AuthModal';
import { AppearanceProvider } from './lib/AppearanceContext';
import { SettingsModal } from './components/ui/SettingsModal';
import { PWAInstallPrompt } from './components/ui/PWAInstallPrompt';
import { PWAUpdatePrompt } from './components/ui/PWAUpdatePrompt';
import { trackPageView } from './lib/analytics';
import { usePWAUpdate } from './lib/usePWAUpdate';
import { PandaIntro, shouldShowPandaIntro } from './components/intro/PandaIntro';
import { isRecoverableChunkLoadError } from './lib/appReliability';
import './components/intro/panda-intro.css';

function AnimatedRoutes() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    trackPageView(location);
  }, [location]);

  if (location === '/') return <Landing />;
  if (location === '/admin') return <Admin />;
  if (location.startsWith('/profile')) return <Profile />;

  return (
    <Layout>
      <AnimatePresence mode="wait">
        <motion.div
          key={location}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="w-full flex-1 flex flex-col will-change-transform"
        >
          <Suspense
            fallback={
              <div className="min-h-[55vh] w-full flex items-center justify-center bg-[var(--kinoma-bg)]" role="status" aria-live="polite">
                <div className="h-8 w-8 rounded-full border-2 border-white/15 border-t-white/80 animate-spin" aria-hidden="true" />
                <span className="sr-only">Loading Panda.fun</span>
              </div>
            }
          >
            <Switch location={location}>
              <Route path="/" component={Landing} />
              <Route path="/browse" component={Home} />
              <Route path="/home" component={Home} />
              <Route path="/terms" component={Terms} />
              <Route path="/privacy-policy" component={Privacy} />
              <Route path="/privacy" component={Privacy} />
              <Route path="/contact" component={Contact} />
              <Route path="/docs" component={Docs} />
              <Route path="/profile" component={Profile} />
              <Route path="/about" component={About} />
              <Route path="/settings" component={SettingsPage} />
              <Route path="/search" component={Search} />
              <Route path="/explore" component={Search} />
              <Route path="/whats-new" component={WhatsNew} />
              <Route path="/details/:id" component={Details} />
              <Route path="/watch/:id" component={Watch} />
              <Route path="/library" component={Library} />
              <Route path="/history" component={Library} />
              <Route>
                <main className="flex min-h-[60vh] items-center justify-center px-6 text-center text-gray-500 font-medium" role="main"><div><h1 className="text-xl font-semibold text-white">Page not found</h1><p className="mt-2">The Panda wandered somewhere else.</p></div></main>
              </Route>
            </Switch>
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  declare readonly props: { children: React.ReactNode };
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[Panda.fun] App render error:', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--kinoma-bg)] px-6 text-center">
        <div className="max-w-md">
          <h1 className="text-2xl font-semibold text-white">Panda took a tiny nap.</h1>
          <p className="mt-2 text-sm text-white/60">Something went wrong while loading this screen.</p>
          <button type="button" className="mt-6 rounded-full border border-white/10 bg-white/10 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/15" onClick={() => window.location.reload()}>Try again</button>
        </div>
      </main>
    );
  }
}

function PWAUpdateBridge() { usePWAUpdate(); return null; }
function MainAppShell() {
  const [location] = useLocation();
  const [showIntro, setShowIntro] = useState(() => location === '/' && shouldShowPandaIntro());

  useEffect(() => {
    if (location !== '/') setShowIntro(false);
  }, [location]);

  if (showIntro) {
    return <PandaIntro onComplete={() => setShowIntro(false)} />;
  }

  return <React.Fragment key={location}><AppErrorBoundary><AnimatedRoutes /></AppErrorBoundary></React.Fragment>;
}

export default function App() {
  return (
    <SWRConfig value={{ provider: localCache.getSwrStorageProvider(), revalidateOnFocus: false, revalidateIfStale: false, dedupingInterval: 30000 }}>
      <AuthProvider>
        <AppearanceProvider>
          <PWAUpdateBridge />
          <MainAppShell />
          <PWAInstallPrompt />
          <PWAUpdatePrompt />
          <AuthModal />
          <SettingsModal />
        </AppearanceProvider>
      </AuthProvider>
    </SWRConfig>
  );
}
