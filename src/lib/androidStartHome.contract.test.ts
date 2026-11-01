import { readFileSync } from 'node:fs';

describe('installed app launch routing', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const activity = readFileSync(new URL('../../android/app/src/main/java/com/kinoma/tv/ui/MainActivity.kt', import.meta.url), 'utf8');

  it('routes native and standalone app launches from root to Home', () => {
    expect(app).toContain('function isInstalledAppShell()');
    expect(app).toContain('setLocation(\'/home\')');
    expect(app).toContain('nativeBridge || standalone');
  });

  it('starts the Android WebView at the Home route', () => {
    expect(activity).toContain('WEB_ENTRY_URL = "https://$APP_DOMAIN/home"');
  });

  it('keeps the marketing Landing route available to ordinary web visitors', () => {
    expect(app).toContain('if (location === \'/\') return <Landing />');
  });
});
