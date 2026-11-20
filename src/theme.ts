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
  onFallback?: (message: string) => void,
) {
  const visual = visualPreferences(settings),
    visualKey = JSON.stringify([visual, system]),
    key = `${visual.theme_family}/${visual.theme}/${visual.aesthetic}/${visual.desktop_material}/${system?.advanced_effects}`;
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
    root.dataset.aesthetic = visual.aesthetic;
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
    // Tint adjusts the selected material; it must never silently replace Clear
    // with an effectively opaque material at the upper end of the slider.
    root.dataset.glassVariant =
      visual.desktop_material === "acrylic"
        ? "regular"
        : visual.desktop_material;
  }, [visualKey]);
  useLayoutEffect(() => {
    const w = getCurrentWindow();
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const accessibility = [
      "(forced-colors: active)",
      "(prefers-reduced-transparency: reduce)",
      "(prefers-contrast: more)",
    ].map((query) => matchMedia(query));
    const mode = effectiveAppearance(visual.theme_family, visual.theme);
    const root = document.documentElement;
    let requestRevision = 0;
    const apply = async (theme: string) => {
      if (disposed) return;
      const request = ++requestRevision;
      const resolved = mode === "system" ? theme : mode;
      root.dataset.theme = resolved;
      try {
        const result = await invoke<{ mode: string; error: string | null }>(
          "native_glass",
          {
            dark: resolved === "dark",
            allow: !accessibility.some((query) => query.matches),
          },
        );
        if (!disposed && request === requestRevision) {
          root.dataset.desktopGlass = result?.mode ?? "off";
          root.classList.toggle(
            "glass-scope",
            result?.mode === "clear" || result?.mode === "acrylic",
          );
          root.dataset.desktopGlassError = result?.error ?? "";
          onFallback?.(
            visual.aesthetic === "glass" ? (result?.error ?? "") : "",
          );
        }
      } catch {
        if (!disposed && request === requestRevision) {
          root.dataset.desktopGlass = "off";
          root.classList.remove("glass-scope");
          root.dataset.desktopGlassError =
            "Glass is unavailable; solid surfaces are active.";
          onFallback?.(
            visual.aesthetic === "glass" ? root.dataset.desktopGlassError : "",
          );
        }
      }
    };
    const changed = () => {
      if (mode === "system") apply(media.matches ? "dark" : "light");
    };
    apply(media.matches ? "dark" : "light");
    media.addEventListener("change", changed);
    const preferencesChanged = () =>
      void apply(media.matches ? "dark" : "light");
    accessibility.forEach((query) =>
      query.addEventListener("change", preferencesChanged),
    );
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
      accessibility.forEach((query) =>
        query.removeEventListener("change", preferencesChanged),
      );
    };
  }, [key, onFallback]);
  return readyKey === key;
}
