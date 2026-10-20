import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('universal app documentation contract', () => {
  it('documents universal launcher intent, device adaptation and the playback boundary', () => {
    const readme = read('../../README.md');
    expect(readme).toContain('Universal Android app (TV, phone and tablet)');
    expect(readme).toContain('ordinary Android launcher');
    expect(readme).toContain('Leanback launcher');
    expect(readme).toContain('native Android TV UI mode');
    expect(readme).toContain('Vidy embed URL behavior');
    expect(readme).toContain('device-level compatibility');
  });

  it('documents the actual available web verification commands', () => {
    const readme = read('../../README.md');
    for (const command of ['npm run lint', 'npm test', 'npm run build']) {
      expect(readme).toContain(command);
    }
  });
});
