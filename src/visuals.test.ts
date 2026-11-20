import { describe, it, expect } from "vitest";
import {
  effectiveAppearance,
  effectiveAccent,
  nativeBackground,
  visualPreferences,
} from "./visuals";
import { releases, releaseFor } from "./changelog";
describe("visual preferences", () => {
  it("migrates legacy appearance independently of palette and motion", () => {
    for (const theme_family of [
      "classic",
      "peach",
      "pitch-black",
      "ashen-white",
    ] as const)
      for (const desktop_glass of [true, false]) {
        const v = visualPreferences({
          theme_family,
          desktop_glass,
          animation: "expressive",
          desktop_material: "acrylic",
          desktop_tint: 90,
        } as import("./model").Settings);
        expect(v.aesthetic).toBe(desktop_glass ? "glass" : "solid");
        expect(v.animation).toBe("expressive");
        expect(v.desktop_material).toBe("acrylic");
        expect(v.desktop_tint).toBe(90);
      }
    expect(
      visualPreferences({
        aesthetic: "solid",
        desktop_glass: true,
      } as import("./model").Settings).desktop_glass,
    ).toBe(false);
  });
  it("defaults to opaque Classic and preserves System as a separate preference", () => {
    const v = visualPreferences();
    expect(v).toMatchObject({
      theme: "system",
      theme_family: "classic",
      modal_backdrop: "dim",
      scrollbars: "system",
      accent: "theme",
      animation: "subtle",
    });
    expect(effectiveAppearance("pitch-black", v.theme)).toBe("dark");
    expect(effectiveAppearance("ashen-white", v.theme)).toBe("light");
    expect(effectiveAppearance("classic", v.theme)).toBe("system");
    for (const mode of ["system", "light", "dark"] as const)
      expect(effectiveAppearance("peach", mode)).toBe(mode);
  });
  it("uses family defaults without overriding an explicit accent", () => {
    expect(effectiveAccent("classic", "theme")).toBe("sage");
    expect(effectiveAccent("peach", "theme")).toBe("peach");
    expect(effectiveAccent("peach", "rose")).toBe("rose");
    expect(effectiveAccent("pitch-black", "theme")).toBe("neutral");
    expect(effectiveAccent("ashen-white", "theme")).toBe("neutral");
    expect(effectiveAccent("pitch-black", "lavender")).toBe("lavender");
  });
  it("matches native window backgrounds to the family", () => {
    expect(nativeBackground("pitch-black", "light")).toBe("#050505");
    expect(nativeBackground("ashen-white", "dark")).toBe("#fafafa");
    expect(nativeBackground("classic", "dark")).toBe("#202521");
    expect(nativeBackground("classic", "light")).toBe("#f5f6f2");
    expect(nativeBackground("peach", "light")).toBe("#fff4ed");
    expect(nativeBackground("peach", "dark")).toBe("#382c27");
  });
  it("retains local historical releases with structured nested entries", () => {
    expect(new Set(releases.map((r) => r.version)).size).toBe(releases.length);
    expect(
      releaseFor("0.2.0")?.sections.some((s) =>
        s.entries.some((e) => e.details?.length),
      ),
    ).toBe(true);
    expect(releaseFor("0.1.0")).toBeTruthy();
    expect(releaseFor("99.0.0")).toBeUndefined();
  });
});
