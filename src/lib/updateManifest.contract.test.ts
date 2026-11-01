import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Panda.fun Android update manifest contract', () => {
  const manifest = JSON.parse(readFileSync(new URL('../../update/latest.json', import.meta.url), 'utf8'));
  const server = readFileSync(new URL('../../server.ts', import.meta.url), 'utf8');
  const checker = readFileSync(new URL('../../android/app/src/main/java/com/kinoma/tv/data/UpdateChecker.kt', import.meta.url), 'utf8');

  it('contains a monotonic version, a complete checksum and a supported release channel', () => {
    expect(manifest.latestVersionCode).toBeGreaterThan(0);
    expect(manifest.latestVersionName).toBeTruthy();
    expect(manifest.sizeBytes).toBeGreaterThan(0);
    expect(manifest.sha256).toMatch(/^[a-f0-9]{64}$/i);
    expect(['stable', 'beta']).toContain(manifest.channel);
    expect(manifest.prerelease).toBe(manifest.channel === 'beta');
  });

  it('points to the correctly named GitHub release APK and the server supports the short download URL', () => {
    expect(manifest.apkUrl).toContain('/releases/download/' + manifest.releaseTag + '/');
    expect(manifest.apkUrl).toMatch(/Panda\.fun-Android-TV(?:-beta)?\.apk$/);
    expect(server).toContain("'/update/latest.json'");
    expect(server).toContain("app.get('/downloads/Panda.fun.apk'");
    expect(server).toContain('validReleaseAsset');
  });

  it('never offers beta updates to stable installs and compares Android version codes numerically', () => {
    expect(checker).toContain('BuildConfig.VERSION_NAME.contains("beta"');
    expect(checker).toContain('updateInfo.channel == "stable" && !updateInfo.prerelease');
    expect(checker).toContain('updateInfo.latestVersionCode < BuildConfig.VERSION_CODE');
    expect(checker).toContain('updateInfo.latestVersionCode == BuildConfig.VERSION_CODE');
  });
});
