export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'ready-to-install'
  | 'permission-required'
  | 'applying'
  | 'error';
export type UpdateSource = 'android' | 'web';

export interface AppUpdateState {
  status: UpdateStatus;
  source: UpdateSource;
  currentVersion: string | null;
  availableVersion?: string;
  availableVersionCode?: number;
  releaseNotes?: string;
  mandatory?: boolean;
  message?: string;
  lastChecked?: number;
  progressPercent?: number;
  downloadedBytes?: number;
  totalBytes?: number;
  verifiedSha256?: string;
}

export type AppUpdateEvent =
  | { type: 'version'; value: string | null }
  | { type: 'check-started' }
  | { type: 'handed-off'; message: string }
  | { type: 'up-to-date'; at: number }
  | { type: 'available'; at: number; versionName?: string; versionCode?: number; releaseNotes?: string; mandatory?: boolean; sha256?: string }
  | { type: 'applying' }
  | { type: 'download-progress'; percent: number; downloadedBytes: number; totalBytes: number }
  | { type: 'ready-to-install'; at: number; sha256?: string }
  | { type: 'permission-required'; message?: string }
  | { type: 'later' }
  | { type: 'error'; at: number; message?: string };

export function initialUpdateState(source: UpdateSource): AppUpdateState {
  return { status: 'idle', source, currentVersion: null };
}

export function updateReducer(state: AppUpdateState, event: AppUpdateEvent): AppUpdateState {
  switch (event.type) {
    case 'version':
      return { ...state, currentVersion: event.value };
    case 'check-started':
      return { ...state, status: 'checking', message: undefined };
    case 'handed-off':
      return { ...state, status: 'idle', message: event.message };
    case 'up-to-date':
      return { ...state, status: 'up-to-date', message: undefined, availableVersion: undefined, releaseNotes: undefined, lastChecked: event.at };
    case 'available':
      return {
        ...state,
        status: 'available',
        message: undefined,
        availableVersion: event.versionName,
        availableVersionCode: event.versionCode,
        releaseNotes: event.releaseNotes,
        mandatory: event.mandatory,
        verifiedSha256: event.sha256,
        progressPercent: undefined,
        downloadedBytes: undefined,
        totalBytes: undefined,
        lastChecked: event.at,
      };
    case 'applying':
      return { ...state, status: 'applying', message: undefined };
    case 'download-progress':
      return {
        ...state,
        status: 'downloading',
        progressPercent: Math.max(0, Math.min(100, event.percent)),
        downloadedBytes: Math.max(0, event.downloadedBytes),
        totalBytes: Math.max(0, event.totalBytes),
      };
    case 'ready-to-install':
      return { ...state, status: 'ready-to-install', verifiedSha256: event.sha256 || state.verifiedSha256, progressPercent: 100, message: undefined };
    case 'permission-required':
      return { ...state, status: 'permission-required', message: event.message || 'Allow installs from this source to continue.' };
    case 'later':
      return { ...state, status: state.source === 'android' && state.verifiedSha256 ? 'ready-to-install' : 'idle', message: 'Update postponed.' };
    case 'error':
      return { ...state, status: 'error', message: event.message || 'Something went wrong while checking for updates.', lastChecked: event.at };
    default:
      return state;
  }
}

export function statusMessage(state: AppUpdateState): string {
  switch (state.status) {
    case 'checking': return 'Checking for updates…';
    case 'up-to-date': return "You're on the latest version.";
    case 'available': return state.availableVersion ? `Version ${state.availableVersion} is available.` : 'A new version is available.';
    case 'downloading':
    case 'applying': return state.source === 'android' ? 'Downloading the update…' : 'Updating Panda.fun…';
    case 'ready-to-install': return 'The download is verified and ready to install.';
    case 'permission-required': return state.message || 'Allow installs from this source to continue.';
    case 'error': return state.message || 'Something went wrong while checking for updates.';
    default: return state.message || 'Check whether a newer version of Panda.fun is available.';
  }
}

export function parseNativeStatus(detail: unknown, now: number): AppUpdateEvent | null {
  if (!detail || typeof detail !== 'object') return null;
  const d = detail as Record<string, unknown>;
  const str = (v: unknown) => typeof v === 'string' && v.trim() ? v : undefined;
  switch (d.status) {
    case 'checking': return { type: 'check-started' };
    case 'up-to-date': return { type: 'up-to-date', at: now };
    case 'available':
      return {
        type: 'available',
        at: now,
        versionName: str(d.versionName),
        versionCode: typeof d.versionCode === 'number' ? d.versionCode : undefined,
        releaseNotes: str(d.releaseNotes),
        mandatory: d.mandatory === true,
        sha256: str(d.sha256),
      };
    case 'downloading':
      return {
        type: 'download-progress',
        percent: typeof d.percent === 'number' ? d.percent : 0,
        downloadedBytes: typeof d.downloadedBytes === 'number' ? d.downloadedBytes : 0,
        totalBytes: typeof d.totalBytes === 'number' ? d.totalBytes : 0,
      };
    case 'ready-to-install': return { type: 'ready-to-install', at: now, sha256: str(d.sha256) };
    case 'permission-required': return { type: 'permission-required', message: str(d.message) };
    case 'error': return { type: 'error', at: now, message: str(d.message) };
    default: return null;
  }
}
