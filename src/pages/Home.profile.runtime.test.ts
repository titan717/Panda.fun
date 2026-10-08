import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./Home.tsx', import.meta.url), 'utf8');

describe('Home profile gate and trailer autoplay', () => {
  it('mounts the home content only after the profile gate and has one gate owner', () => {
    expect(source).not.toMatch(/function HomeContent\(\)[\s\S]*?<HomeProfileGate\s*\/>/);
    expect(source).toMatch(/export function Home\(\)[\s\S]*?<HomeProfileGate onReady=\{handleProfileReady\} onBlock=\{handleProfileBlock\} \/>/);
    expect(source).toMatch(/\{profileReady && <HomeContent \/>\}/);
  });

  it('hands Home off in the same profile selection turn before the exit delay', () => {
    expect(source).toMatch(/setGateState\('leaving'\);\s*onReady\(\{ home: prefetchedHome, trailer: prefetchedTrailer \}\);[\s\S]*?setTimeout/);
  });

  it('passes preloaded media into Home during the profile transition', () => {
    expect(source).toMatch(/const \[prefetchedHome, setPrefetchedHome\] = useState/);
    expect(source).toMatch(/const \[prefetchedTrailer, setPrefetchedTrailer\] = useState/);
    expect(source).toMatch(/onReady\(\{ home: prefetchedHome, trailer: prefetchedTrailer \}\)/);
    expect(source).toMatch(/initialHome=\{homePrefetch\.home\}[\s\S]*initialTrailer=\{homePrefetch\.trailer\}/);
  });

  it('keeps the featured trailer unmuted and gives embedded playback autoplay permission', () => {
    expect(source).toMatch(/parsed\.searchParams\.set\('autoplay', '1'\)/);
    expect(source).toMatch(/parsed\.searchParams\.set\('mute', '0'\)/);
    expect(source).not.toMatch(/searchParams\.set\('mute', '1'\)/);
    expect(source).toMatch(/allow="autoplay; encrypted-media; picture-in-picture"/);
    expect(source).toMatch(/contentWindow\.postMessage/);
  });

  it('uses multiple TMDB poster sizes before giving up on a card image', () => {
    expect(source).toMatch(/optimizeImageUrl\(value, 'w342'\)/);
    expect(source).toMatch(/optimizeImageUrl\(value, 'w500'\)/);
    expect(source).toMatch(/item\.poster \|\| item\.backdrop/);
  });

  it('does not expose profile PIN locking', () => {
    const profileSource = readFileSync(new URL('./Profile.tsx', import.meta.url), 'utf8');
    const profileStoreSource = readFileSync(new URL('../lib/profileStore.ts', import.meta.url), 'utf8');

    expect(source).not.toMatch(/PinPrompt|pinProfile|pinHash/);
    expect(profileSource).not.toMatch(/PinPrompt|pinHash|Lock it with a PIN|Locked profile|Profile PIN/);
    expect(profileStoreSource).not.toMatch(/pinHash|Profile PIN/);
  });
});
