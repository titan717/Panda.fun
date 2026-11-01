export const motionDurations = {
  instant: 0.09,
  fast: 0.16,
  base: 0.24,
  slow: 0.38,
  hero: 0.6,
} as const;

export const motionEasings = {
  standard: [0.2, 0, 0, 1] as const,
  emphasized: [0.16, 1, 0.3, 1] as const,
  exit: [0.4, 0, 1, 1] as const,
} as const;

export const motionSprings = {
  snappy: { type: 'spring' as const, stiffness: 520, damping: 34, mass: 0.72 },
  soft: { type: 'spring' as const, stiffness: 260, damping: 28, mass: 0.9 },
  bouncy: { type: 'spring' as const, stiffness: 420, damping: 22, mass: 0.7 },
} as const;

export type MotionPreference = 'full' | 'reduced' | 'minimal';

export function resolveMotionPreference(input: {
  prefersReducedMotion: boolean;
  saveData: boolean;
  lowEndDevice: boolean;
}): MotionPreference {
  if (input.lowEndDevice) return 'minimal';
  if (input.prefersReducedMotion || input.saveData) return 'reduced';
  return 'full';
}

export function getMotionOffset(preference: MotionPreference, distance: number): number {
  return preference === 'full' ? distance : 0;
}

export function isLowEndDevice(input: {
  hardwareConcurrency?: number;
  deviceMemory?: number;
}): boolean {
  return (
    (typeof input.hardwareConcurrency === 'number' && input.hardwareConcurrency > 0 && input.hardwareConcurrency <= 2) ||
    (typeof input.deviceMemory === 'number' && input.deviceMemory > 0 && input.deviceMemory <= 2)
  );
}
