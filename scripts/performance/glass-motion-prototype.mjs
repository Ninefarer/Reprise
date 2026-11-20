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
    "5181",
    "--strictPort",
  ],
  { stdio: "pipe", windowsHide: true },
);
let browser;
try {
  await new Promise((resolve, reject) => {
    server.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("Local:")) resolve();
    });
    server.on("exit", (code) => reject(Error(`Vite ${code}`)));
  });
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({
      viewport: { width: 1100, height: 900 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("http://127.0.0.1:5181/?glass-motion-lab");
  await page
    .getByRole("heading", { name: "Glass surface motion comparison" })
    .waitFor();
  await mkdir("artifacts/glass-motion", { recursive: true });
  await page.getByRole("combobox").click();
  const geometry = await page.evaluate(() => {
    const shell = document.querySelector(".glass-morph-shell"),
      panel = document.querySelector(".control-popup");
    if (!shell) throw Error("No morph shell");
    const animations = [...shell.getAnimations(), ...panel.getAnimations()];
    animations.forEach((a) => {
      a.pause();
      a.currentTime = 80;
    });
    return {
      animations: animations.length,
      shell: getComputedStyle(shell).width,
      panelTransform: getComputedStyle(panel).transform,
      clip: getComputedStyle(panel).clipPath,
    };
  });
  assert.equal(geometry.animations, 2);
  assert.equal(geometry.panelTransform, "none");
  assert.match(geometry.clip, /inset/);
  await page.screenshot({ path: "artifacts/glass-motion/morph-midpoint.png" });
  await page.evaluate(() => document.getAnimations().forEach((a) => a.play()));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  for (let i = 0; i < 30; i++) {
    await page.getByRole("combobox").evaluate((el) => el.click());
    await page.keyboard.press("Escape");
  }
  await page.waitForTimeout(650);
  assert.equal(
    await page.locator(".glass-morph-shell,.control-popup").count(),
    0,
  );
  await page.getByRole("button", { name: "Group", exact: true }).click();
  await page.waitForTimeout(600);
  const connected = await page
    .locator(".connected-sample path")
    .evaluate((el) => ({
      d: getComputedStyle(el).getPropertyValue("d"),
      initial: el.getAttribute("d"),
    }));
  assert.notEqual(connected.d, `path("${connected.initial}")`);
  assert.equal(
    await page.evaluate(() => CSS.supports("d", 'path("M 0 0 L 1 1")')),
    true,
  );
  await page.screenshot({ path: "artifacts/glass-motion/connected.png" });
  const control = page.getByRole("button", { name: "Hold to flex surface" });
  const before = await control.boundingBox();
  await control.hover();
  await page.mouse.down();
  await page.waitForTimeout(90);
  const during = await control.boundingBox();
  assert.deepEqual(during, before);
  assert.equal(await page.locator(".glass-press-surface").count(), 1);
  await page.screenshot({ path: "artifacts/glass-motion/press.png" });
  await page.mouse.up();
  await page.waitForTimeout(500);
  assert.equal(await page.locator(".glass-press-surface").count(), 0);
  await page.getByRole("button", { name: "Open context menu" }).click();
  assert.equal(await page.locator(".glass-morph-shell").count(), 1);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(650);
  assert.equal(
    await page.locator(".glass-morph-shell,.menu-shield").count(),
    0,
  );
  await page.getByLabel("Reduced motion", { exact: true }).check();
  await page.getByRole("combobox").click();
  assert.equal(await page.locator(".glass-morph-shell").count(), 0);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".control-popup").count(), 0);
  assert.deepEqual(errors, []);
  const report = {
    geometry,
    rapidReversals: 30,
    pressBoundsUnchanged: true,
    reducedMotion: true,
    remainingAnimations: await page.evaluate(
      () => document.getAnimations().length,
    ),
    errors,
  };
  await writeFile(
    "artifacts/glass-motion/prototype.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await browser?.close();
  server.kill();
}
