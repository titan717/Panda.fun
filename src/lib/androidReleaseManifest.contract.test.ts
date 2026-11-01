import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../../update/latest.json', import.meta.url), 'utf8'));
const checker = readFileSync(new URL('../../android/app/src/main/java/com/kinoma/tv/data/UpdateChecker.kt', import.meta.url), 'utf8');
const server = readFileSync(new URL('../../server.ts', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../../.github/workflows/build-apk.yml', import.meta.url), 'utf8');
const gradle = readFileSync(new URL('../../android/app/build.gradle', import.meta.url), 'utf8');

describe('Android stable update release contract', () => {
  it('keeps a parseable HTTPS APK manifest with a real SHA-256 and monotonic version code', () => {
    expect(manifest.latestVersionCode).toBeGreaterThan(0);
    expect(manifest.latestVersionName).toMatch(/^\\d+\\.\\d+\\.\\d+(?:-[a-z0-9.]+)?$/i);
    expect(manifest.apkUrl).toMatch(/^https:\\/\\//);
    expect(manifest.apkUrl).toMatch(/\\.apk$/);
    expect(manifest.sha256).toMatch(/^[a-f0-9]{64}$/i);
    expect(['stable', 'beta']).toContain(manifest.channel);
    expect(typeof manifest.prerelease).toBe('boolean');
  });

  it('offers only stable non-prerelease builds and compares numeric version codes', () => {
    expect(checker).toContain('updateInfo.channel == "stable" && !updateInfo.prerelease');
    expect(checker).toContain('updateInfo.latestVersionCode > BuildConfig.VERSION_CODE');
    expect(checker).toContain('Update manifest checksum is invalid.');
  });

  it('publishes the same signed APK filename, size and checksum through the stable workflow', () => {
    expect(workflow).toContain('Panda.fun-Android-TV.apk');
    expect(workflow).toContain('APK_SIZE_BYTES');
    expect(workflow).toContain('"sizeBytes": int(os.environ["APK_SIZE_BYTES"])');
    expect(workflow).toContain('"channel": "stable"');
    expect(workflow).toContain('"prerelease": False');
    expect(gradle).toContain('versionCode kinomaVersionCode');
    expect(gradle).toContain('versionName kinomaVersionName');
  });

  it('never falls back to a fake manifest or a placeholder APK', () => {
    expect(server).toContain('No verified Panda.fun release manifest has been published yet.');
    expect(server).toContain('/releases/latest/download/Panda.fun-Android-TV.apk');
    expect(server).not.toContain('sha256: \'PENDING\'');
    expect(server).not.toContain('Panda.fun.apk binary v1.0.0');
  });
});
