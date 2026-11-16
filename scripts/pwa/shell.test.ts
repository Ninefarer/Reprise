import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const worker = readFileSync(new URL("../../pwa/public/sw.js", import.meta.url), "utf8");
const manifest = JSON.parse(
  readFileSync(
    new URL("../../pwa/public/manifest.webmanifest", import.meta.url),
    "utf8",
  ),
);

describe("PWA shell source", () => {
  it("is a standalone Nightly manifest for project Pages", () => {
    expect(manifest.display).toBe("standalone");
    expect(manifest.name).toBe("Reprise Nightly");
    expect(manifest.short_name).toBe("Reprise");
    expect(manifest.start_url).toBe("/Reprise/");
    expect(manifest.scope).toBe("/Reprise/");
    expect(manifest.prefer_related_applications).toBe(false);
    expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(
      expect.arrayContaining(["256x256", "512x512"]),
    );
  });

  it("precaches the Pages shell and still handles push clicks", () => {
    expect(worker).toContain('addEventListener("push"');
    expect(worker).toContain('addEventListener("notificationclick"');
    expect(worker).toContain('addEventListener("fetch"');
    expect(worker).toContain('addEventListener("install"');
    expect(worker).toContain('addEventListener("activate"');
    expect(worker).toContain("caches.open");
    expect(worker).toContain("caches.delete");
    expect(worker).toContain('const CACHE_VERSION = "reprise-nightly-shell-v1"');
    expect(worker).toContain("/Reprise/");
    expect(worker).toContain("showNotification");
    expect(worker).toContain("reprise-notification-click");
  });
});
