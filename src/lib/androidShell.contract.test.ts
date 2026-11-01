import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../../android/app/src/main/java/com/kinoma/tv/ui/MainActivity.kt', import.meta.url), 'utf8');
const manifest = readFileSync(new URL('../../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
const themes = readFileSync(new URL('../../android/app/src/main/res/values/themes.xml', import.meta.url), 'utf8');
const gradle = readFileSync(new URL('../../android/app/build.gradle', import.meta.url), 'utf8');

describe('Panda.fun native Android shell contract', () => {
  it('keeps the existing application identity and player orientation contract', () => {
    expect(gradle).toContain('applicationId "com.kinoma.tv"');
    expect(manifest).toContain('android:name=".ui.PlayerActivity"');
    expect(manifest).toContain('android:screenOrientation="landscape"');
  });

  it('starts at Home and has a branded offline retry fallback', () => {
    expect(main).toContain('WEB_ENTRY_URL = "https://$APP_DOMAIN/home"');
    expect(main).toContain('private fun loadHomeOrShowOffline()');
    expect(main).toContain('private fun showDiagnosticScreen(');
    expect(main).toContain('text = "Retry"');
    expect(main).toContain('Panda.fun');
  });

  it('uses edge-to-edge native insets and distinguishes gesture from three-button navigation', () => {
    expect(main).toContain('WindowCompat.setDecorFitsSystemWindows(window, false)');
    expect(main).toContain('WindowInsetsCompat.Type.statusBars()');
    expect(main).toContain('WindowInsetsCompat.Type.navigationBars()');
    expect(main).toContain('WindowInsetsCompat.Type.mandatorySystemGestures()');
    expect(main).toContain("'--safe-top'");
    expect(main).toContain("'--safe-bottom'");
    expect(main).toContain('isGestureNavigation()');
    expect(main).toContain('controller.hide(WindowInsetsCompat.Type.navigationBars())');
    expect(main).toContain('controller.show(WindowInsetsCompat.Type.navigationBars())');
  });

  it('keeps TV detection explicit and player system bars restored', () => {
    expect(main).toContain('fun isTV(): Boolean');
    expect(main).toContain('Configuration.UI_MODE_TYPE_TELEVISION');
    expect(main).toContain('PackageManager.FEATURE_LEANBACK');
    expect(main).toContain('if (isPlayerPage || isGestureNavigation())');
  });

  it('uses near-black launch surfaces and disables light system bar icons', () => {
    expect(themes).toContain('@color/tv_background');
    expect(themes).toContain('android:windowLightStatusBar">false');
    expect(themes).toContain('android:windowLightNavigationBar">false');
    expect(themes).toContain('@drawable/panda_launcher_foreground');
  });
});
