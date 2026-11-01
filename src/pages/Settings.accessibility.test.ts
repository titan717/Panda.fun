import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const settings = readFileSync(new URL('./Settings.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./settings-page.css', import.meta.url), 'utf8');

describe('mobile-first Settings page', () => {
  it('uses one grouped page and keeps the app update module inline', () => {
    expect(settings).toContain('panda-settings-v3__surface');
    expect(settings).toContain('<AppUpdatesCard />');
    expect(settings).not.toContain('openSettingsModal');
    for (const heading of ['Appearance', 'Playback', 'Library & storage', 'Updates', 'About']) {
      expect(settings).toContain(heading);
    }
  });

  it('keeps existing player preferences and exposes labelled inline switches', () => {
    expect(settings).toContain('playerSettings.autoPlay');
    expect(settings).toContain("updatePlayerSetting('autoPlay'");
    expect(settings).toContain('role="switch"');
    expect(settings).toContain('aria-checked={checked}');
    expect(settings).toContain('aria-label={label}');
    expect(settings).toContain('aria-pressed={playerSettings.preferredAudio');
  });

  it('preserves onboarding replay and the hidden panda x3 developer tools', () => {
    expect(settings).toContain("panda_dev_replay_onboarding");
    expect(settings).toContain("pandaBufferRef.current === 'panda'");
    expect(settings).toContain('pandaCountRef.current >= 3');
    expect(settings).toContain('panda_dev_reset_onboarding');
  });

  it('has visible keyboard focus, large touch targets and reduced-motion support', () => {
    expect(styles).toContain(':focus-visible');
    expect(styles).toContain('min-height: 44px');
    expect(styles).toContain('prefers-reduced-motion: reduce');
  });

  it('provides non-modal About links for Terms and Privacy', () => {
    expect(settings).toContain('href="/terms"');
    expect(settings).toContain('href="/privacy-policy"');
    expect(settings).toContain('Panda.fun');
  });
});
