import { describe, it, expect } from "vitest";
import {
  effectiveAppearance,
  effectiveAccent,
  nativeBackground,
  visualPreferences,
} from "./visuals";
import { releases, releaseFor } from "./changelog";
describe("visual preferences", () => {
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
  });
  it("uses family defaults without overriding an explicit accent", () => {
    expect(effectiveAccent("classic", "theme")).toBe("sage");
    expect(effectiveAccent("pitch-black", "theme")).toBe("neutral");
    expect(effectiveAccent("ashen-white", "theme")).toBe("neutral");
    expect(effectiveAccent("pitch-black", "lavender")).toBe("lavender");
  });
  it("matches native window backgrounds to the family", () => {
    expect(nativeBackground("pitch-black", "light")).toBe("#050505");
    expect(nativeBackground("ashen-white", "dark")).toBe("#fafafa");
    expect(nativeBackground("classic", "dark")).toBe("#202521");
    expect(nativeBackground("classic", "light")).toBe("#f5f6f2");
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
