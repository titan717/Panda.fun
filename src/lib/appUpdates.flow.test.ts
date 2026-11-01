import { describe, expect, it, vi } from 'vitest';
import { runUpdateApply, runUpdateCheck, UPDATE_MESSAGES } from './appUpdates';
import type { AppUpdateEvent } from './appUpdateState';

function env(overrides: Record<string, unknown> = {}) {
  const events: AppUpdateEvent[] = [];
  return {
    events,
    base: {
      bridge: null,
      online: true,
      dispatch: (event: AppUpdateEvent) => events.push(event),
      startNativeTimer: vi.fn(),
      clearTimer: vi.fn(),
      ...overrides,
    },
  };
}

describe('update check flow', () => {
  it('reports offline before touching the network', async () => {
    const checkWeb = vi.fn();
    const { events, base } = env({ online: false });
    await runUpdateCheck({ ...base, checkWeb } as never);
    expect(checkWeb).not.toHaveBeenCalled();
    expect(events).toEqual([expect.objectContaining({ type: 'error', message: UPDATE_MESSAGES.offline })]);
  });

  it('maps web results to up-to-date, available, neutral browser-managed and error', async () => {
    for (const [result, type] of [['up-to-date', 'up-to-date'], ['available', 'available'], ['unsupported', 'handed-off'], ['error', 'error']] as const) {
      const { events, base } = env();
      await runUpdateCheck({ ...base, checkWeb: async () => result } as never);
      expect(events.map(event => event.type)).toEqual(['check-started', type]);
    }
  });

  it('treats a throwing web check as a recoverable error', async () => {
    const { events, base } = env();
    await runUpdateCheck({ ...base, checkWeb: async () => { throw new Error('boom'); } } as never);
    expect(events.at(-1)).toEqual(expect.objectContaining({ type: 'error', message: UPDATE_MESSAGES.webFailed }));
  });

  it('arms a timeout for the native manual check and surfaces bridge exceptions', async () => {
    const ok = env({ bridge: { checkForUpdates: vi.fn(), checkForUpdatesManual: vi.fn() } });
    await runUpdateCheck({ ...ok.base, checkWeb: vi.fn() } as never);
    expect(ok.base.startNativeTimer).toHaveBeenCalledWith(UPDATE_MESSAGES.nativeTimeout);

    const broken = env({ bridge: { checkForUpdates: vi.fn(), checkForUpdatesManual: () => { throw new Error('bridge gone'); } } });
    await runUpdateCheck({ ...broken.base, checkWeb: vi.fn() } as never);
    expect(broken.base.clearTimer).toHaveBeenCalled();
    expect(broken.events.at(-1)).toEqual(expect.objectContaining({ type: 'error', message: UPDATE_MESSAGES.nativeFailed }));
  });
});

describe('update apply flow', () => {
  it('does not leave older APKs stuck on "Downloading"', async () => {
    const legacy = env({ bridge: { checkForUpdates: vi.fn() } });
    await runUpdateApply({ ...legacy.base, applyWeb: vi.fn() } as never);
    expect(legacy.events.map(event => event.type)).toEqual(['applying', 'handed-off']);
  });

  it('arms a download-start timeout on current APKs', async () => {
    const current = env({ bridge: { checkForUpdates: vi.fn(), downloadUpdate: vi.fn() } });
    await runUpdateApply({ ...current.base, applyWeb: vi.fn() } as never);
    expect(current.base.startNativeTimer).toHaveBeenCalledWith(UPDATE_MESSAGES.downloadTimeout);
  });

  it('recovers when the web update fails or the device is offline', async () => {
    const failing = env();
    await runUpdateApply({ ...failing.base, applyWeb: async () => { throw new Error('no worker'); } } as never);
    expect(failing.events.at(-1)).toEqual(expect.objectContaining({ type: 'error', message: UPDATE_MESSAGES.applyFailed }));

    const offline = env({ online: false });
    await runUpdateApply({ ...offline.base, applyWeb: vi.fn() } as never);
    expect(offline.events).toEqual([expect.objectContaining({ type: 'error', message: UPDATE_MESSAGES.offline })]);
  });
});
