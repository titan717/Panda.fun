import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Android edge-to-edge and player system bars', () => {
  const activity = readFileSync(new URL('../../android/app/src/main/java/com/kinoma/tv/ui/MainActivity.kt', import.meta.url), 'utf8');
  const manifest = readFileSync(new URL('../../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
  const layout = readFileSync(new URL('../components/Layout.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../components/mobile/mobile-shell.css', import.meta.url), 'utf8');
  const player = readFileSync(new URL('../pages/Watch.tsx', import.meta.url), 'utf8');

  it('uses transparent edge-to-edge bars and forwards native insets to CSS', () => {
    expect(activity).toContain('WindowCompat.setDecorFitsSystemWindows(window, false)');
    expect(activity).toContain('window.statusBarColor = Color.TRANSPARENT');
    expect(activity).toContain('window.navigationBarColor = Color.TRANSPARENT');
    expect(activity).toContain("'--safe-top'");
    expect(activity).toContain("'--safe-bottom'");
    expect(activity).toContain("'--keyboard-bottom'");
  });

  it('hides three-button navigation when possible and keeps gesture navigation clear', () => {
    expect(activity).toContain('private fun isGestureNavigation()');
    expect(activity).toContain('systemNavFallback');
    expect(activity).toContain('WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE');
    expect(css).toContain('var(--safe-bottom, 0px)');
    expect(css).toContain('.system-nav-visible .panda-mobile-bottom-nav');
  });

  it('restores system navigation for the SPA player route without changing player orientation', () => {
    expect(layout).toContain('native?.setPlayerPage?.(isPlayerRoute)');
    expect(activity).toContain('fun setPlayerPage(isPlayer: Boolean)');
    expect(player).toContain('paddingTop: "var(--safe-top, 0px)"');
    expect(player).toContain('paddingBottom: "var(--safe-bottom, 0px)"');
    expect(manifest).toContain('android:screenOrientation="landscape"');
    expect(manifest).toContain('android:name=".ui.PlayerActivity"');
  });
});
