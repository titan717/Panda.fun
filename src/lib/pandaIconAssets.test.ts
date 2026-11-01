import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

const file = (path: string) => new URL(path, import.meta.url);
const pngSize = (path: string) => {
  const bytes = readFileSync(file(path));
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

describe('Panda.fun icon asset contract', () => {
  it('keeps a single warm-black panda SVG source and a safe-zone maskable source', () => {
    const source = readFileSync(file('../../assets/panda-icon.svg'), 'utf8');
    const exporter = readFileSync(file('../../scripts/generate-icons.py'), 'utf8');
    expect(source).toContain('#050505');
    expect(source).toContain('#F6F2EE');
    expect(source).toContain('#B84D41');
    expect(exporter).toContain('safe_mark = mark.resize((398, 398)');
    expect(exporter).toContain('base.alpha_composite(safe_mark');
  });

  it('generates all declared PWA and Apple raster icon sizes', () => {
    expect(pngSize('../../public/panda-192.png')).toEqual({ width: 192, height: 192 });
    expect(pngSize('../../public/panda-512.png')).toEqual({ width: 512, height: 512 });
    expect(pngSize('../../public/panda-512-maskable.png')).toEqual({ width: 512, height: 512 });
    expect(pngSize('../../public/apple-touch-icon.png')).toEqual({ width: 180, height: 180 });
    expect(pngSize('../../public/favicon-32x32.png')).toEqual({ width: 32, height: 32 });
    expect(existsSync(file('../../public/favicon.ico'))).toBe(true);
  });

  it('generates legacy launcher icons for every Android density and the TV banner', () => {
    const densities: Array<[string, number]> = [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]];
    for (const [density, size] of densities) {
      expect(pngSize('../../android/app/src/main/res/mipmap-' + density + '/ic_launcher.png')).toEqual({ width: size, height: size });
      expect(pngSize('../../android/app/src/main/res/mipmap-' + density + '/ic_launcher_round.png')).toEqual({ width: size, height: size });
    }
    expect(pngSize('../../android/app/src/main/res/drawable-xhdpi/tv_banner.png')).toEqual({ width: 320, height: 180 });
  });

  it('uses adaptive foreground, background and Android 13 monochrome layers', () => {
    const adaptive = readFileSync(file('../../android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml'), 'utf8');
    expect(adaptive).toContain('@color/launcher_background');
    expect(adaptive).toContain('@drawable/panda_launcher_foreground');
    expect(adaptive).toContain('<monochrome');
  });
});
