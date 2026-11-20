// Run against the isolated Vite harness; no task storage or native commands.
// node scripts/performance/glass-prototype.mjs <playwright module path>
import { pathToFileURL } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5179",
    "--strictPort",
  ],
  { stdio: "pipe" },
);
await new Promise((resolve, reject) => {
  server.stdout.on("data", (chunk) => {
    if (chunk.toString().includes("Local:")) resolve();
  });
  server.on("error", reject);
  server.on("exit", (code) => reject(Error(`Vite exited: ${code}`)));
});
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  timeout: 30000,
});
const page = await browser.newPage({ viewport: { width: 1200, height: 1100 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const out = "artifacts/glass";
await mkdir(out, { recursive: true });
try {
  await page.goto("http://127.0.0.1:5179/?glass-lab");
  await page.getByRole("heading", { name: "Material study" }).waitFor();
  for (const theme of ["classic", "peach", "pitch-black", "ashen-white"]) {
    await page.getByLabel("Theme", { exact: true }).selectOption(theme);
    for (const dark of [true, false]) {
      await page.getByLabel("Dark appearance").setChecked(dark);
      await page.screenshot({
        path: `${out}/${theme}-${dark ? "dark" : "light"}.png`,
        fullPage: true,
      });
    }
  }
  await page.getByRole("combobox", { name: "Schedule", exact: true }).click();
  await page.getByRole("option", { name: "Tomorrow" }).click();
  await page
    .getByRole("combobox", { name: "Schedule", exact: true })
    .press("Enter");
  await page.keyboard.press("Escape");
  assert.equal(
    await page
      .getByRole("combobox", { name: "Schedule", exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.getByRole("button", { name: "Capture options" }).click();
  await page.waitForTimeout(300);
  assert.equal(await page.locator("#lab-details").getAttribute("inert"), null);
  await page.screenshot({ path: `${out}/expanded.png`, fullPage: true });
  await page.getByRole("button", { name: "Done", exact: true }).click();
  assert.notEqual(
    await page.locator("#lab-details").getAttribute("inert"),
    null,
  );
  await page.getByLabel("Solid fallback").check();
  await page.getByLabel("Reduce motion").check();
  const fallback = await page
    .locator(".lab-panel")
    .first()
    .evaluate((el) => ({
      blur: getComputedStyle(el).backdropFilter,
      animation: getComputedStyle(el).animationName,
    }));
  assert.equal(fallback.blur, "none");
  assert.equal(fallback.animation, "none");
  await page.screenshot({ path: `${out}/fallback.png`, fullPage: true });
  await page.getByLabel("Solid fallback").uncheck();
  // Reproduce native root scope (the lab's nested scope previously hid these
  // bugs). Also check that navigation is no longer tinted twice by its shell.
  const materialChecks = await page.evaluate(() => {
    const root = document.documentElement;
    const saved = { ...root.dataset };
    const tint = root.style.getPropertyValue("--desktop-tint");
    const fixture = document.createElement("div");
    fixture.className = "app";
    fixture.innerHTML =
      '<aside class="sidebar"></aside><main class="content"></main><button class="glass-surface glass-control">Fixture</button>';
    document.body.append(fixture);
    try {
      Object.assign(root.dataset, {
        desktopGlass: "clear",
        glassVariant: "clear",
        windowActive: "true",
        effects: "allowed",
        motion: "subtle",
      });
      root.style.setProperty("--desktop-tint", ".35");
      const control = fixture.querySelector("button");
      const result = {
        shell: getComputedStyle(fixture).backgroundColor,
        sidebar: getComputedStyle(fixture.querySelector(".sidebar"))
          .backgroundColor,
        content: getComputedStyle(fixture.querySelector(".content"))
          .backgroundColor,
        blur: getComputedStyle(control).backdropFilter,
      };
      root.dataset.motion = "off";
      result.offResponse = getComputedStyle(root)
        .getPropertyValue("--material-response")
        .trim();
      root.dataset.effects = "reduced";
      result.reducedBlur = getComputedStyle(control).backdropFilter;
      root.dataset.windowActive = "false";
      result.inactiveCoverage = getComputedStyle(root)
        .getPropertyValue("--material-coverage")
        .trim();
      return result;
    } finally {
      fixture.remove();
      for (const key of Object.keys(root.dataset)) delete root.dataset[key];
      Object.assign(root.dataset, saved);
      if (tint) root.style.setProperty("--desktop-tint", tint);
      else root.style.removeProperty("--desktop-tint");
    }
  });
  assert.equal(materialChecks.shell, "rgba(0, 0, 0, 0)");
  assert.match(materialChecks.sidebar, /, 0\.66\)$/);
  assert.match(materialChecks.content, /, 0\.66\)$/);
  assert.notEqual(materialChecks.blur, "none");
  assert.equal(materialChecks.offResponse, "0");
  assert.equal(materialChecks.reducedBlur, "none");
  assert.equal(materialChecks.inactiveCoverage, "0.96");
  const matrix = await page.evaluate(() => {
    const root = document.documentElement,
      saved = { ...root.dataset };
    const tint = root.style.getPropertyValue("--desktop-tint");
    const fixture = document.createElement("div");
    fixture.className = "app";
    fixture.innerHTML =
      '<aside class="sidebar"></aside><main class="content"><div class="empty"><p>Reading contrast</p></div></main>';
    document.body.append(fixture);
    const rows = [];
    try {
      for (const [family, theme] of [
        ["classic", "light"],
        ["classic", "dark"],
        ["peach", "light"],
        ["peach", "dark"],
        ["pitch-black", "dark"],
        ["ashen-white", "light"],
      ]) {
        for (const variant of ["clear", "regular"])
          for (const level of [35, 60, 78, 90]) {
            Object.assign(root.dataset, {
              family,
              theme,
              desktopGlass: variant === "clear" ? "clear" : "acrylic",
              glassVariant: variant,
              windowActive: "true",
              effects: "allowed",
            });
            root.style.setProperty("--desktop-tint", String(level / 100));
            const style = getComputedStyle(fixture.querySelector(".sidebar"));
            rows.push({
              family,
              theme,
              variant,
              level,
              bg: style.backgroundColor,
              color: style.color,
              content: getComputedStyle(fixture.querySelector(".content"))
                .backgroundColor,
              empty: getComputedStyle(fixture.querySelector(".empty p")).color,
            });
          }
      }
      return rows;
    } finally {
      fixture.remove();
      for (const key of Object.keys(root.dataset)) delete root.dataset[key];
      Object.assign(root.dataset, saved);
      if (tint) root.style.setProperty("--desktop-tint", tint);
      else root.style.removeProperty("--desktop-tint");
    }
  });
  function channels(color) {
    return color.match(/[\d.]+/g).map(Number);
  }
  function luminance(rgb) {
    return rgb
      .map((v) => v / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  }
  for (const row of matrix) {
    const bg = channels(row.bg),
      color = channels(row.color),
      content = channels(row.content);
    assert.ok(bg[3] >= 0.65 && bg[3] <= 0.901, JSON.stringify(row));
    assert.equal(content[3], bg[3]);
    assert.equal(row.empty, row.color);
    if (row.variant === "clear") assert.ok(bg[3] <= 0.861, JSON.stringify(row));
    for (const desktop of [0, 255]) {
      const composite = bg
        .slice(0, 3)
        .map((v) => (v * bg[3] + desktop * (1 - bg[3])) * 0.96 + 255 * 0.04);
      const a = luminance(color),
        b = luminance(composite);
      assert.ok(
        (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5,
        JSON.stringify(row),
      );
    }
  }
  for (const row of matrix.filter((r) => r.variant === "clear")) {
    const regular = matrix.find(
      (r) =>
        r.variant === "regular" &&
        r.family === row.family &&
        r.theme === row.theme &&
        r.level === row.level,
    );
    assert.ok(channels(regular.bg)[3] > channels(row.bg)[3]);
  }
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  assert.equal(
    await page
      .locator(".lab-panel")
      .first()
      .evaluate((el) => getComputedStyle(el).backdropFilter),
    "none",
  );
  await page.screenshot({ path: `${out}/high-contrast.png`, fullPage: true });
  assert.deepEqual(errors, []);
  await writeFile(
    `${out}/checks.json`,
    JSON.stringify(
      {
        status: "passed",
        engine: await browser.version(),
        checks: [
          "eight theme screenshots",
          "selection",
          "Escape focus",
          "expansion/inert",
          "solid fallback",
          "reduced motion",
          "forced colors",
          "no page exceptions",
          "native root inactive/reduced-effects/reduced-motion overrides",
          "single navigation tint and stable content coverage",
          "48 theme/material/tint combinations retain bounded translucency and 4.5:1 primary-ink contrast at desktop extremes",
        ],
        limitations: [
          "Synthetic in-app backgrounds only; no native DWM, wallpaper, DPI or GPU timing validation",
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  server.kill();
}
