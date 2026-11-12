import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { releaseFor } from "./changelog";
const read = (name) => readFileSync(new URL(name, import.meta.url), "utf8");
const accents = read("./accents.css"),
  families = read("./visual-system.css"),
  tasks = read("./task-colors.css");
const names = ["sage", "lavender", "icy-blue", "rose", "neutral"];
function block(css, selector) {
  const start = css.indexOf(selector);
  if (start < 0) throw Error(selector);
  return css.slice(start + selector.length, css.indexOf("}", start));
}
function token(css, key) {
  const value = css.match(new RegExp(`--${key}:\\s*(#[a-f0-9]{6})`, "i"))?.[1];
  if (!value) throw Error(key);
  return value;
}
function rgb(hex) {
  return hex
    .slice(1)
    .match(/../g)
    .map((c) => parseInt(c, 16));
}
function l(hex) {
  const c = rgb(hex)
    .map((n) => n / 255)
    .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4));
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
}
function contrast(a, b) {
  return (Math.max(l(a), l(b)) + 0.05) / (Math.min(l(a), l(b)) + 0.05);
}
describe("theme polish contrast", () => {
  it("packages v3.3.0 consistently with locally bundled release notes", () => {
    expect(JSON.parse(read("../package.json")).version).toBe("3.3.0");
    expect(JSON.parse(read("../package-lock.json")).packages[""].version).toBe(
      "3.3.0",
    );
    expect(JSON.parse(read("../src-tauri/tauri.conf.json")).version).toBe(
      "3.3.0",
    );
    expect(
      read("../src-tauri/Cargo.toml").match(/version = "([^"]+)"/)[1],
    ).toBe("3.3.0");
    expect(read("../src-tauri/Cargo.lock")).toMatch(
      /name = "reprise"\r?\nversion = "3\.3\.0"/,
    );
    expect(releaseFor("3.3.0")?.sections.length).toBeGreaterThan(0);
    expect(releaseFor("3.2.0")).toBeTruthy();
    expect(releaseFor("0.2.0")).toBeTruthy();
  });
  it("gives only Quick Capture a borderless utility window and scoped dragging", () => {
    const windows = JSON.parse(read("../src-tauri/tauri.conf.json")).app
      .windows;
    const capture = windows.find((w) => w.label === "capture");
    expect(capture.decorations).toBe(false);
    expect(capture.skipTaskbar).toBe(true);
    expect(read("./style.css")).toMatch(
      /:root:has\(\.quick\)\s*\{[^}]*scrollbar-gutter:\s*auto/,
    );
    expect(capture.resizable).toBe(false);
    expect(capture.height).toBe(200);
    expect(windows.find((w) => w.label === "main").decorations).not.toBe(false);
    const capability = JSON.parse(
      read("../src-tauri/capabilities/capture.json"),
    );
    expect(capability.windows).toEqual(["capture"]);
    expect(capability.permissions).toContain(
      "core:window:allow-start-dragging",
    );
  });
  it("keeps fixed-family surfaces neutral, including secondary labels and placeholders", () => {
    for (const family of ["pitch-black", "ashen-white"]) {
      const b = block(families, `:root[data-family="${family}"]`);
      for (const t of ["bg", "sidebar", "raised"]) {
        const channels = rgb(token(b, t));
        expect(
          Math.max(...channels) - Math.min(...channels),
        ).toBeLessThanOrEqual(3);
      }
      const bg = family === "pitch-black" ? "#101010" : "#ffffff";
      for (const t of ["text", "muted", "subtle"])
        expect(contrast(token(b, t), bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(token(b, "control-border"), bg)).toBeGreaterThanOrEqual(
        3,
      );
    }
  });
  it.each(names)(
    "%s keeps button text, focus and semantic navigation accents readable",
    (name) => {
      for (const dark of [false, true]) {
        const selector = dark
          ? `:root[data-theme="dark"][data-accent="${name}"]`
          : `:root[data-accent="${name}"]`;
        const b = block(accents, selector),
          accent = token(b, "interactive-accent"),
          selection = token(b, "interactive-selection");
        expect(
          contrast(accent, token(b, "interactive-text")),
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrast(accent, dark ? "#181818" : "#ffffff"),
        ).toBeGreaterThanOrEqual(3);
        for (const status of [
          "inbox",
          "do-now",
          "scheduled",
          "settled",
          "snoozed",
          "waiting",
          "resurfaced",
          "finished",
          "dropped",
        ]) {
          const color = token(tasks, `${dark ? "dark" : "status"}-${status}`);
          expect(contrast(color, selection)).toBeGreaterThanOrEqual(3);
        }
      }
    },
  );
});
