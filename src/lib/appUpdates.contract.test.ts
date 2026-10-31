import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Settings update action handling', () => {
  const source = readFileSync(new URL('./appUpdates.ts', import.meta.url), 'utf8');
  const card = readFileSync(new URL('../components/ui/AppUpdatesCard.tsx', import.meta.url), 'utf8');
  const state = readFileSync(new URL('./appUpdateState.ts', import.meta.url), 'utf8');

  it('keeps the native response timeout active through the intermediate checking event', () => {
    expect(source).toContain('if (isTerminalNativeUpdateEvent(parsed)) clearTimer()');
    expect(source).toContain('NATIVE_RESPONSE_TIMEOUT_MS');
    expect(source).toContain('The app did not respond. Please try again.');
  });

  it('turns thrown native and web check/apply failures into visible error state', () => {
    expect(source).toContain('catch (error)');
    expect(source).toContain("Couldn't check for updates. Check your connection and try again.");
    expect(source).toContain('The update could not be started. Please try again.');
    expect(card).toContain("state.status === 'error' ? 'Try again' : 'Check for updates'");
  });

  it('shows a completed download separately from an available download action', () => {
    expect(source).toContain("native.downloadUpdate()");
    expect(card).toContain("state.status === 'available' ? (");
    expect(card).toContain("state.status === 'downloaded'");
    expect(state).toContain('Update downloaded. Follow the Android installer prompt to finish.');
  });
});
