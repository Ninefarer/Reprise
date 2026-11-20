// Installed Pass 4 QA. No task writes; visual choices restored in finally.
import { pathToFileURL } from "node:url";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { chromium } = await import(pathToFileURL(process.argv[2]));
const browser = await chromium.connectOverCDP("http://127.0.0.1:9228");
const page = browser
  .contexts()
  .flatMap((c) => c.pages())
  .find((p) => p.url() === "http://tauri.localhost/");
if (!page) throw Error("Expected installed main WebView");
const ipc = (cmd, args) =>
  page.evaluate(
    ([cmd, args]) => window.__TAURI_INTERNALS__.invoke(cmd, args),
    [cmd, args],
  );
const s = (await ipc("snapshot")).settings;
const restore = Object.fromEntries(
  [
    "theme_family",
    "theme",
    "animation",
    "desktop_material",
    "desktop_tint",
  ].map((k) => [k, s[k]]),
);
restore.aesthetic = s.aesthetic ?? (s.desktop_glass ? "glass" : "solid");
const rows = [],
  errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
try {
  const disclosure = page.getByRole("button", {
    name: "Continue to Nightly",
    exact: true,
  });
  if (await disclosure.count()) await disclosure.click();
  for (const family of ["classic", "peach", "pitch-black", "ashen-white"])
    for (const theme of family === "classic" || family === "peach"
      ? ["light", "dark"]
      : ["system"])
      for (const aesthetic of ["solid", "glass"])
        for (const animation of ["expressive", "subtle", "off"])
          for (const material of aesthetic === "glass"
            ? ["clear", "acrylic", "tinted"]
            : [s.desktop_material])
            for (const tint of aesthetic === "glass"
              ? [35, 90]
              : [s.desktop_tint]) {
              await ipc("visual_preferences", {
                patch: {
                  theme_family: family,
                  theme,
                  aesthetic,
                  animation,
                  desktop_material: material,
                  desktop_tint: tint,
                },
              });
              await page.waitForFunction(
                ({ aesthetic, family, animation, material }) => {
                  const d = document.documentElement.dataset;
                  return (
                    d.aesthetic === aesthetic &&
                    d.family === family &&
                    d.motion === animation &&
                    d.glassVariant ===
                      (material === "acrylic" ? "regular" : material) &&
                    (aesthetic === "solid"
                      ? d.desktopGlass === "off"
                      : d.desktopGlass !== "off")
                  );
                },
                { aesthetic, family, animation, material },
              );
              rows.push(
                await page.evaluate(() => ({
                  aesthetic: document.documentElement.dataset.aesthetic,
                  family: document.documentElement.dataset.family,
                  theme: document.documentElement.dataset.theme,
                  motion: document.documentElement.dataset.motion,
                  material: document.documentElement.dataset.glassVariant,
                  canvas: getComputedStyle(document.querySelector(".content"))
                    .backgroundColor,
                  html: getComputedStyle(document.documentElement)
                    .backgroundColor,
                })),
              );
            }
  await ipc("visual_preferences", {
    patch: {
      aesthetic: "glass",
      theme_family: "pitch-black",
      theme: "dark",
      desktop_material: "clear",
      desktop_tint: 90,
      animation: "expressive",
    },
  });
  await page.getByLabel(/Profile menu for/).click();
  await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Appearance", exact: true }).click();
  await page.screenshot({ path: "artifacts/appearance/glass-settings.png" });
  const aesthetic = page.getByRole("combobox", {
    name: "Aesthetic",
    exact: true,
  });
  await aesthetic.click();
  await page.getByRole("option", { name: "Solid", exact: true }).click();
  await page.waitForFunction(
    () => document.documentElement.dataset.desktopGlass === "off",
  );
  assert.equal(
    await page
      .getByRole("combobox", { name: "Glass material", exact: true })
      .count(),
    0,
  );
  await page.screenshot({ path: "artifacts/appearance/solid-settings.png" });
  await aesthetic.click();
  await page.getByRole("option", { name: "Glass", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Glass material", exact: true })
    .click();
  await page.getByRole("option", { name: "Tinted", exact: true }).click();
  await page.waitForFunction(
    () => document.documentElement.dataset.glassVariant === "tinted",
  );
  assert.equal((await ipc("snapshot")).settings.desktop_tint, 90);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("combobox", { name: "Motion", exact: true }).click();
  await page.keyboard.press("Escape");
  assert.equal(
    await page.evaluate(
      () =>
        document.getAnimations().filter((a) => a.playState === "running")
          .length,
    ),
    0,
  );
  assert.equal((await ipc("snapshot")).settings.animation, "expressive");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ cases: rows.length, errors }));
} finally {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await ipc("visual_preferences", { patch: restore });
  await writeFile(
    "artifacts/appearance/installed.json",
    JSON.stringify({ rows, errors }, null, 2),
  );
  await browser.close();
}
