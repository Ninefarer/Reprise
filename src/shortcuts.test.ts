import { expect, it } from "vitest";
import { matchesShortcut, shortcutError } from "./shortcuts";
const event = (key: string, extra = {}) =>
  ({
    key,
    ctrlKey: true,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    repeat: false,
    isComposing: false,
    ...extra,
  }) as KeyboardEvent;
it("matches the exact saved modifiers and ignores repeats, composition and system combinations", () => {
  expect(matchesShortcut(event("j"), "Ctrl+J")).toBe(true);
  expect(matchesShortcut(event("j", { shiftKey: true }), "Ctrl+J")).toBe(false);
  expect(matchesShortcut(event("j", { altKey: true }), "Ctrl+J")).toBe(false);
  expect(matchesShortcut(event("j", { repeat: true }), "Ctrl+J")).toBe(false);
  expect(matchesShortcut(event("j", { isComposing: true }), "Ctrl+J")).toBe(
    false,
  );
  expect(matchesShortcut(event("j", { metaKey: true }), "Ctrl+J")).toBe(false);
});
it("accepts custom combinations and rejects conflicts and malformed values", () => {
  for (const value of [
    "Ctrl+K",
    "Ctrl+Shift+P",
    "Alt+J",
    "Ctrl+Alt+Shift+F12",
    "Ctrl+7",
  ])
    expect(shortcutError(value)).toBeNull();
  for (const value of [
    "Ctrl+C",
    "Ctrl+F",
    "Ctrl+Shift+N",
    "Ctrl+Shift+Space",
    "Alt+F4",
    "Shift+J",
    "Ctrl+F13",
    "Meta+K",
    "Shift+Ctrl+K",
  ])
    expect(shortcutError(value)).toBeTruthy();
});
