import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Settings app updates contract', () => {
  const card = readFileSync(new URL('./AppUpdatesCard.tsx', import.meta.url), 'utf8');
  const settings = readFileSync(new URL('../../pages/Settings.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('./AppUpdatesCard.css', import.meta.url), 'utf8');
  const hook = readFileSync(new URL('../../lib/appUpdates.ts', import.meta.url), 'utf8');

  it('is rendered on the Settings page', () => {
    expect(settings).toContain('<AppUpdatesCard />');
  });

  it('announces status politely and labels the section and update controls', () => {
    expect(card).toContain('role="status"');
    expect(card).toContain('aria-live="polite"');
    expect(card).toContain('aria-labelledby="panda-update-title"');
    expect(card).toContain('Check for updates');
    expect(card).toContain('Update now');
    expect(card).toContain('Install update');
    expect(card).toContain('Allow installs from this source');
  });

  it('never installs automatically: applying only happens from the user-pressed button', () => {
    expect(card).toContain("onClick={() => void apply()}");
    expect(card).toContain('onClick={install}');
    expect(hook).not.toMatch(/useEffect\([^)]*apply\(/s);
  });

  it('has visible focus, 44px targets and reduced-motion handling', () => {
    expect(css).toContain('.panda-update-module__button:focus-visible');
    expect(css).toContain('min-height: 46px');
    expect(css).toContain('prefers-reduced-motion: reduce');
  });

  it('talks to the Android bridge through the shared KinomaNative methods', () => {
    expect(hook).toContain('checkForUpdatesManual');
    expect(hook).toContain('downloadUpdate');
    expect(hook).toContain('kinoma_update_progress');
    expect(hook).toContain('cancelUpdateDownload');
    expect(hook).toContain('installUpdate');
    expect(hook).toContain('panda_native_update_status');
  });
});
