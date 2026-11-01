import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const png = (path: string, width: number, height = width) => {
  const file = resolve(root, path);
  expect(existsSync(file), path + ' should be generated from assets/panda-icon.svg').toBe(true);
  const data = readFileSync(file);
  expect(data.subarray(1, 4).toString()).toBe('PNG');
  expect(data.readUInt32BE(16)).toBe(width);
  expect(data.readUInt32BE(20)).toBe(height);
};

describe('Panda.fun single-source icon exports', () => {
  it('keeps the canonical vector artwork and maskable source', () => {
    const source = readFileSync(resolve(root, 'assets/panda-icon.svg'), 'utf8');
    expect(source).toContain('#B84D41');
    expect(source).toContain('#F6F2EE');
  });

  it('exports the declared web and PWA PNG sizes', () => {
    png('public/panda-192.png', 192);
    png('public/panda-512.png', 512);
    png('public/panda-512-maskable.png', 512);
    png('public/apple-touch-icon.png', 180);
    png('public/favicon-32x32.png', 32);
    expect(existsSync(resolve(root, 'public/favicon.ico'))).toBe(true);
    expect(existsSync(resolve(root, 'public/icon.svg'))).toBe(true);
    const html = readFileSync(file('index.html'), 'utf8');
    expect(html).toContain('href="/apple-touch-icon.png"');
    expect(html).toContain('href="/favicon.ico"');
    expect(html).toContain('href="/panda-192.png"');
    const vite = readFileSync(file('vite.config.ts'), 'utf8');
    expect(vite).toContain("src: '/panda-512-maskable.png'");
  });

  it('exports Android density fallbacks and TV banners', () => {
    const densities: Record<string, number> = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
    for (const [density, size] of Object.entries(densities)) {
      png(`android/app/src/main/res/mipmap-${density}/ic_launcher.png`, size);
      png(`android/app/src/main/res/mipmap-${density}/ic_launcher_round.png`, size);
    }
    png('android/app/src/main/res/drawable/tv_banner.png', 320, 180);
    png('android/app/src/main/res/drawable-xhdpi/tv_banner.png', 320, 180);
    png('android/app/src/main/res/drawable-xhdpi/banner.png', 320, 180);
  });

  it('declares Android adaptive foreground, background and monochrome layers', () => {
    const adaptive = readFileSync(resolve(root, 'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml'), 'utf8');
    expect(adaptive).toContain('<background');
    expect(adaptive).toContain('<foreground');
    expect(adaptive).toContain('<monochrome');
  });
});
