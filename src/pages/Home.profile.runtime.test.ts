import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./Home.tsx', import.meta.url), 'utf8');

describe('Home profile gate and trailer autoplay', () => {
  it('mounts the home content only after the profile gate and has one gate owner', () => {
    expect(source).not.toMatch(/function HomeContent\(\)[\\s\\S]*?<HomeProfileGate\s*\/>/);
    expect(source).toMatch(/export function Home\(\)[\\s\\S]*?<HomeProfileGate onReady=\{handleProfileReady\} onBlock=\{handleProfileBlock\} \/>/);
    expect(source).toMatch(/\{profileReady && <HomeContent \/>\}/);
  });

  it('does not expose profile PIN locking and keeps the featured trailer unmuted', () => {
    expect(source).not.toMatch(/PinPrompt|pinProfile|pinHash/);
    expect(source).toMatch(/parsed\.searchParams\.set\('autoplay', '1'\)/);
    expect(source).toMatch(/parsed\.searchParams\.set\('mute', soundEnabled \? '0' : '1'\)/);
  });
});
