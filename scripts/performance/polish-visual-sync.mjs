import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const { chromium } = await import(pathToFileURL(process.argv[2])),
  browser = await chromium.connectOverCDP("http://127.0.0.1:9228");
const pages = browser.contexts().flatMap((c) => c.pages()),
  main = pages.find((p) => p.url() === "http://tauri.localhost/"),
  capture = pages.find((p) => p.url().includes("?capture=1"));
if (!main || !capture)
  throw Error("Expected installed main and capture WebViews");
const ipc = (cmd, args) =>
  main.evaluate(
    ([cmd, args]) => window.__TAURI_INTERNALS__.invoke(cmd, args),
    [cmd, args],
  );
const s = (await ipc("snapshot")).settings,
  restore = {
    theme_family: s.theme_family,
    theme: s.theme,
    desktop_glass: s.desktop_glass,
    desktop_material: s.desktop_material,
    desktop_tint: s.desktop_tint,
  };
try {
  const before = await capture.evaluate(async () => ({
    family: document.documentElement.dataset.family,
    hidden: !(await window.__TAURI_INTERNALS__.invoke(
      "plugin:window|is_visible",
    )),
  }));
  if (!before.hidden)
    throw Error("Capture must be hidden; do not interrupt a draft");
  const family =
    before.family === "ashen-white" ? "pitch-black" : "ashen-white";
  await ipc("visual_preferences", { patch: { theme_family: family } });
  await main.waitForTimeout(500);
  const after = await capture.evaluate(
    () => document.documentElement.dataset.family,
  );
  console.log(
    JSON.stringify({ before, requestedFamily: family, captureFamily: after }),
  );
  assert.equal(
    after,
    family,
    "Hidden capture material was not synchronized before reveal",
  );
  await writeFile(
    "artifacts/polish/visual-sync.json",
    JSON.stringify(
      { before, requestedFamily: family, captureFamily: after, passed: true },
      null,
      2,
    ),
  );
} finally {
  await ipc("visual_preferences", { patch: restore });
  await browser.close();
}
