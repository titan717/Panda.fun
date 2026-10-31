export type UpdateStatus = 'idle' | 'checking' | 'up-to-date' | 'available' | 'applying' | 'downloaded' | 'error';
export type UpdateSource = 'android' | 'web';

export interface AppUpdateState {
  status: UpdateStatus;
  source: UpdateSource;
  currentVersion: string | null;
  availableVersion?: string;
  releaseNotes?: string;
  mandatory?: boolean;
  message?: string;
  lastChecked?: number;
}

export type AppUpdateEvent =
  | { type: 'version'; value: string | null }
  | { type: 'check-started' }
  | { type: 'handed-off'; message: string }
  | { type: 'up-to-date'; at: number }
  | { type: 'available'; at: number; versionName?: string; releaseNotes?: string; mandatory?: boolean }
  | { type: 'applying' }
  | { type: 'downloaded'; at: number; versionName?: string }
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
        releaseNotes: event.releaseNotes,
        mandatory: event.mandatory,
        lastChecked: event.at,
      };
    case 'applying':
      return { ...state, status: 'applying', message: undefined };
    case 'downloaded':
      return { ...state, status: 'downloaded', availableVersion: event.versionName, message: undefined, lastChecked: event.at };
    case 'error':
      return { ...state, status: 'error', message: event.message || 'Something went wrong while checking for updates.', lastChecked: event.at };
    default:
      return state;
  }
}

/** Plain-language status line, also used for the aria-live announcement. */
export function statusMessage(state: AppUpdateState): string {
  switch (state.status) {
    case 'checking':
      return 'Checking for updates…';
    case 'up-to-date':
      return "You're on the latest version.";
    case 'available':
      return state.availableVersion
        ? `Version ${state.availableVersion} is available.`
        : 'A new version is available.';
    case 'applying':
      return state.source === 'android' ? 'Downloading the update…' : 'Updating Panda.fun…';
    case 'downloaded':
      return 'Update downloaded. Follow the Android installer prompt to finish.';
    case 'error':
      return state.message || 'Something went wrong while checking for updates.';
    default:
      return state.message || 'Check whether a newer version of Panda.fun is available.';
  }
}

/** Validates the CustomEvent detail sent by the Android app. */
export function parseNativeStatus(detail: unknown, now: number): AppUpdateEvent | null {
  if (!detail || typeof detail !== 'object') return null;
  const d = detail as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined);
  switch (d.status) {
    case 'checking':
      return { type: 'check-started' };
    case 'up-to-date':
      return { type: 'up-to-date', at: now };
    case 'available':
      return {
        type: 'available',
        at: now,
        versionName: str(d.versionName),
        releaseNotes: str(d.releaseNotes),
        mandatory: d.mandatory === true,
      };
    case 'downloading':
      return { type: 'applying' };
    case 'downloaded':
      return { type: 'downloaded', at: now, versionName: str(d.versionName) };
    case 'error':
      return { type: 'error', at: now, message: str(d.message) };
    default:
      return null;
  }
}

/** Only terminal responses end a native Settings update check. */
export function isTerminalNativeUpdateEvent(event: AppUpdateEvent): boolean {
  return event.type === 'available' || event.type === 'up-to-date' || event.type === 'downloaded' || event.type === 'error';
}
