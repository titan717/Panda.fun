import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { getDeviceMode } from './deviceCapabilities';

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');
const app = read('../App.tsx');
const activity = read('../../android/app/src/main/java/com/kinoma/tv/ui/MainActivity.kt');
const styles = read('../index.css');
const mobileHome = read('../pages/MobileHome.tsx');
const mobileHomeStyles = read('../pages/mobile-home.css');
const homePage = read('../pages/Home.tsx');

describe('universal device capability selection', () => {
  it('prioritizes native TV capability at any viewport size', () => {
    expect(getDeviceMode({ nativeTv: true, viewportWidth: 390, hasTouch: true })).toBe('tv');
    expect(getDeviceMode({ nativeTv: true, viewportWidth: 1600, hasTouch: false })).toBe('tv');
  });

  it('selects mobile for compact touch-first devices', () => {
    expect(getDeviceMode({ nativeTv: false, viewportWidth: 390, hasTouch: true })).toBe('mobile');
    expect(getDeviceMode({ viewportWidth: 767, coarsePointer: true })).toBe('mobile');
  });

  it('selects tablet for wider touch-first devices', () => {
    expect(getDeviceMode({ viewportWidth: 768, maxTouchPoints: 5 })).toBe('tablet');
    expect(getDeviceMode({ viewportWidth: 1024, hasTouch: true })).toBe('tablet');
  });

  it('keeps pointer-first environments in desktop mode regardless of narrow width', () => {
    expect(getDeviceMode({ nativeTv: false, viewportWidth: 390, hasTouch: false })).toBe('desktop');
    expect(getDeviceMode({ viewportWidth: 1440, hasTouch: false })).toBe('desktop');
  });

  it('uses a safe desktop fallback for missing or invalid viewport measurements', () => {
    expect(getDeviceMode({})).toBe('desktop');
    expect(getDeviceMode({ viewportWidth: Number.NaN, hasTouch: true })).toBe('desktop');
    expect(getDeviceMode({ viewportWidth: -1, hasTouch: true })).toBe('desktop');
  });
});

describe('universal Android manifest contract', () => {
  const manifest = read('../../android/app/src/main/AndroidManifest.xml');

  it('allows both touchscreen Android and Android TV installation', () => {
    expect(manifest).toMatch(/android\.software\.leanback[\s\S]*?android:required="false"/);
    expect(manifest).toMatch(/android\.hardware\.touchscreen[\s\S]*?android:required="false"/);
    expect(manifest).toContain('android.intent.category.LEANBACK_LAUNCHER');
    expect(manifest).toContain('android.intent.category.LAUNCHER');
  });

  it('does not force the main activity into landscape', () => {
    const mainActivity = manifest.match(/<activity[\s\S]*?android:name="\.ui\.MainActivity"[\s\S]*?<\/activity>/)?.[0] ?? '';
    expect(mainActivity).not.toContain('android:screenOrientation="landscape"');
  });

  it('uses Thinking Orbs rather than poster skeletons while the mobile hero loads', () => {
    expect(mobileHome).toContain('<ThinkingOrb state="searching"');
    expect(mobileHome).toContain('role="status" aria-live="polite"');
    expect(mobileHomeStyles).toContain('.panda-mobile-featured__loading > canvas');
    expect(mobileHomeStyles).not.toContain('.panda-mobile-featured__loading span {');
  });

  it('keeps the mobile featured area a cinematic spotlight, not a portrait card', () => {
    expect(mobileHomeStyles).toContain('.panda-mobile-featured__spotlight');
    expect(mobileHomeStyles).toContain('.panda-mobile-featured__art');
    expect(mobileHomeStyles).not.toContain('aspect-ratio: 4 / 5;');
  });

  it('passes real loading/error state into the mobile homepage and has an empty state', () => {
    expect(homePage).toContain('loading={!home && !error} error={error}');
    expect(mobileHome).toContain(') : loading ? (');
    expect(mobileHome).toContain('Your next watch is waiting.');
    expect(mobileHomeStyles).toContain('.panda-mobile-featured__empty');
  });

  it('uses Thinking Orbs for the accessible route loading state', () => {
    expect(app).toContain('<ThinkingOrb state="searching"');
    expect(app).toContain('className="panda-route-loading');
    expect(styles).toContain('.panda-route-loading');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('keeps native TV mode truthful and gates directional navigation', () => {
    expect(activity).toContain('return isTelevisionDevice()');
    expect(activity).not.toContain("localStorage.setItem('kinoma_tv_mode', 'true')");
    expect(activity).not.toContain('window.isKinomaAndroidTV = true;');
    expect(app).toContain("if (getCurrentDeviceMode() !== 'tv') return;");
  });

});
