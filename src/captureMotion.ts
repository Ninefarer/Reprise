import { getCurrentWindow } from "@tauri-apps/api/window";

let hide: (() => Promise<void>) | undefined;
export function registerCaptureExit(callback: () => Promise<void>) {
  hide = callback;
  return () => {
    if (hide === callback) hide = undefined;
  };
}
/** Persistence runs before this presentation-only exit. */
export function hideQuickCapture() {
  return hide ? hide() : getCurrentWindow().hide();
}
