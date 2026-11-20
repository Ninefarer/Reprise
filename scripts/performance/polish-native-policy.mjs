import { pathToFileURL } from "node:url";
import { writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const { chromium } = await import(pathToFileURL(process.argv[2])),
  browser = await chromium.connectOverCDP("http://127.0.0.1:9228"),
  rootPid = process.argv[3];
if (!/^\d+$/.test(rootPid)) throw Error("Explicit installed PID required");
const page = browser
  .contexts()
  .flatMap((c) => c.pages())
  .find((p) => p.url() === "http://tauri.localhost/");
if (!page) throw Error("Expected packaged Nightly");
const cdp = await page.context().newCDPSession(page),
  rows = [];
const ipc = (cmd, args) =>
  page.evaluate(
    ([cmd, args]) => window.__TAURI_INTERNALS__.invoke(cmd, args),
    [cmd, args],
  );
const s = (await ipc("snapshot")).settings,
  fields = [
    "desktop_glass",
    "desktop_material",
    "desktop_tint",
    "theme",
    "theme_family",
    "animation",
  ],
  restore = Object.fromEntries(fields.map((k) => [k, s[k]]));
const backdrop = () =>
  JSON.parse(
    execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-File",
        "scripts/performance/native-backdrop-state.ps1",
        "-RootProcessId",
        rootPid,
      ],
      { encoding: "utf8", windowsHide: true },
    ),
  );
try {
  const disclosure = page.getByRole("button", { name: "Continue to Nightly" });
  if (await disclosure.count()) await disclosure.click();
  await page.bringToFront();
  await ipc("visual_preferences", {
    patch: {
      desktop_glass: true,
      desktop_material: "clear",
      desktop_tint: 90,
      theme_family: "pitch-black",
      theme: "dark",
      animation: "expressive",
    },
  });
  for (const policy of [
    "none",
    "prefers-reduced-transparency",
    "forced-colors",
    "prefers-reduced-motion",
    "none",
  ]) {
    await cdp.send("Emulation.setEmulatedMedia", {
      features:
        policy === "none"
          ? []
          : [
              {
                name: policy,
                value: policy === "forced-colors" ? "active" : "reduce",
              },
            ],
    });
    const opaque = ["prefers-reduced-transparency", "forced-colors"].includes(
      policy,
    );
    await page.waitForFunction(
      (want) => document.documentElement.dataset.desktopGlass === want,
      opaque ? "off" : "clear",
    );
    await page.waitForTimeout(100);
    const native = backdrop();
    assert.equal(native.hresult, 0);
    assert.equal(native.systemBackdropType, opaque ? 1 : 3);
    const css = await page.evaluate(() => ({
      mode: document.documentElement.dataset.desktopGlass,
      background: getComputedStyle(document.documentElement).backgroundColor,
      canvas: getComputedStyle(document.querySelector(".content"))
        .backgroundColor,
      animations: document.getAnimations().length,
    }));
    rows.push({ policy, native, css });
    if (policy === "forced-colors") {
      const selected = await page
        .locator(".nav-group button.active")
        .evaluate((el) => ({
          adjust: getComputedStyle(el).forcedColorAdjust,
          ink: getComputedStyle(el).color,
          label: getComputedStyle(el.querySelector(".sidebar-label")).color,
        }));
      assert.equal(selected.adjust, "none");
      assert.equal(selected.label, selected.ink);
      rows.at(-1).selection = selected;
      await page.screenshot({
        path: "artifacts/polish/native-forced-colors.png",
      });
    }
  }
  assert.equal(rows.at(-1).native.systemBackdropType, 3);
  await writeFile(
    "artifacts/polish/native-policy.json",
    JSON.stringify(
      {
        rows,
        method:
          "WebView2 media emulation, actual DwmGetWindowAttribute(38); Windows preferences not changed.",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(rows));
} finally {
  await cdp.send("Emulation.setEmulatedMedia", { features: [] });
  await ipc("visual_preferences", { patch: restore });
  await browser.close();
}
