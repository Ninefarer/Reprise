export const defaultCommandShortcut = "Ctrl+K";
const reserved = new Set([
  "Ctrl+A",
  "Ctrl+C",
  "Ctrl+V",
  "Ctrl+X",
  "Ctrl+Z",
  "Ctrl+Y",
  "Ctrl+Shift+Z",
  "Ctrl+F",
  "Ctrl+Shift+N",
  "Ctrl+Shift+Space",
  "Ctrl+W",
  "Ctrl+T",
  "Ctrl+N",
  "Ctrl+L",
  "Ctrl+R",
  "Ctrl+Shift+R",
  "Ctrl+F5",
  "Alt+F4",
]);
export function shortcutError(value: string): string | null {
  if (
    !/^(?:Ctrl\+(?:Alt\+)?(?:Shift\+)?|Alt\+(?:Shift\+)?)(?:[A-Z0-9]|F(?:[1-9]|1[0-2])|Space)$/.test(
      value,
    )
  )
    return "Use Ctrl or Alt with a letter, number, F1–F12 or Space.";
  if (reserved.has(value))
    return "That shortcut is reserved for another command.";
  return null;
}
export function shortcutFromEvent(
  event: Pick<
    KeyboardEvent,
    "key" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey"
  >,
): string | null {
  if (["Control", "Alt", "Shift", "Meta"].includes(event.key)) return null;
  const key =
    event.key === " "
      ? "Space"
      : event.key.length === 1
        ? event.key.toUpperCase()
        : event.key;
  return [
    event.ctrlKey && "Ctrl",
    event.altKey && "Alt",
    event.shiftKey && "Shift",
    key,
  ]
    .filter(Boolean)
    .join("+");
}
export function matchesShortcut(event: KeyboardEvent, value: string): boolean {
  return (
    !event.metaKey &&
    !event.repeat &&
    !event.isComposing &&
    !event.getModifierState?.("AltGraph") &&
    !shortcutError(value) &&
    shortcutFromEvent(event) === value
  );
}
