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
                <main className="flex min-h-[60vh] items-center justify-center bg-black px-5 py-12 text-left text-white" role="main">
                  <div className="w-full max-w-xl">
                    <span className="text-[10px] uppercase tracking-[.18em] font-extrabold text-rose-300">404 · wrong turn</span>
                    <h1 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight">We couldn’t find this page.</h1>
                    <p className="mt-3 text-sm leading-7 text-white/65">The address may have changed, or the link may be incomplete. Check the URL, or use Search to find the title again.</p>
                    <p className="mt-4 break-all rounded-lg border border-white/10 bg-white/[.025] p-3 font-mono text-xs leading-6 text-white/50">Requested path: {location}</p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <a href="/home" className="rounded-full bg-rose-600 px-5 py-3 text-sm font-bold text-white hover:bg-rose-500">Go to Home</a>
                      <a href="/search" className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-white hover:bg-white/5">Search titles</a>
                      <a href={`/contact?category=other&subject=${encodeURIComponent('Broken route: ' + location)}`} className="rounded-full border border-white/10 px-5 py-3 text-sm font-bold text-white/70 hover:text-white">Report this link</a>
                    </div>
                  </div>
                </main>
              </Route>
            </Switch>
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; message: string }> {
  declare readonly props: { children: React.ReactNode };
  state = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown) {
    const message = error instanceof Error && error.message
      ? error.message.slice(0, 360)
      : 'The application encountered an unexpected rendering error.';
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown) {
    console.error('[Panda.fun] App render error:', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="min-h-screen flex items-center justify-center bg-black px-5 py-12 text-left text-white">
        <div className="w-full max-w-xl">
          <span className="text-[10px] uppercase tracking-[.18em] font-extrabold text-rose-300">Panda.fun recovery</span>
          <h1 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight">This page could not load.</h1>
          <p className="mt-3 text-sm leading-7 text-white/65">The screen hit a rendering error. Your library and viewing history have not been intentionally cleared.</p>
          <section className="mt-5 rounded-xl border border-white/10 bg-white/[.035] p-4">
            <h2 className="text-xs uppercase tracking-wider font-extrabold text-white/75">Technical detail</h2>
            <p className="mt-2 break-words font-mono text-xs leading-6 text-rose-200" role="status">{this.state.message || 'Unknown render error'}</p>
          </section>
          <h2 className="mt-6 text-sm font-bold">Try these steps</h2>
          <ol className="mt-2 list-decimal pl-5 text-sm leading-7 text-white/60">
            <li>Reload this page once.</li>
            <li>If it repeats, open Panda.fun in a fresh tab and return to the same title.</li>
            <li>Send the technical detail and page path to support so it can be investigated.</li>
          </ol>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" className="rounded-full bg-rose-600 px-5 py-3 text-sm font-bold text-white hover:bg-rose-500" onClick={() => window.location.reload()}>Reload page</button>
            <a href="/contact" className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-white hover:bg-white/5">Contact support</a>
            <a href="/home" className="rounded-full border border-white/10 px-5 py-3 text-sm font-bold text-white/70 hover:text-white">Go to home</a>
          </div>
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
