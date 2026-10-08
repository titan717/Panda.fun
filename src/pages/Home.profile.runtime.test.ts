import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./Home.tsx', import.meta.url), 'utf8');

describe('Home profile gate and trailer autoplay', () => {
  it('mounts the home content only after the profile gate and has one gate owner', () => {
    expect(source).not.toMatch(/function HomeContent\(\)[\\s\\S]*?<HomeProfileGate\s*\/>/);
    expect(source).toMatch(/export function Home\(\)[\s\S]*?<HomeProfileGate onReady=\{handleProfileReady\} onBlock=\{handleProfileBlock\} \/>/);
    expect(source).toMatch(/\{profileReady && <HomeContent \/>\}/);
  });


  it('mounts the hero during the profile exit with prefetched home media', () => {
    expect(source).toMatch(/const \[prefetchedHome, setPrefetchedHome\] = useState/);
    expect(source).toMatch(/const \[prefetchedTrailer, setPrefetchedTrailer\] = useState/);
    expect(source).toMatch(/onReady\(\{ home: prefetchedHome, trailer: prefetchedTrailer \}\)/);
    expect(source).toMatch(/initialHome=\{homePrefetch\.home\}[\s\S]*initialTrailer=\{homePrefetch\.trailer\}/);
  });

  it('does not expose profile PIN locking and keeps the featured trailer unmuted', () => {
    const profileSource = readFileSync(new URL('./Profile.tsx', import.meta.url), 'utf8');

    expect(source).not.toMatch(/PinPrompt|pinProfile|pinHash/);
    expect(profileSource).not.toMatch(/PinPrompt|pinHash|Lock it with a PIN|Locked profile|Profile PIN/);
    expect(source).toMatch(/parsed\.searchParams\.set\('autoplay', '1'\)/);
    expect(source).toMatch(/parsed\.searchParams\.set\('mute', '0'\)/);
    expect(source).not.toMatch(/searchParams\.set\('mute', '1'\)/);
  });
});
