import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('installed app launch routing', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const activity = readFileSync(new URL('../../android/app/src/main/java/com/kinoma/tv/ui/MainActivity.kt', import.meta.url), 'utf8');

  it('routes native and standalone app launches from root to Home without a back-stack Landing entry', () => {
    expect(app).toContain('function isInstalledAppShell()');
    expect(app).toContain("setLocation('/home', { replace: true })");
    expect(app).toContain('nativeBridge || standalone');
    expect(activity).toContain('WEB_ENTRY_URL = "https://$APP_DOMAIN/home"');
  });

  it('keeps the marketing Landing route and first-run intro for ordinary web visitors', () => {
    expect(app).toContain('return isInstalledAppShell() ? <Layout><Home /></Layout> : <Landing />');
    expect(app).toContain('if (showIntro && !appShell)');
    expect(app).toContain('shouldShowPandaIntro');
  });

  it('shows a branded offline and retry surface on WebView main-frame failure', () => {
    expect(activity).toContain('showDiagnosticScreen("offline"');
    expect(activity).toContain('diagnosticText.text = "Panda.fun');
    expect(activity).toContain('retryFromOfflineScreen()');
    expect(activity).toContain('loadHomeOrShowOffline()');
    expect(activity).toContain('webView.visibility = View.GONE');
    expect(activity).toContain('webViewCrashed = true');
  });
});

  it('discards a crashed renderer and creates a fresh Activity/WebView on retry', () => {
    expect(activity).toContain('webViewCrashed = true');
    expect(activity).toContain('(view.parent as? ViewGroup)?.removeView(view)');
    expect(activity).toContain('view.destroy()');
    expect(activity).toContain('val restart = Intent(this, MainActivity::class.java)');
    expect(activity).toContain('if (::webView.isInitialized && !webViewCrashed) webView.destroy()');
  });
});
