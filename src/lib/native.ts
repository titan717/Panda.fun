/** Bridge exposed by the Android wrapper (android/app/src/main/java/com/kinoma/tv/ui/MainActivity.kt). */
export interface NativeBridge {
  getAppVersion(): string;
  getVersionCode?(): number;
  isTV(): boolean;
  checkForUpdatesManual(): void;
  downloadUpdate(): void;
  installDownloadedUpdate?(): void;
  exitApp?(): void;
  hasVoiceSearch?(): boolean;
  startVoiceSearch?(): void;
  /** v1.1.7 notifications: "granted" | "denied" | "default". */
  notificationPermission?(): string;
  requestNotificationPermission?(): void;
  showNotification?(tag: string, title: string, body: string, path: string): void;
  takeLaunchPath?(): string;
  /** v1.1.7 ad shield: JSON {events:[{source,kind,host}]} drained since the last call. */
  shieldStats?(): string;
  setShieldSource?(id: string): void;
  /** v1.2.2 picture-in-picture (Android 8+ phones and tablets). */
  canPictureInPicture?(): boolean;
  setPlaybackActive?(active: boolean, auto: boolean): void;
  enterPictureInPicture?(): boolean;
}

declare global {
  interface Window { KinomaNative?: NativeBridge; __pandaVoice?: (text: string) => void; __pandaPip?: (on: boolean) => void }
}

export const native: NativeBridge | null = typeof window !== "undefined" && window.KinomaNative ? window.KinomaNative : null;
export const isAndroidApp = Boolean(native);

export function nativeVersion(): string | null {
  try { return native?.getAppVersion() ?? null; } catch { return null; }
}

export function nativeIsTV(): boolean {
  try { return native?.isTV() ?? false; } catch { return false; }
}

export function exitApp() {
  try { native?.exitApp?.(); } catch { /* not available */ }
}

