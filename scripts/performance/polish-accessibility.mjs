import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const { chromium } = await import(pathToFileURL(process.argv[2]));
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5182",
    "--strictPort",
  ],
  { stdio: "pipe", windowsHide: true },
);
let browser;
try {
  await new Promise((resolve, reject) => {
    server.stdout.on("data", (c) => {
      if (c.toString().includes("Local:")) resolve();
    });
    server.on("exit", (code) => reject(Error(`Vite ${code}`)));
  });
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const rows = [];
  await mkdir("artifacts/polish", { recursive: true });
  for (const dpr of [1, 1.25, 1.5, 2]) {
    const context = await browser.newContext({
        viewport: { width: 1000, height: 760 },
        deviceScaleFactor: dpr,
      }),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto("http://127.0.0.1:5182/?glass-motion-lab");
    const trigger = page.getByRole("combobox", { name: "Plan", exact: true });
    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Escape");
    assert.equal(
      await trigger.evaluate((el) => el === document.activeElement),
      true,
    );
    await page.waitForTimeout(650);
    await page
      .getByRole("button", { name: "Choose date and time for Review time" })
      .scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    await page
      .getByRole("button", { name: "Choose date and time for Review time" })
      .click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Next month" }).click();
    const height = await page
      .locator(".control-popup")
      .evaluate((el) => el.getBoundingClientRect().height);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    const firstHeight = await page
      .locator(".glass-morph-shell")
      .evaluate((el) =>
        parseFloat(el.getAnimations()[0].effect.getKeyframes()[0].height),
      );
    assert.ok(
      Math.abs(height - firstHeight) < 1,
      `Stale picker exit ${height}/${firstHeight}`,
    );
    await page.waitForTimeout(650);
    await page
      .getByRole("button", { name: "Choose date and time for Review time" })
      .scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    await page
      .getByRole("button", { name: "Choose date and time for Review time" })
      .click();
    await page.waitForTimeout(500);
    const preset = page.getByRole("button", { name: "09:00", exact: true });
    await preset.hover();
    await page.mouse.down();
    assert.equal(await page.locator(".connected-glass-rim").count(), 1);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(50);
    assert.equal(await page.locator(".connected-glass-rim").count(), 0);
    await page.mouse.up();
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".control-popup").count(), 0);
    await page.emulateMedia({
      reducedMotion: "no-preference",
      forcedColors: "active",
    });
    await trigger.click();
    assert.equal(await page.locator(".glass-morph-shell").count(), 0);
    const forced = await page.locator(".control-popup").evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        background: s.backgroundColor,
        color: s.color,
        blur: s.backdropFilter,
      };
    });
    assert.equal(forced.blur, "none");
    await page.keyboard.press("Escape");
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-transparency", value: "reduce" }],
    });
    const transparencySupported = await page.evaluate(
      () => matchMedia("(prefers-reduced-transparency: reduce)").matches,
    );
    await trigger.click();
    const solid = await page
      .locator(".control-popup")
      .evaluate((el) => getComputedStyle(el).backdropFilter);
    if (transparencySupported) assert.equal(solid, "none");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(650);
    await cdp.send("Emulation.setEmulatedMedia", { features: [] });
    assert.equal(
      await page
        .locator(
          ".glass-morph-shell,.glass-press-surface,.connected-glass-rim,.control-popup",
        )
        .count(),
      0,
    );
    assert.deepEqual(errors, []);
    rows.push({
      dpr,
      keyboardFocus: true,
      pickerFreshHeight: true,
      reducedMotion: true,
      forcedColors: forced,
      reducedTransparencyEmulation: transparencySupported,
      errors,
    });
    await page.screenshot({
      path: `artifacts/polish/accessibility-${dpr}.png`,
    });
    await context.close();
  }
  await writeFile(
    "artifacts/polish/accessibility.json",
    JSON.stringify(
      {
        rows,
        limitation:
          "Browser DPR/media emulation, not physical Windows display scaling or assistive-technology certification.",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(rows));
} finally {
  await browser?.close();
  server.kill();
}
