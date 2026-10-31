import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Settings app updates contract', () => {
  const card = readFileSync(new URL('./AppUpdatesCard.tsx', import.meta.url), 'utf8');
  const settings = readFileSync(new URL('../../pages/Settings.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');
  const hook = readFileSync(new URL('../../lib/appUpdates.ts', import.meta.url), 'utf8');

  it('is rendered on the Settings page', () => {
    expect(settings).toContain('<AppUpdatesCard />');
  });

  it('announces status politely and labels the section and busy state', () => {
    expect(card).toContain('role="status"');
    expect(card).toContain('aria-live="polite"');
    expect(card).toContain('aria-labelledby="panda-updates-title"');
    expect(card).toContain('aria-busy={busy}');
    expect(card).toContain('Check for updates');
    expect(card).toContain('Download update');
  });

  it('never installs automatically: applying only happens from the user-pressed button', () => {
    expect(card).toContain("onClick={() => void apply()}");
    expect(hook).not.toMatch(/useEffect\([^)]*apply\(/s);
  });

  it('has visible focus, 44px targets and reduced-motion handling', () => {
    expect(css).toContain('.panda-updates__button:focus-visible');
    expect(css).toContain('min-height:44px');
    expect(css).toMatch(/prefers-reduced-motion:reduce\) \{ \.panda-updates__spin/);
  });

  it('talks to the Android bridge through the shared KinomaNative methods', () => {
    expect(hook).toContain('checkForUpdatesManual');
    expect(hook).toContain('downloadUpdate');
    expect(hook).toContain('panda_native_update_status');
  });
});
