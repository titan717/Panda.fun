import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const activity = readFileSync(new URL('../../android/app/src/main/java/com/kinoma/tv/ui/MainActivity.kt', import.meta.url), 'utf8');
const manifest = readFileSync(new URL('../../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
const theme = readFileSync(new URL('../../android/app/src/main/res/values/themes.xml', import.meta.url), 'utf8');

describe('installed app launch and recovery contract', () => {
  it('routes native and standalone root launches directly to Home without replacing the web Landing page', () => {
    expect(app).toContain('function isInstalledAppShell()');
    expect(app).toContain("setLocation('/home', { replace: true })");
    expect(app).toContain('nativeBridge || standalone');
    expect(app).toContain('return isInstalledAppShell() ? <Layout><Home /></Layout> : <Landing />');
    expect(app).toContain('if (showIntro)');
    expect(app).toContain("const [showIntro, setShowIntro] = useState(() => location === '/' && shouldShowPandaIntro())");
    expect(app).toContain('shouldShowPandaIntro');
  });

  it('starts Android WebView at /home and never locks MainActivity orientation', () => {
    expect(activity).toContain('WEB_ENTRY_URL = "https://$APP_DOMAIN/home"');
    const mainActivity = (manifest.split('<activity').find(section => section.includes('android:name=".ui.MainActivity"')) || '').split('</activity>')[0];
    expect(mainActivity).not.toContain('android:screenOrientation');
    expect(manifest).toContain('android:screenOrientation="landscape"'); // PlayerActivity only.
  });

  it('shows a branded offline/retry surface and recreates a crashed WebView before retrying', () => {
    expect(activity).toContain('showDiagnosticScreen("offline"');
    expect(activity).toContain('diagnosticText.text = "Panda.fun');
    expect(activity).toContain('retryFromOfflineScreen()');
    expect(activity).toContain('if (webViewCrashed)');
    expect(activity).toContain('WebView whose renderer exited cannot be reused');
  });

  it('keeps Android TV detection truthful and uses the branded splash on launch', () => {
    expect(activity).toContain('return isTelevisionDevice()');
    expect(activity).toContain('if (isTelevisionDevice())');
    expect(activity).not.toContain('(Android TV; Leanback; SmartTV)"');
    expect(activity).toContain('installSplashScreen()');
    expect(manifest).toContain('@style/Theme.KinomaTV.Splash');
    expect(theme).toContain('windowSplashScreenBackground');
    expect(theme).toContain('@drawable/panda_splash_background');
  });
});
