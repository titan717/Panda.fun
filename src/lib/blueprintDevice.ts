export type BlueprintDeviceMode = 'mobile' | 'tablet' | 'tv';

export function getBlueprintDeviceMode(width = window.innerWidth, height = window.innerHeight): BlueprintDeviceMode {
  if (width >= 1280 && height >= 720) return 'tv';
  if (width >= 768) return 'tablet';
  return 'mobile';
}

export function isTvLayout(width = window.innerWidth, height = window.innerHeight): boolean {
  return getBlueprintDeviceMode(width, height) === 'tv';
}

export function deviceModeAttribute(mode: BlueprintDeviceMode): Record<'data-device-mode', BlueprintDeviceMode> {
  return { 'data-device-mode': mode };
}
