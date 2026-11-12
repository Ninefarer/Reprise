import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { taskCategory } from "./taskColors";
import { statuses } from "./model";
const css = readFileSync(new URL("./task-colors.css", import.meta.url), "utf8");
const names = [
  "inbox",
  "do-now",
  "scheduled",
  "settled",
  "snoozed",
  "waiting",
  "resurfaced",
  "finished",
  "dropped",
];
function swatch(prefix, name) {
  const match = css.match(
    new RegExp(`--${prefix}-${name}:\\s*(#[a-f0-9]{6})`, "i"),
  );
  if (!match) throw Error(`Missing ${name}`);
  return match[1].toUpperCase();
}
function luminance(hex) {
  const channels = hex
    .slice(1)
    .match(/../g)
    .map((v) => parseInt(v, 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a, b) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
describe("semantic color contract", () => {
  it("keeps the requested soft dark palette in one source", () => {
    expect(names.map((n) => swatch("dark", n))).toEqual([
      "#E4E8E5",
      "#A8D5A2",
      "#9DBDE8",
      "#C5AFE8",
      "#E5BE82",
      "#E6A59E",
      "#83D8C9",
      "#91B99B",
      "#929A9F",
    ]);
  });
  it.each(names)(
    "%s has readable dark text and recognizable selected icons",
    (name) => {
      const color = swatch("dark", name);
      expect(contrast(color, "#191E1A")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(color, "#282F29")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(color, "#354730")).toBeGreaterThanOrEqual(3);
    },
  );
  it.each(names)(
    "%s has readable light text and recognizable selected icons",
    (name) => {
      const color = swatch("status", name);
      expect(contrast(color, "#E9EEE5")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(color, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(color, "#D6E2CF")).toBeGreaterThanOrEqual(3);
    },
  );
  it("keeps general destinations neutral and Resurfaced out of lifecycle statuses", () => {
    for (const name of [
      "Home",
      "Daily Review",
      "All Tasks",
      "Notification History",
      "Settings",
    ])
      expect(taskCategory(name)).toBeUndefined();
    expect(taskCategory("Resurfaced")).toBe("Resurfaced");
    expect(statuses).not.toContain("Resurfaced");
  });
  it.each(names)("%s remains readable in both fixed theme families", (name) => {
    for (const background of ["#050505", "#101010", "#181818"])
      expect(contrast(swatch("dark", name), background)).toBeGreaterThanOrEqual(4.5);
    for (const background of ["#FAFAFA", "#F1F3EF", "#F4F5F2"])
      expect(contrast(swatch("status", name), background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(swatch("dark", name), "#263421")).toBeGreaterThanOrEqual(3);
    expect(contrast(swatch("status", name), "#DDE7D7")).toBeGreaterThanOrEqual(3);
  });
});
