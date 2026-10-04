import React, { lazy, Suspense, useEffect, Component } from 'react';
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
const Search = lazy(() => import('./pages/Search').then(m => ({ default: m.Search })));
const Details = lazy(() => import('./pages/Details').then(m => ({ default: m.Details })));
const Watch = lazy(() => import('./pages/Watch').then(m => ({ default: m.Watch })));
const Library = lazy(() => import('./pages/Library').then(m => ({ default: m.Library })));
const WhatsNew = lazy(() => import('./pages/WhatsNew').then(m => ({ default: m.WhatsNew })));
const Admin = lazy(() => import('./pages/Admin').then(m => ({ default: m.Admin })));
const SettingsPage = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
import { AuthProvider } from './lib/AuthContext';
import { AuthModal } from './components/ui/AuthModal';
import { AppearanceProvider } from './lib/AppearanceContext';
import { SettingsModal } from './components/ui/SettingsModal';
import { PWAInstallPrompt } from './components/ui/PWAInstallPrompt';
import { PWAUpdatePrompt } from './components/ui/PWAUpdatePrompt';
import { trackPageView } from './lib/analytics';
import { usePWAUpdate } from './lib/usePWAUpdate';

function AnimatedRoutes() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    trackPageView(location);
  }, [location]);

  if (location === '/') return <Landing />;

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
              <div className="min-h-[55vh] w-full flex items-center justify-center bg-[var(--kinoma-bg)]">
                <div className="h-8 w-8 rounded-full border-2 border-white/15 border-t-white/80 animate-spin" aria-label="Loading Panda.fun" />
              </div>
            }
          >
            <Switch location={location}>
              <Route path="/" component={Landing} />
              <Route path="/browse" component={Home} />
              <Route path="/home" component={Home} />
              <Route path="/terms" component={Terms} />
              <Route path="/privacy" component={Privacy} />
              <Route path="/contact" component={Contact} />
              <Route path="/docs" component={Docs} />
              <Route path="/profile" component={Profile} />
              <Route path="/about" component={About} />
              <Route path="/admin" component={Admin} />
              <Route path="/settings" component={SettingsPage} />
              <Route path="/search" component={Search} />
              <Route path="/explore" component={Search} />
              <Route path="/whats-new" component={WhatsNew} />
              <Route path="/details/:id" component={Details} />
              <Route path="/watch/:id" component={Watch} />
              <Route path="/library" component={Library} />
              <Route path="/history" component={Library} />
              <Route>
                <div className="flex min-h-[60vh] items-center justify-center text-gray-500 font-medium">
                  404 - Page Not Found
                </div>
              </Route>
            </Switch>
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}

class AppErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: unknown) { console.error('[Panda.fun] App render error:', error); }
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
function MainAppShell() { return <AnimatedRoutes />; }

export default function App() {
  return (
    <AppErrorBoundary>
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
    </AppErrorBoundary>
  );
}
