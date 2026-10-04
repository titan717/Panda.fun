import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

export type AnalyticsEventType =
  | 'page_view'
  | 'watch_start'
  | 'watch_progress'
  | 'watch_complete'
  | 'search'
  | 'anime_open'
  | 'episode_start'
  | 'library_action'
  | 'error'
  | 'api_failure';

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
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined)
    );
    gtag('event', name, cleanParams);
  } catch {
    // GA must never affect the application.
  }
}

export async function trackEvent(event: AnalyticsEvent): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await addDoc(collection(db, 'analytics_events'), {
      ...event,
      sessionId: getSessionId(),
      createdAt: serverTimestamp(),
      clientTimestamp: Date.now()
    });
  } catch (error) {
    // Analytics must never break playback or navigation.
    console.warn('[Kinoma analytics]', error);
  }
}

export function trackPageView(path: string): void {
  if (!path || path === lastPageKey) return;
  lastPageKey = path;
  void trackEvent({ type: 'page_view', path });
  trackGAEvent('page_view', {
    page_location: window.location.href,
    page_path: path,
    page_title: document.title
  });
}

export function trackApiFailure(path: string, status?: number, code?: string): void {
  trackGAEvent('api_failure', { path, status, code });
  void trackEvent({ type: 'api_failure', path, metadata: { status, code } });
}

export function getSessionId(): string {
  const key = 'kinoma_analytics_session';
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const value = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(key, value);
    return value;
  } catch {
    return `${Date.now()}`;
  }
}
