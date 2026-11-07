/** Bridge exposed by the Android wrapper (android/app/src/main/java/com/kinoma/tv/ui/MainActivity.kt). */
export interface NativeBridge {
  getAppVersion(): string;
  getVersionCode?(): number;
  isTV(): boolean;
  checkForUpdatesManual(): void;
  downloadUpdate(): void;
  installDownloadedUpdate?(): void;
  exitApp?(): void;
}

declare global {
  interface Window { KinomaNative?: NativeBridge }
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
