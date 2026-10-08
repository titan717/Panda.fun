import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

export type AnalyticsEventType =
  | 'page_view'
  | 'watch_start'
  | 'watch_progress'
  | 'watch_complete'
  | 'search'
  | 'anime_open'
  | 'content_select'
  | 'episode_start'
  | 'episode_select'
  | 'library_action'
  | 'error'
  | 'api_failure'
  | 'share'
  | 'login'
  | 'sign_up'
  | 'profile_create'
  | 'profile_select'
  | 'profile_switch'
  | 'profile_delete';

interface AnalyticsEvent {
  type: AnalyticsEventType;
  path?: string;
  animeId?: string;
  animeTitle?: string;
  episodeId?: string;
  episodeNumber?: string;
  durationSeconds?: number;
  metadata?: Record<string, unknown>;
}

let lastPageKey = '';

export function trackGAEvent(name: string, params: Record<string, string | number | boolean | undefined> = {}): void {
  if (typeof window === 'undefined') return;
  try {
    const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
    if (!gtag) return;
    const cleanParams = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined));
    const uid = auth.currentUser?.uid;
    if (uid && !('user_id' in cleanParams)) cleanParams.user_id = uid;
    gtag('event', name, cleanParams);
  } catch {
    // GA must never affect the application.
  }
}

export async function trackEvent(event: AnalyticsEvent): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const user = auth.currentUser;
    const metadata: Record<string, unknown> = { ...(event.metadata || {}) };
    if (!metadata.page) metadata.page = window.location.pathname;
    if (!metadata.deviceType) {
      metadata.deviceType = window.matchMedia('(max-width: 767px)').matches
        ? 'mobile'
        : window.matchMedia('(max-width: 1100px)').matches ? 'tablet' : 'desktop';
    }
    if (!metadata.referrer && document.referrer) metadata.referrer = document.referrer.slice(0, 500);

    const payload: Record<string, unknown> = {
      ...event,
      metadata,
      sessionId: getSessionId(),
      createdAt: serverTimestamp(),
      clientTimestamp: Date.now(),
    };

    if (user?.uid) payload.uid = user.uid;
    if (user?.email) payload.userEmail = user.email;

    await addDoc(collection(db, 'analytics_events'), payload);
  } catch (error) {
    // Analytics must never break playback or navigation.
    console.warn('[Panda.fun analytics]', error);
  }
}

export function trackPageView(path: string): void {
  if (!path || path === lastPageKey) return;
  lastPageKey = path;
  void trackEvent({ type: 'page_view', path });
  trackGAEvent('page_view', {
    page_location: window.location.href,
    page_path: path,
    page_title: document.title,
  });
}

export function trackApiFailure(path: string, status?: number, code?: string): void {
  trackGAEvent('api_failure', { path, status, code });
  void trackEvent({ type: 'api_failure', path, metadata: { status, code } });
}

export function trackLogin(method: string): void {
  trackGAEvent('login', { method });
  void trackEvent({ type: 'login', metadata: { method } });
}

export function trackSignUp(method: string): void {
  trackGAEvent('sign_up', { method });
  void trackEvent({ type: 'sign_up', metadata: { method } });
}

export function getSessionId(): string {
  const key = 'panda_analytics_session';
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const value = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Date.now() + '-' + Math.random().toString(36).slice(2);
    sessionStorage.setItem(key, value);
    return value;
  } catch {
    return String(Date.now());
  }
}