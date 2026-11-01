import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Android update bridge contract', () => {
  const main = readFileSync(new URL('../../android/app/src/main/java/com/kinoma/tv/ui/MainActivity.kt', import.meta.url), 'utf8');
  const checker = readFileSync(new URL('../../android/app/src/main/java/com/kinoma/tv/data/UpdateChecker.kt', import.meta.url), 'utf8');
  const server = readFileSync(new URL('../../server.ts', import.meta.url), 'utf8');
  const manifest = JSON.parse(readFileSync(new URL('../../update/latest.json', import.meta.url), 'utf8'));

  it('exposes manual check and download to the web Settings page', () => {
    expect(main).toContain('fun checkForUpdatesManual()');
    expect(main).toContain('fun downloadUpdate()');
    expect(main).toContain('panda_native_update_status');
    expect(main).toContain('kinoma_update_progress');
    expect(main).toContain('fun cancelUpdateDownload()');
    expect(main).toContain('fun getAppVersion()');
  });

  it('reports every status the web state machine understands', () => {
    for (const status of ['checking', 'available', 'up-to-date', 'downloading', 'ready-to-install', 'permission-required', 'error']) {
      expect(main).toContain('"' + status + '"');
    }
  });

  it('keeps the background check silent and lets Settings see failures', () => {
    expect(checker).toContain('suspend fun checkForUpdateOrThrow()');
    expect(checker).toContain('suspend fun checkForUpdate(');
    expect(checker).toContain('e.printStackTrace()');
  });

  it('uses the branded download name and streams byte progress', () => {
    expect(checker).toContain('Panda.fun-update.apk');
    expect(checker).toContain('onProgress: (Int, Long, Long) -> Unit');
    expect(checker).toContain('cancelledDownloadId == downloadId');
    expect(main).toContain('emitUpdateProgress(percent, downloadedBytes, totalBytes)');
  });

  it('still verifies the checksum before installing and requires user confirmation', () => {
    expect(checker).toContain('verifySha256(destination, expectedSha256)');
    expect(main).not.toContain('AlertDialog.Builder');
    expect(main).toContain('emitUpdateStatus("ready-to-install", update)');
    expect(main).toContain('fun installUpdate()');
    expect(main).toContain('fun openInstallPermissionSettings()');
  });
});


describe('production APK release safety', () => {
  it('compares Android versionCode monotonically and separates stable from beta channels', () => {
    expect(checker).toContain('installedIsPrerelease');
    expect(checker).toContain('updateInfo.channel == "stable" && !updateInfo.prerelease');
    expect(checker).toContain('updateInfo.channel == "beta" && updateInfo.prerelease');
    expect(checker).toContain('updateInfo.latestVersionCode < BuildConfig.VERSION_CODE');
    expect(checker).toContain('updateInfo.latestVersionCode == BuildConfig.VERSION_CODE');
    expect(checker).toContain('expectedApkName');
  });

  it('does not expose the currently published beta manifest as a stable production update', () => {
    expect(manifest.channel).toBe('beta');
    expect(manifest.prerelease).toBe(true);
    expect(server).toContain("app.get('/update/latest.json'");
    expect(server).toContain("manifest.channel === 'stable' && manifest.prerelease === false");
    expect(server).toContain('No verified stable Panda.fun production release has been published yet.');
    expect(server).toContain('Panda.fun-Android-TV\\\\.apk');
    expect(server).not.toContain('Panda.fun-Android-TV(?:-beta)?\\\\.apk');
  });

  it('keeps native update prompts inside the WebView instead of native dialogs', () => {
    expect(main).not.toContain('AlertDialog');
    expect(main).not.toContain('ProgressDialog');
    expect(main).toContain('kinoma_update_progress');
    expect(main).toContain('panda_native_update_status');
  });
});
