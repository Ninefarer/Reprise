import type { Settings, Theme, ThemeFamily, VisualPreferences } from "./model";
export function visualPreferences(settings?: Settings): VisualPreferences {
  return {
    theme: settings?.theme ?? "system",
    theme_family: settings?.theme_family ?? "classic",
    density: settings?.density ?? "comfortable",
    modal_backdrop: settings?.modal_backdrop ?? "dim",
    scrollbars: settings?.scrollbars ?? "system",
    accent: settings?.accent ?? "theme",
    animation: settings?.animation ?? "subtle",
    desktop_glass: settings?.desktop_glass ?? false,
    desktop_material: settings?.desktop_material ?? "clear",
    desktop_tint: settings?.desktop_tint ?? 65,
  };
}
export function effectiveAccent(
  family: ThemeFamily,
  accent: VisualPreferences["accent"],
) {
  return accent === "theme"
    ? family === "classic"
      ? "sage"
      : "neutral"
    : accent;
}
export function effectiveAppearance(
  family: ThemeFamily,
  preference: Theme,
): Theme {
  return family === "pitch-black"
    ? "dark"
    : family === "ashen-white"
      ? "light"
      : preference;
}
export function nativeBackground(
  family: ThemeFamily,
  appearance: "light" | "dark",
) {
  return family === "pitch-black"
    ? "#050505"
    : family === "ashen-white"
      ? "#fafafa"
      : appearance === "dark"
        ? "#202521"
        : "#f5f6f2";
}
