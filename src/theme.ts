import { useLayoutEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import type { Settings, Snapshot } from "./model";
import {
  effectiveAppearance,
  effectiveAccent,
  visualPreferences,
} from "./visuals";
export function useTheme(
  settings?: Settings,
  system?: Snapshot["system_visuals"],
) {
  const visual = visualPreferences(settings),
    visualKey = JSON.stringify([visual, system]),
    key = `${visual.theme_family}/${visual.theme}/${visual.desktop_glass}/${visual.desktop_material}/${system?.advanced_effects}`;
  const [readyKey, setReadyKey] = useState("");
  useLayoutEffect(() => {
    const update = () => {
      document.documentElement.dataset.windowActive = String(
        document.visibilityState !== "hidden" && document.hasFocus(),
      );
    };
    update();
    window.addEventListener("focus", update);
    window.addEventListener("blur", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.removeEventListener("focus", update);
      window.removeEventListener("blur", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.density = visual.density;
    root.dataset.family = visual.theme_family;
    root.dataset.accent = effectiveAccent(visual.theme_family, visual.accent);
    root.dataset.motion =
      system?.animations_enabled === false ? "off" : visual.animation;
    root.dataset.modalBackdrop = visual.modal_backdrop;
    root.dataset.scrollbars =
      visual.scrollbars === "always" || system?.auto_hide_scrollbars !== true
        ? "always"
        : "transient";
    root.dataset.effects =
      system?.advanced_effects === false ? "reduced" : "allowed";
    root.style.setProperty("--desktop-tint", String(visual.desktop_tint / 100));
  }, [visualKey]);
  useLayoutEffect(() => {
    const w = getCurrentWindow();
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const mode = effectiveAppearance(visual.theme_family, visual.theme);
    const root = document.documentElement;
    const apply = async (theme: string) => {
      if (disposed) return;
      const resolved = mode === "system" ? theme : mode;
      root.dataset.theme = resolved;
      try {
        const result = await invoke<{ mode: string; error: string | null }>(
          "native_glass",
          {
            dark: resolved === "dark",
            allow:
              !matchMedia("(forced-colors: active)").matches &&
              !matchMedia("(prefers-reduced-transparency: reduce)").matches,
          },
        );
        if (!disposed) {
          root.dataset.desktopGlass = result?.mode ?? "off";
          root.dataset.desktopGlassError = result?.error ?? "";
        }
      } catch {
        if (!disposed) root.dataset.desktopGlass = "off";
      }
    };
    const changed = () => {
      if (mode === "system") apply(media.matches ? "dark" : "light");
    };
    apply(media.matches ? "dark" : "light");
    media.addEventListener("change", changed);
    void (async () => {
      try {
        await w.setTheme(mode === "system" ? null : mode);
        await apply((await w.theme()) ?? (media.matches ? "dark" : "light"));
        const off = await w.onThemeChanged((e) => apply(e.payload));
        if (disposed) off();
        else unlisten = off;
      } catch {
        apply(media.matches ? "dark" : "light");
      } finally {
        if (!disposed) setReadyKey(key);
      }
    })();
    return () => {
      disposed = true;
      unlisten?.();
      media.removeEventListener("change", changed);
    };
  }, [key]);
  return readyKey === key;
}
