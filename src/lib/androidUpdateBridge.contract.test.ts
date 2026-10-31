import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Android update bridge contract', () => {
  const main = readFileSync(new URL('../../android/app/src/main/java/com/kinoma/tv/ui/MainActivity.kt', import.meta.url), 'utf8');
  const checker = readFileSync(new URL('../../android/app/src/main/java/com/kinoma/tv/data/UpdateChecker.kt', import.meta.url), 'utf8');

  it('exposes manual check and download to the web Settings page', () => {
    expect(main).toContain('fun checkForUpdatesManual()');
    expect(main).toContain('fun downloadUpdate()');
    expect(main).toContain('panda_native_update_status');
    expect(main).toContain('fun getAppVersion()');
  });

  it('reports every status the web state machine understands', () => {
    for (const status of ['checking', 'available', 'up-to-date', 'downloading', 'error']) {
      expect(main).toContain('"' + status + '"');
    }
  });

  it('keeps the background check silent and lets Settings see failures', () => {
    expect(checker).toContain('suspend fun checkForUpdateOrThrow()');
    expect(checker).toContain('suspend fun checkForUpdate(');
    expect(checker).toContain('e.printStackTrace()');
  });

  it('still verifies the checksum before installing and requires user confirmation', () => {
    expect(checker).toContain('verifySha256(destination, expectedSha256)');
    expect(main).toContain('Update Now');
  });
});
