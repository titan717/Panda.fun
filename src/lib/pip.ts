import { native } from "./native";

/* ---- v1.2.2 picture-in-picture ---- */
export function nativePipSupported(): boolean {
  try { return Boolean(native?.canPictureInPicture?.()); } catch { return false; }
}
export function nativePlaybackActive(active: boolean, auto: boolean) {
  try { native?.setPlaybackActive?.(active, auto); } catch { /* old APK */ }
}
export function nativeEnterPip(): boolean {
  try { return Boolean(native?.enterPictureInPicture?.()); } catch { return false; }
}
