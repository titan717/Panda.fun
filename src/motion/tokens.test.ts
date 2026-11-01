import { describe, expect, it } from 'vitest';
import { getMotionOffset, isLowEndDevice, motionDurations, motionEasings, motionSprings, resolveMotionPreference } from './tokens';

describe('motion tokens', () => {
  it('defines the shared OTT timing scale', () => {
    expect(motionDurations).toEqual({ instant: 0.09, fast: 0.16, base: 0.24, slow: 0.38, hero: 0.6 });
  });
  it('defines standard, emphasized and exit easing curves', () => {
    expect(motionEasings.standard).toEqual([0.2, 0, 0, 1]);
    expect(motionEasings.emphasized).toEqual([0.16, 1, 0.3, 1]);
    expect(motionEasings.exit).toEqual([0.4, 0, 1, 1]);
  });
  it('provides named spring presets', () => {
    expect(motionSprings.snappy.type).toBe('spring');
    expect(motionSprings.soft.type).toBe('spring');
    expect(motionSprings.bouncy.type).toBe('spring');
  });
});

describe('motion preference resolution', () => {
  it('prioritizes low-end device constraints', () => {
    expect(resolveMotionPreference({ prefersReducedMotion: true, saveData: true, lowEndDevice: true })).toBe('minimal');
  });
  it('uses opacity-only reduced motion for OS preference or data saver', () => {
    expect(resolveMotionPreference({ prefersReducedMotion: true, saveData: false, lowEndDevice: false })).toBe('reduced');
    expect(resolveMotionPreference({ prefersReducedMotion: false, saveData: true, lowEndDevice: false })).toBe('reduced');
  });
  it('uses full motion when no constraint applies', () => {
    expect(resolveMotionPreference({ prefersReducedMotion: false, saveData: false, lowEndDevice: false })).toBe('full');
  });
});

describe('reduced-motion movement contract', () => {
  it('never applies positional movement outside full motion mode', () => {
    expect(getMotionOffset('reduced', 12)).toBe(0);
    expect(getMotionOffset('minimal', -22)).toBe(0);
    expect(getMotionOffset('full', 12)).toBe(12);
  });
});

describe('low-end device thresholds', () => {
  it('keeps typical mid-range phones on full motion', () => {
    expect(isLowEndDevice({ hardwareConcurrency: 8, deviceMemory: 6 })).toBe(false);
    expect(isLowEndDevice({ hardwareConcurrency: 4, deviceMemory: 4 })).toBe(false);
  });
  it('uses minimal mode at two cores or two GB and below', () => {
    expect(isLowEndDevice({ hardwareConcurrency: 2, deviceMemory: 6 })).toBe(true);
    expect(isLowEndDevice({ hardwareConcurrency: 8, deviceMemory: 2 })).toBe(true);
    expect(isLowEndDevice({ hardwareConcurrency: 1, deviceMemory: 1 })).toBe(true);
  });
  it('ignores missing and invalid device signals', () => {
    expect(isLowEndDevice({})).toBe(false);
    expect(isLowEndDevice({ hardwareConcurrency: 0, deviceMemory: 0 })).toBe(false);
  });
});
