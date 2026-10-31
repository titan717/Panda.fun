import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('modal keyboard accessibility', () => {
  const trap = readFileSync(new URL('./useModalFocusTrap.ts', import.meta.url), 'utf8');
  const settings = readFileSync(new URL('../components/ui/SettingsModal.tsx', import.meta.url), 'utf8');
  const auth = readFileSync(new URL('../components/ui/AuthModal.tsx', import.meta.url), 'utf8');
  const pageSettings = readFileSync(new URL('../pages/Settings.tsx', import.meta.url), 'utf8');

  it('traps Tab and Shift+Tab, closes on Escape and restores previous focus', () => {
    expect(trap).toContain("event.key === 'Escape'");
    expect(trap).toContain("event.key !== 'Tab'");
    expect(trap).toContain('previouslyFocused.focus');
    expect(trap).toContain('document.addEventListener');
  });

  it('labels the settings and authentication modals and activates the shared focus trap', () => {
    for (const source of [settings, auth]) {
      expect(source).toContain('role="dialog"');
      expect(source).toContain('aria-modal="true"');
      expect(source).toContain('useModalFocusTrap');
    }
  });

  it('keeps the hidden developer tools dialog keyboard-contained too', () => {
    expect(pageSettings).toContain('useModalFocusTrap');
    expect(pageSettings).toContain('aria-modal="true"');
  });
});
