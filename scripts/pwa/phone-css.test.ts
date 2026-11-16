import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../../src/", import.meta.url);
const phone = readFileSync(new URL("pwa-phone.css", root), "utf8");
const sheets = readdirSync(root).filter(
  (name) => name.endsWith(".css") && name !== "pwa-phone.css",
);

describe("phone stylesheet", () => {
  it("covers safe areas, dvh with a vh fallback, and 16px fields", () => {
    for (const edge of ["top", "right", "bottom", "left"]) {
      expect(phone).toContain(`safe-area-inset-${edge}`);
    }
    expect(phone).toContain("100dvh");
    expect(phone).toContain("100vh");
    expect(phone).toContain("font-size: 16px");
    expect(phone).toContain("min-height: 44px");
    expect(phone).toContain("max-width: 430px");
    expect(phone).toContain("phone-tabbar");
  });

  it("overrides every shared 100vh rule without editing those sheets", () => {
    const covered = [
      ".app",
      "aside.sidebar",
      ".setup-screen",
      ".quick",
      ".notification-edge",
      ".notification-dock",
      ".control-shield",
      ".menu-shield",
      ".task-dialog",
      ".release-dialog",
      ".context-menu",
      ".control-popup",
      ".select-options",
    ];
    for (const selector of covered) expect(phone).toContain(selector);
    const withHundredVh = sheets.filter((name) =>
      readFileSync(new URL(name, root), "utf8").includes("100vh"),
    );
    expect(withHundredVh.sort()).toEqual(
      [
        "controls.css",
        "notification-sidebar.css",
        "style.css",
        "visual-system.css",
      ].sort(),
    );
    for (const name of sheets) {
      const css = readFileSync(new URL(name, root), "utf8");
      expect(css, name).not.toContain("safe-area-inset");
      expect(css, name).not.toContain("phone-tabbar");
    }
  });
});
